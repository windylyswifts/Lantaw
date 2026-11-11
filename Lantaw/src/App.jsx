import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import IncidentForm from './components/IncidentForm';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <Router>
      {/* A simple invisible navigation for development purposes. 
          In production, residents won't see a link to the admin dashboard. */}
      <div className="absolute top-2 left-2 z-50 flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
        <Link to="/" className="btn btn-xs btn-outline bg-base-100">Public Form</Link>
        <Link to="/admin" className="btn btn-xs btn-outline bg-base-100">Admin Dashboard</Link>
      </div>

      <Routes>
        {/* Route 1: The Public Reporting Interface */}
        <Route path="/" element={
          <div className="min-h-screen bg-base-200 flex items-center justify-center py-10">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
              <div className="card-body">
                <IncidentForm />
              </div>
            </div>
          </div>
        } />

        {/* Route 2: The DRRM Command Center */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;