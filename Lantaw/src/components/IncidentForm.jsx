import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function IncidentForm() {
  // 1. State Management: Grouped logically
  const [formData, setFormData] = useState({
    incident_type: 'Flood',
    description: '',
    contact_number: '',
  });
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [status, setStatus] = useState({ loading: false, error: null, success: false });

  // 2. Form Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  // 3. Database Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Fail-fast validation: Fulfills the NOT NULL database constraint
    if (!location.lat || !location.lng) {
      setStatus((prev) => ({ ...prev, error: 'You must capture your location before submitting.' }));
      return;
    }

    setStatus({ loading: true, error: null, success: false });

    try {
      const { error } = await supabase
        .from('incidents')
        .insert([
          {
            incident_type: formData.incident_type,
            description: formData.description,
            contact_number: formData.contact_number,
            latitude: location.lat,
            longitude: location.lng,
            // image_url is omitted for now; we will add media upload in a separate step to keep concerns isolated.
          }
        ]);

      if (error) throw error;

      setStatus({ loading: false, error: null, success: true });
      // Reset form on success
      setFormData({ incident_type: 'Flood', description: '', contact_number: '' });
      setLocation({ lat: null, lng: null });

    } catch (error) {
      setStatus({ loading: false, error: error.message, success: false });
    }
  };

  // 4. UI Render (DaisyUI & Tailwind)
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
        
        {/* Incident Type Dropdown */}
        <div className="form-control">
          <label className="label"><span className="label-text">Incident Type</span></label>
          <select 
            name="incident_type" 
            value={formData.incident_type} 
            onChange={handleChange} 
            className="select select-bordered w-full"
          >
            <option value="Flood">Flood</option>
            <option value="Landslide">Landslide</option>
            <option value="Fire">Fire</option>
            <option value="Medical">Medical Emergency</option>
            <option value="Rescue">Rescue Needed</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Description Textarea */}
        <div className="form-control">
          <label className="label"><span className="label-text">Description</span></label>
          <textarea 
            name="description" 
            value={formData.description} 
            onChange={handleChange} 
            placeholder="Provide brief details..."
            required
            className="textarea textarea-bordered h-24"
          ></textarea>
        </div>

        {/* Contact Number */}
        <div className="form-control">
          <label className="label"><span className="label-text">Contact Number (Optional)</span></label>
          <input 
            type="tel" 
            name="contact_number" 
            value={formData.contact_number} 
            onChange={handleChange} 
            placeholder="09123456789"
            className="input input-bordered w-full" 
          />
        </div>

        {/* Geolocation Button */}
        <div className="form-control">
          <label className="label"><span className="label-text">Location</span></label>
          <button 
            type="button" 
            onClick={handleGetLocation}
            className={`btn ${location.lat ? 'btn-success' : 'btn-outline'}`}
          >
            {location.lat ? 'Location Captured ✓' : '📍 Get My Current Location'}
          </button>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={status.loading || status.success} 
          className="btn btn-primary w-full mt-4"
        >
          {status.loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}