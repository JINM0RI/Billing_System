import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { apiFetch, setSession } from '../lib/api';
import type { AuthResponse } from '../lib/api';

export default function LoginPage({ onLogin }: { onLogin: (role: string) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [registerForm, setRegisterForm] = useState({ username: '', full_name: '', password: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ has_users: boolean; has_admin: boolean }>('/auth/status')
      .then((status) => {
        if (!status.has_users) {
          setCanBootstrap(true);
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }
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

  async function handleBootstrap(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setRegisterError(null);
    try {
      const response = await apiFetch<AuthResponse>('/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify({
          username: registerForm.username,
          full_name: registerForm.full_name || null,
          password: registerForm.password,
        }),
      });
      setSession(response.access_token, response.role);
      onLogin(response.role);
      navigate('/');
    } catch (bootstrapError) {
      setRegisterError(bootstrapError instanceof Error ? bootstrapError.message : 'Unable to create admin');
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
          {bootstrapMode ? (
            <>
              <h2 className="text-3xl font-semibold text-white">Create admin account</h2>
              <p className="mt-2 text-slate-400">First-time setup detected. Register the primary admin account.</p>
              <form className="mt-8 space-y-4" onSubmit={handleBootstrap}>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Username</label>
                  <input
                    className="field"
                    value={registerForm.username}
                    onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Full name</label>
                  <input
                    className="field"
                    value={registerForm.full_name}
                    onChange={(event) => setRegisterForm({ ...registerForm, full_name: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Password</label>
                  <input
                    className="field"
                    type="password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                  />
                </div>
                {registerError ? (
                  <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{registerError}</p>
                ) : null}
                <button className="btn-primary w-full" disabled={loading} type="submit">
                  {loading ? 'Creating admin…' : 'Register Admin'}
                </button>
                <button className="btn-secondary w-full" type="button" onClick={() => setBootstrapMode(false)}>
                  Back to login
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-semibold text-white">Welcome back</h2>
              <p className="mt-2 text-slate-400">Sign in with the local demo account or your own managed user.</p>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Full name</label>
                  <input className="field" value={username} onChange={(event) => setUsername(event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Password</label>
                  <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                <button
                  className="btn-secondary w-full"
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('Admin@12345!');
                  }}
                >
                  Use demo admin
                </button>
                {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
                <button className="btn-primary w-full" disabled={loading} type="submit">
                  {loading ? 'Signing in…' : 'Enter Dashboard'}
                </button>
                {canBootstrap ? (
                  <button className="btn-secondary w-full" type="button" onClick={() => setBootstrapMode(true)}>
                    Register Admin
                  </button>
                ) : null}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
