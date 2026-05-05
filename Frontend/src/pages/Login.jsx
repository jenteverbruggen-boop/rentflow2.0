import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [mode, setMode]     = useState('login');
  const [form, setForm]     = useState({ email: '', password: '', name: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(endpoint, form);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-400 mb-1">RentFlow</h1>
        <p className="text-gray-500 text-sm mb-6">
          {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
        </p>

        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-300 text-sm px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handle} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Naam"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Wachtwoord"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Bezig...' : mode === 'login' ? 'Inloggen' : 'Registreren'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 text-xs text-gray-500 hover:text-gray-300 w-full text-center"
        >
          {mode === 'login' ? 'Nog geen account? Registreer hier' : 'Al een account? Log in'}
        </button>
      </div>
    </div>
  );
}
