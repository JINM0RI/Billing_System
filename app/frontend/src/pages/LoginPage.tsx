import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { apiFetch, setSession } from '../lib/api';
import type { AuthResponse } from '../lib/api';

export default function LoginPage({ onLogin }: { onLogin: (role: string) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@12345!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setSession(response.access_token, response.role);
      onLogin(response.role);
      navigate('/');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to log in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="panel w-full max-w-[980px] overflow-hidden lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-gradient-to-br from-amber-400 via-orange-300 to-slate-950 p-8 text-slate-950 lg:p-12">
          <div className="chip border-slate-950/20 bg-slate-950/10 text-slate-950">Offline desktop billing</div>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight lg:text-6xl">A fast local billing system with real-time stock and secure access.</h1>
          <p className="mt-6 max-w-xl text-base text-slate-900/80 lg:text-lg">Electron shell, React dashboard, FastAPI business logic, and SQLite storage. Built for keyboard-driven billing and role-based operations.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {['Admin RBAC', 'Instant invoices', 'Low-stock alerts'].map((item) => (
              <div key={item} className="rounded-3xl border border-slate-950/10 bg-white/30 p-4 backdrop-blur-sm">
                <Sparkles size={18} />
                <p className="mt-3 font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 lg:p-12">
          <div className="mb-8 flex items-center gap-3 text-slate-300">
            <LockKeyhole size={18} />
            <span className="text-sm uppercase tracking-[0.24em]">Secure sign-in</span>
          </div>
          <h2 className="text-3xl font-semibold text-white">Welcome back</h2>
          <p className="mt-2 text-slate-400">Sign in with the local demo account or your own managed user.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Username</label>
              <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Password</label>
              <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? 'Signing in…' : 'Enter Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
