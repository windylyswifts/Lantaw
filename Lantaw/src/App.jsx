import IncidentForm from './components/IncidentForm';

function App() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center py-10">
      <div className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body">
          <IncidentForm />
        </div>
      </div>
    </div>
  );
}

export default App;