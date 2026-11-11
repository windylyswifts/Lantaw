import { useState, useEffect } from 'react';
import { supabase } from '../utils/SupabaseClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function AdminDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const mapCenter = { lat: 8.9475, lng: 125.5406 };

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .neq('status', 'Resolved') 
        .order('created_at', { ascending: false });

      if (!error && data) {
        setIncidents(data);
      }
      setLoading(false);
    };

    fetchIncidents();

    const incidentSubscription = supabase
      .channel('public:incidents')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((current) => [payload.new, ...current]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((current) => {
            // If marked resolved, remove it from the active dashboard entirely
            if (payload.new.status === 'Resolved') {
              return current.filter((inc) => inc.id !== payload.new.id);
            }
            // Otherwise, update the specific incident in the array
            return current.map((inc) => 
              inc.id === payload.new.id ? payload.new : inc
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentSubscription);
    };
  }, []);

  // NEW FEATURE: Function to update incident status in the database
  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase
      .from('incidents')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Failed to update status:', error.message);
      alert('Failed to update status. Please try again.');
    }
    // Notice: We do NOT call setIncidents here. The WebSocket listener above catches 
    // this successful database update and modifies the state for us automatically.
  };

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-base-200">
      
      {/* LEFT SIDE: Real-Time Map */}
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative z-0">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {incidents.map((incident) => (
            <Marker key={incident.id} position={[incident.latitude, incident.longitude]}>
              <Popup>
                <strong>{incident.incident_type}</strong><br />
                {incident.description.substring(0, 50)}...
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* RIGHT SIDE: Incident Feed */}
      <div className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto p-4 bg-base-100 shadow-xl z-10">
        <h2 className="text-2xl font-bold mb-4">Active Incidents ({incidents.length})</h2>
        
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <p className="text-gray-500">No active incidents at this time.</p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="card bg-base-200 shadow-sm border border-base-300">
                <div className="card-body p-4">
                  
                  {/* Header: Title and Status Control */}
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="card-title text-lg">{incident.incident_type}</h3>
                    
                    {/* NEW FEATURE: Dropdown enforcing exact database values */}
                    <select 
                      className={`select select-sm select-bordered ${
                        incident.status === 'Pending' ? 'text-warning' : 'text-info'
                      }`}
                      value={incident.status}
                      onChange={(e) => handleStatusChange(incident.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Resolved">Mark Resolved</option>
                    </select>
                  </div>

                  <p className="text-sm mt-2">{incident.description}</p>
                  
                  {incident.contact_number && (
                    <p className="text-xs text-gray-500 mt-1">📞 {incident.contact_number}</p>
                  )}
                  
                  {incident.image_url && (
                    <img 
                      src={incident.image_url} 
                      alt="Incident proof" 
                      className="w-full h-32 object-cover rounded mt-2 border border-base-300"
                    />
                  )}
                  <div className="text-xs text-gray-400 mt-2 text-right">
                    {new Date(incident.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
    </div>
  );
}