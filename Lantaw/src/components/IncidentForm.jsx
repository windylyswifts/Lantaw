import { useState, useEffect } from 'react';
import { supabase } from '../utils/SupabaseClient';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Prevent broken marker icons in Vite/React production builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position.lat && position.lng) {
      map.flyTo(position, 16);
    }
  }, [position, map]);
  return position.lat && position.lng ? <Marker position={position} /> : null;
}

export default function IncidentForm() {
  const [formData, setFormData] = useState({
    incident_type: 'Flood',
    description: '',
    contact_number: '',
  });
  
  const defaultCenter = { lat: 8.9475, lng: 125.5406 }; 
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [imageFile, setImageFile] = useState(null); // New state for the uploaded file
  const [status, setStatus] = useState({ loading: false, error: null, success: false });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleGetLocation = () => {
    setStatus((prev) => ({ ...prev, error: null }));
    
    if (!navigator.geolocation) {
      setStatus((prev) => ({ ...prev, error: 'Geolocation is not supported by your browser.' }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        setStatus((prev) => ({ ...prev, error: 'Failed to get location. Please enable GPS permissions.' }));
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!location.lat || !location.lng) {
      setStatus((prev) => ({ ...prev, error: 'You must capture your location before submitting.' }));
      return;
    }

    setStatus({ loading: true, error: null, success: false });

    try {
      let finalImageUrl = null;

      // 1. Handle Image Upload (if a file was selected)
      if (imageFile) {
        // Create a unique filename to prevent overwriting existing files
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('incident_images')
          .upload(filePath, imageFile);

        if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);

        // Retrieve the public URL for the newly uploaded image
        const { data: publicUrlData } = supabase.storage
          .from('incident_images')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrlData.publicUrl;
      }

      // 2. Insert into PostgreSQL Database
      const { error: dbError } = await supabase
        .from('incidents')
        .insert([
          {
            incident_type: formData.incident_type,
            description: formData.description,
            contact_number: formData.contact_number,
            latitude: location.lat,
            longitude: location.lng,
            image_url: finalImageUrl, // Will be null if no image was uploaded
          }
        ]);

      if (dbError) throw dbError;

      // 3. Reset all states on success
      setStatus({ loading: false, error: null, success: true });
      setFormData({ incident_type: 'Flood', description: '', contact_number: '' });
      setLocation({ lat: null, lng: null });
      setImageFile(null); 
      // Reset the physical file input field
      document.getElementById('image-upload').value = '';

    } catch (error) {
      setStatus({ loading: false, error: error.message, success: false });
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h2 className="text-2xl font-bold text-center">Report an Incident</h2>

      {status.error && (
        <div className="alert alert-error text-sm">{status.error}</div>
      )}
      {status.success && (
        <div className="alert alert-success text-sm">Report submitted successfully. Responders have been notified.</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="form-control">
          <label className="label"><span className="label-text">Incident Type</span></label>
          <select name="incident_type" value={formData.incident_type} onChange={handleChange} className="select select-bordered w-full">
            <option value="Flood">Flood</option>
            <option value="Landslide">Landslide</option>
            <option value="Fire">Fire</option>
            <option value="Medical">Medical Emergency</option>
            <option value="Rescue">Rescue Needed</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Description</span></label>
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Provide brief details..." required className="textarea textarea-bordered h-24"></textarea>
        </div>

        <div className="form-control">
          <label className="label"><span className="label-text">Contact Number (Optional)</span></label>
          <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleChange} placeholder="09123456789" className="input input-bordered w-full" />
        </div>

        {/* New Image Upload Field */}
        <div className="form-control">
          <label className="label"><span className="label-text">Upload Photo (Optional)</span></label>
          <input 
            id="image-upload"
            type="file" 
            accept="image/*" 
            onChange={handleImageChange} 
            className="file-input file-input-bordered w-full" 
          />
        </div>

        <div className="form-control space-y-2">
          <label className="label"><span className="label-text">Location (Required)</span></label>
          
          <div className="h-48 w-full rounded-lg overflow-hidden border border-base-300 z-0 relative">
            <MapContainer 
              center={defaultCenter} 
              zoom={13} 
              scrollWheelZoom={false} 
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker position={location} />
            </MapContainer>
          </div>

          <button type="button" onClick={handleGetLocation} className={`btn ${location.lat ? 'btn-success' : 'btn-outline'}`}>
            {location.lat ? 'Location Captured ✓' : '📍 Get My Current Location'}
          </button>
        </div>

        <button type="submit" disabled={status.loading || status.success} className="btn btn-primary w-full mt-4">
          {status.loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}