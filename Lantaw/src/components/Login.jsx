import { useState } from 'react';
import { supabase } from '../utils/SupabaseClient';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setError('Database connection missing.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      // The onAuthStateChange listener in the Dashboard will automatically catch this success
      setLoading(false);
      if (onLoginSuccess) onLoginSuccess(data.session);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center py-10">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="text-2xl font-bold text-center mb-4">DRRM Login</h2>
          
          {error && <div className="alert alert-error text-sm">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Official Email</span></label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="input input-bordered w-full" 
              />
            </div>
            
            <div className="form-control">
              <label className="label"><span className="label-text">Password</span></label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="input input-bordered w-full" 
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full mt-4">
              {loading ? 'Authenticating...' : 'Secure Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}