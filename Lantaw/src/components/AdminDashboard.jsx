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
  
  const [showLoginView, setShowLoginView] = useState(false);
  
  // NEW STATE: Manage the current filter view
  const [filterStatus, setFilterStatus] = useState('All');

  const mapCenter = { lat: 8.9475, lng: 125.5406 };

  // --- AUTHENTICATION LIFECYCLE ---
  useEffect(() => {
    if (!supabase) {
      setDbError(true);
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setShowLoginView(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATA FETCHING & REALTIME LIFECYCLE ---
  useEffect(() => {
    if (!supabase) return;

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
  }, []); 

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

  if (authLoading || dataLoading) {
    return <div className="min-h-screen flex justify-center items-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  if (showLoginView && !session) {
    return (
      <div className="relative min-h-screen bg-base-200">
        <div className="absolute top-4 left-4 z-50">
          <button onClick={() => setShowLoginView(false)} className="btn btn-sm btn-ghost">
            ← Back to Map
          </button>
        </div>
        <Login onLoginSuccess={setSession} />
      </div>
    );
  }

  // NEW FEATURE: Derived State for Filtering
  // This instantly filters the array before rendering without mutating the actual data
  const displayedIncidents = filterStatus === 'All' 
    ? incidents 
    : incidents.filter((inc) => inc.status === filterStatus);

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-base-200">
      
      {/* LEFT SIDE: Real-Time Map */}
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative z-0">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* Map loops over the filtered array instead of all incidents */}
          {displayedIncidents.map((incident) => (
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
        
        <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-100 sticky top-0 z-20">
          <h2 className="text-xl font-bold">Live Incident Map</h2>
          {session ? (
            <button onClick={handleLogout} className="btn btn-sm btn-outline btn-error">Logout</button>
          ) : (
            <button onClick={() => setShowLoginView(true)} className="btn btn-sm btn-outline btn-primary">Admin Login</button>
          )}
        </div>

        {/* NEW FEATURE: Dropdown Filter Control */}
        <div className="px-4 pt-4 pb-0">
          <div className="form-control w-full">
            <select 
              className="select select-bordered select-sm w-full bg-base-200 font-semibold"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">Viewing: All Active Reports</option>
              <option value="Pending">Viewing: Pending Only</option>
              <option value="Dispatched">Viewing: Dispatched Only</option>
            </select>
          </div>
        </div>

        <div className="p-4 space-y-4 flex-grow">
          {displayedIncidents.length === 0 ? (
            <p className="text-gray-500">No {filterStatus === 'All' ? 'active' : filterStatus.toLowerCase()} incidents at this time.</p>
          ) : (
            displayedIncidents.map((incident) => (
              <div key={incident.id} className="card bg-base-200 shadow-sm border border-base-300">
                <div className="card-body p-4">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="card-title text-lg">{incident.incident_type}</h3>
                    
                    {session ? (
                      <select 
                        className={`select select-sm select-bordered ${incident.status === 'Pending' ? 'text-warning' : 'text-info'}`}
                        value={incident.status}
                        onChange={(e) => handleStatusChange(incident.id, e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Resolved">Mark Resolved</option>
                      </select>
                    ) : (
                      <span className={`badge ${incident.status === 'Pending' ? 'badge-warning' : 'badge-info'}`}>
                        {incident.status}
                      </span>
                    )}

                  </div>
                  <p className="text-sm mt-2">{incident.description}</p>
                  
                  {session && incident.contact_number && (
                    <p className="text-xs text-gray-500 mt-1">📞 {incident.contact_number}</p>
                  )}
                  
                  {incident.image_url && (
                    <img src={incident.image_url} alt="Incident proof" className="w-full h-32 object-cover rounded mt-2 border border-base-300" />
                  )}
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