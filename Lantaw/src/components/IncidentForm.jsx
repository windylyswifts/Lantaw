import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../utils/SupabaseClient';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { INCIDENT_TYPES, getIncidentConfig } from '../utils/incidentMarkers';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 8.9475, lng: 125.5406 }; // Butuan City

function InteractiveLocationMarker({
  position,
  icon,
  pendingFlyCoords,
  onFlyComplete,
  onSelectLocation,
}) {
  const map = useMap();
  const markerRef = useRef(null);

  // Fly to coordinates ONLY when a fresh GPS capture requests it, then clear the request
  useEffect(() => {
    if (!pendingFlyCoords) return;

    const targetZoom = Math.max(map.getZoom(), 16);
    map.flyTo([pendingFlyCoords.lat, pendingFlyCoords.lng], targetZoom, { animate: true });
    onFlyComplete();
  }, [pendingFlyCoords, map, onFlyComplete]);

  // Allow tapping/clicking anywhere on the map without altering zoom or pan
  useMapEvents({
    click(e) {
      onSelectLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  // Allow dragging the existing marker without altering zoom or pan
  const dragHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          onSelectLocation({ lat, lng });
        }
      },
    }),
    [onSelectLocation]
  );

  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
    return null;
  }

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={icon}
      draggable={true}
      eventHandlers={dragHandlers}
    />
  );
}

export default function IncidentForm() {
  const [formData, setFormData] = useState({
    incident_type: 'Flood',
    description: '',
    contact_number: '',
  });

  const [location, setLocation] = useState({ lat: null, lng: null });
  const [locationSource, setLocationSource] = useState(null); // 'gps' | 'manual' | null
  const [pendingFlyCoords, setPendingFlyCoords] = useState(null);
  const [locatingGps, setLocatingGps] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState({ loading: false, error: null, success: false });

  const hasValidLocation = Number.isFinite(location.lat) && Number.isFinite(location.lng);
  const activeMarkerIcon = getIncidentConfig(formData.incident_type).icon;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (status.success) setStatus((prev) => ({ ...prev, success: false }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
      if (status.success) setStatus((prev) => ({ ...prev, success: false }));
    }
  };

  const handleManualLocationSelect = useCallback((coords) => {
    setLocation({ lat: coords.lat, lng: coords.lng });
    setLocationSource('manual');
    setStatus((prev) => ({ ...prev, error: null, success: false }));
  }, []);

  const handleFlyComplete = useCallback(() => {
    setPendingFlyCoords(null);
  }, []);

  const handleGetLocation = () => {
    setStatus((prev) => ({ ...prev, error: null, success: false }));

    if (!navigator.geolocation) {
      setStatus((prev) => ({
        ...prev,
        error: 'GPS is not supported by your browser. Tap directly on the map to place a pin.',
      }));
      return;
    }

    setLocatingGps(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(coords);
        setLocationSource('gps');
        setPendingFlyCoords(coords);
        setLocatingGps(false);
      },
      () => {
        setLocatingGps(false);
        setStatus((prev) => ({
          ...prev,
          error:
            'Unable to access GPS. You can still tap anywhere on the map below to pin the exact incident spot.',
        }));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasValidLocation) {
      setStatus((prev) => ({
        ...prev,
        error: 'Please capture your GPS location or tap the map to place a pin before submitting.',
      }));
      return;
    }

    if (!supabase) {
      setStatus({
        loading: false,
        error: 'Database connection missing. Contact administrator.',
        success: false,
      });
      return;
    }

    setStatus({ loading: true, error: null, success: false });

    try {
      let finalImageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('incident_images')
          .upload(fileName, imageFile);

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('incident_images')
          .getPublicUrl(fileName);

        finalImageUrl = publicUrlData.publicUrl;
      }

      const { error: dbError } = await supabase.from('incidents').insert([
        {
          incident_type: formData.incident_type,
          description: formData.description.trim(),
          contact_number: formData.contact_number.trim() || null,
          latitude: location.lat,
          longitude: location.lng,
          image_url: finalImageUrl,
        },
      ]);

      if (dbError) throw dbError;

      setStatus({ loading: false, error: null, success: true });
      setFormData({ incident_type: 'Flood', description: '', contact_number: '' });
      setLocation({ lat: null, lng: null });
      setLocationSource(null);
      setPendingFlyCoords(null);
      setImageFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: false });
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h2 className="text-2xl font-bold text-center">Report an Incident</h2>

      {status.error && <div className="alert alert-error text-sm">{status.error}</div>}
      {status.success && (
        <div className="alert alert-success text-sm">Report submitted successfully.</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Incident Type</span>
          </label>
          <select
            name="incident_type"
            value={formData.incident_type}
            onChange={handleChange}
            className="select select-bordered w-full"
          >
            {INCIDENT_TYPES.map(({ type }) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Description</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Provide brief details..."
            required
            className="textarea textarea-bordered h-24"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Contact Number (Optional)</span>
          </label>
          <input
            type="tel"
            name="contact_number"
            value={formData.contact_number}
            onChange={handleChange}
            placeholder="09123456789"
            className="input input-bordered w-full"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Upload Photo (Optional)</span>
          </label>
          <input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="file-input file-input-bordered w-full"
          />
        </div>

        <div className="form-control space-y-2">
          <div className="flex items-center justify-between">
            <label className="label py-0">
              <span className="label-text">Location (Required)</span>
            </label>
            {hasValidLocation && (
              <span className="text-xs font-mono text-base-content/70">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </span>
            )}
          </div>

          <p className="text-xs text-base-content/70">
            Use your current GPS location, or tap anywhere on the map and drag the pin to mark the exact spot.
          </p>

          <div className="h-56 w-full rounded-lg overflow-hidden border border-base-300 z-0 relative">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={13}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <InteractiveLocationMarker
                position={location}
                icon={activeMarkerIcon}
                pendingFlyCoords={pendingFlyCoords}
                onFlyComplete={handleFlyComplete}
                onSelectLocation={handleManualLocationSelect}
              />
            </MapContainer>
          </div>

          <button
            type="button"
            onClick={handleGetLocation}
            disabled={locatingGps}
            className={`btn w-full ${hasValidLocation ? 'btn-success' : 'btn-outline'}`}
          >
            {locatingGps
              ? 'Locating GPS...'
              : hasValidLocation
              ? locationSource === 'gps'
                ? 'GPS Location Captured ✓ (Tap to Re-center)'
                : 'Manual Pin Placed ✓ (Or Use GPS)'
              : '📍 Get My Current Location'}
          </button>
        </div>

        <button
          type="submit"
          disabled={status.loading}
          className="btn btn-primary w-full mt-4"
        >
          {status.loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}