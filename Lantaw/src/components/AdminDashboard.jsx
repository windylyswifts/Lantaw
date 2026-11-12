import { useState, useEffect } from 'react';
import { supabase } from '../utils/SupabaseClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import Login from './Login';
import 'leaflet/dist/leaflet.css';

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const mapCenter = { lat: 8.9475, lng: 125.5406 };

  // --- AUTHENTICATION LIFECYCLE ---
  useEffect(() => {
    if (!supabase) {
      setDbError(true);
      setAuthLoading(false);
      return;
    }

    // Check for an existing active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for login/logout events across tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATA FETCHING & REALTIME LIFECYCLE ---
  // This ONLY runs if the user is successfully authenticated
  useEffect(() => {
    if (!session || !supabase) return;

    setDataLoading(true);

    const fetchIncidents = async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false });

      if (!error && data) setIncidents(data);
      setDataLoading(false);
    };

    fetchIncidents();

    const incidentSubscription = supabase
      .channel('public:incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        setIncidents((current) => [payload.new, ...current]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents' }, (payload) => {
        setIncidents((current) => {
          if (payload.new.status === 'Resolved') {
            return current.filter((inc) => inc.id !== payload.new.id);
          }
          return current.map((inc) => (inc.id === payload.new.id ? payload.new : inc));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(incidentSubscription);
    };
  }, [session]); // Dependency array ensures WebSockets reconnect if a new admin logs in

  const handleStatusChange = async (id, newStatus) => {
    if (!supabase) return;
    const { error } = await supabase.from('incidents').update({ status: newStatus }).eq('id', id);
    if (error) alert('Failed to update status. Please try again.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- RENDER LOGIC ---
  if (dbError) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-base-200">
        <div className="alert alert-error max-w-md text-center shadow-lg">
          <div>
            <h3 className="font-bold">Database Connection Failed</h3>
            <div className="text-sm">Please ensure your environment variables are set correctly.</div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return <div className="min-h-screen flex justify-center items-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  // Intercept unauthenticated users and show the secure Login component
  if (!session) {
    return <Login onLoginSuccess={setSession} />;
  }

  if (dataLoading) {
    return <div className="min-h-screen flex justify-center items-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  // Render the secure dashboard for authenticated DRRM operators
  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-base-200">
      
      {/* LEFT SIDE: Real-Time Map */}
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

      {/* RIGHT SIDE: Incident Feed */}
      <div className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto bg-base-100 shadow-xl z-10 flex flex-col">
        
        {/* Secure Dashboard Header with Logout */}
        <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-100 sticky top-0 z-20">
          <h2 className="text-xl font-bold">Command Center</h2>
          <button onClick={handleLogout} className="btn btn-sm btn-outline btn-error">Logout</button>
        </div>

        <div className="p-4 space-y-4 flex-grow">
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