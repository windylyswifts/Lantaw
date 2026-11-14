import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/SupabaseClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import Login from './Login';
import {
  INCIDENT_TYPES,
  ALL_INCIDENT_TYPE_NAMES,
  getIncidentConfig,
} from '../utils/incidentMarkers';
import 'leaflet/dist/leaflet.css';

const BUTUAN_CENTER = { lat: 8.9475, lng: 125.5406 };

export default function AdminDashboard() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const [showLoginView, setShowLoginView] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(ALL_INCIDENT_TYPE_NAMES));

  // --- AUTHENTICATION LIFECYCLE ---
  useEffect(() => {
    if (!supabase) {
      setDbError(true);
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);
      if (updatedSession) setShowLoginView(false);
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          if (payload.new.status !== 'Resolved') {
            setIncidents((current) => [payload.new, ...current]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents' },
        (payload) => {
          setIncidents((current) => {
            if (payload.new.status === 'Resolved') {
              return current.filter((inc) => inc.id !== payload.new.id);
            }
            return current.map((inc) => (inc.id === payload.new.id ? payload.new : inc));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentSubscription);
    };
  }, []);

  // --- HANDLERS ---
  const handleStatusChange = async (id, newStatus) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('incidents')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) alert('Failed to update status. Please try again.');
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleToggleType = (type) => {
    setSelectedTypes((prev) => {
      const isAllSelected = prev.size === ALL_INCIDENT_TYPE_NAMES.length;

      // Clicking a type when all are active isolates that single type first
      if (isAllSelected) {
        return new Set([type]);
      }

      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        // Never leave zero types selected; auto-reset to all
        return next.size === 0 ? new Set(ALL_INCIDENT_TYPE_NAMES) : next;
      }

      next.add(type);
      return next;
    });
  };

  const handleResetTypes = () => {
    setSelectedTypes(new Set(ALL_INCIDENT_TYPE_NAMES));
  };

  // --- DERIVED FILTERED STATE & COUNTS ---
  const isTypeFiltered = selectedTypes.size < ALL_INCIDENT_TYPE_NAMES.length;

  const { displayedIncidents, typeCounts } = useMemo(() => {
    const counts = Object.fromEntries(ALL_INCIDENT_TYPE_NAMES.map((t) => [t, 0]));
    const filtered = [];

    for (const inc of incidents) {
      const matchesStatus = filterStatus === 'All' || inc.status === filterStatus;
      if (!matchesStatus) continue;

      if (Object.hasOwn(counts, inc.incident_type)) {
        counts[inc.incident_type] += 1;
      }

      if (selectedTypes.has(inc.incident_type)) {
        filtered.push(inc);
      }
    }

    return { displayedIncidents: filtered, typeCounts: counts };
  }, [incidents, filterStatus, selectedTypes]);

  // --- GUARD VIEWS ---
  if (dbError) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-base-200 p-4">
        <div className="alert alert-error max-w-md text-center shadow-lg">
          <div>
            <h3 className="font-bold">Database Connection Failed</h3>
            <div className="text-sm">
              Please ensure your environment variables are set correctly.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
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

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-base-200">
      {/* LEFT SIDE: Real-Time Map */}
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative z-0">
        <MapContainer
          center={BUTUAN_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {displayedIncidents.map((incident) => {
            if (
              !Number.isFinite(incident.latitude) ||
              !Number.isFinite(incident.longitude)
            ) {
              return null;
            }

            const { icon } = getIncidentConfig(incident.incident_type);
            const description = incident.description || '';
            const shortDescription =
              description.length > 60 ? `${description.slice(0, 60)}...` : description;

            return (
              <Marker
                key={incident.id}
                position={[incident.latitude, incident.longitude]}
                icon={icon}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-bold text-sm">{incident.incident_type}</div>
                    <div className="text-xs opacity-80">{shortDescription}</div>
                    <div className="text-[11px] font-semibold">
                      Status: {incident.status}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* RIGHT SIDE: Incident Feed & Controls */}
      <div className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto bg-base-100 shadow-xl z-10 flex flex-col">
        {/* Sticky Header */}
        <div className="p-4 border-b border-base-300 flex justify-between items-center bg-base-100 sticky top-0 z-20">
          <div>
            <h2 className="text-xl font-bold leading-tight">Live Incident Map</h2>
            <p className="text-xs text-base-content/60">
              Showing {displayedIncidents.length} active{' '}
              {displayedIncidents.length === 1 ? 'report' : 'reports'}
            </p>
          </div>

          {session ? (
            <button onClick={handleLogout} className="btn btn-sm btn-outline btn-error">
              Logout
            </button>
          ) : (
            <button
              onClick={() => setShowLoginView(true)}
              className="btn btn-sm btn-outline btn-primary"
            >
              Admin Login
            </button>
          )}
        </div>

        {/* Filter Controls: Status Dropdown + Interactive Color Legend Toggles */}
        <div className="px-4 pt-3 pb-3 border-b border-base-300 bg-base-100/95 space-y-3">
          <select
            className="select select-bordered select-sm w-full bg-base-200 font-semibold"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter incidents by status"
          >
            <option value="All">Status: All Active Reports</option>
            <option value="Pending">Status: Pending Only</option>
            <option value="Dispatched">Status: Dispatched Only</option>
          </select>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-base-content/60">
                Incident Types (Legend & Filter)
              </span>
              {isTypeFiltered && (
                <button
                  type="button"
                  onClick={handleResetTypes}
                  className="btn btn-ghost btn-xs text-primary px-1.5 h-5 min-h-0"
                >
                  Show All
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {INCIDENT_TYPES.map(({ type, dotClass, badgeClass }) => {
                const isActive = selectedTypes.has(type);
                const count = typeCounts[type] ?? 0;

                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleToggleType(type)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isActive
                        ? `${badgeClass} shadow-xs`
                        : 'border-base-300 bg-base-200/50 text-base-content/40 hover:text-base-content/70'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass} ${
                        isActive ? 'opacity-100' : 'opacity-35'
                      }`}
                    />
                    <span>{type}</span>
                    <span className="opacity-75 font-semibold">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Incident Feed List */}
        <div className="p-4 space-y-4 flex-grow">
          {displayedIncidents.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-base-content/60">
                No matching {filterStatus === 'All' ? 'active' : filterStatus.toLowerCase()}{' '}
                incidents found.
              </p>
              {isTypeFiltered && (
                <button
                  type="button"
                  onClick={handleResetTypes}
                  className="btn btn-xs btn-outline btn-primary"
                >
                  Reset Incident Type Filter
                </button>
              )}
            </div>
          ) : (
            displayedIncidents.map((incident) => {
              const { dotClass } = getIncidentConfig(incident.incident_type);

              return (
                <div
                  key={incident.id}
                  className="card bg-base-200 shadow-sm border border-base-300"
                >
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="card-title text-lg flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />
                        <span>{incident.incident_type}</span>
                      </h3>

                      {session ? (
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
                      ) : (
                        <span
                          className={`badge ${
                            incident.status === 'Pending' ? 'badge-warning' : 'badge-info'
                          }`}
                        >
                          {incident.status}
                        </span>
                      )}
                    </div>

                    <p className="text-sm mt-2">{incident.description}</p>

                    {session && incident.contact_number && (
                      <p className="text-xs text-base-content/70 mt-1">
                        📞 {incident.contact_number}
                      </p>
                    )}

                    {incident.image_url && (
                      <img
                        src={incident.image_url}
                        alt="Incident proof"
                        className="w-full h-32 object-cover rounded mt-2 border border-base-300"
                      />
                    )}

                    <div className="text-xs text-base-content/50 mt-2 text-right">
                      {new Date(incident.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}