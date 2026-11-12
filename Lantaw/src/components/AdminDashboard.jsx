import { useState, useEffect } from 'react';
import { supabase } from '../utils/SupabaseClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function AdminDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const mapCenter = { lat: 8.9475, lng: 125.5406 };

  useEffect(() => {
    // Guard clause: Stop initialization if Supabase failed to load
    if (!supabase) {
      setDbError(true);
      setLoading(false);
      return;
    }

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
        (payload) => setIncidents((current) => [payload.new, ...current])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((current) => {
            if (payload.new.status === 'Resolved') {
              return current.filter((inc) => inc.id !== payload.new.id);
            }
            return current.map((inc) => inc.id === payload.new.id ? payload.new : inc);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentSubscription);
    };
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    if (!supabase) return;
    const { error } = await supabase.from('incidents').update({ status: newStatus }).eq('id', id);
    if (error) alert('Failed to update status. Please try again.');
  };

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  // Graceful failure UI if environment variables are missing
  if (dbError) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-base-200">
        <div className="alert alert-error max-w-md text-center shadow-lg">
          <div>
            <h3 className="font-bold">Database Connection Failed</h3>
            <div className="text-sm">Please ensure your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly in your build environment.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-base-200">
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative z-0">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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

      <div className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto p-4 bg-base-100 shadow-xl z-10">
        <h2 className="text-2xl font-bold mb-4">Active Incidents ({incidents.length})</h2>
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <p className="text-gray-500">No active incidents at this time.</p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="card bg-base-200 shadow-sm border border-base-300">
                <div className="card-body p-4">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="card-title text-lg">{incident.incident_type}</h3>
                    <select 
                      className={`select select-sm select-bordered ${incident.status === 'Pending' ? 'text-warning' : 'text-info'}`}
                      value={incident.status}
                      onChange={(e) => handleStatusChange(incident.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Resolved">Mark Resolved</option>
                    </select>
                  </div>
                  <p className="text-sm mt-2">{incident.description}</p>
                  {incident.contact_number && <p className="text-xs text-gray-500 mt-1">📞 {incident.contact_number}</p>}
                  {incident.image_url && <img src={incident.image_url} alt="Incident proof" className="w-full h-32 object-cover rounded mt-2 border border-base-300" />}
                  <div className="text-xs text-gray-400 mt-2 text-right">{new Date(incident.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}