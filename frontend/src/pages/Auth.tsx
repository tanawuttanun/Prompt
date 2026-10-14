import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ErrorAlert } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function useAfterAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from;
  return (role: string) => navigate(from ?? (role === 'admin' ? '/admin' : '/products'), { replace: true });
}

export function Login() {
  const { login, user } = useAuth();
  const toast = useToast();
  const done = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/products" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      toast(`Welcome back, ${u.name.split(' ')[0]}`, { detail: u.role === 'admin' ? 'Admin access granted' : 'Good to see you at the club', icon: '🏆' });
      done(u.role);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v-panel" style={{ maxWidth: 420, margin: '20px auto' }}>
      <h1 className="v-h1">Sign in</h1>
      <p className="v-muted" style={{ marginBottom: 18 }}>Welcome back to Delux Sport Club.</p>
      <form className="v-form" onSubmit={submit}>
        <label className="v-field"><span>Email</span><input className="v-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="v-field"><span>Password</span><input className="v-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <ErrorAlert error={error} />
        <button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="v-small v-muted" style={{ marginTop: 16 }}>New here? <Link className="v-link" to="/register">Create an account</Link></p>
      <p className="v-small v-muted" style={{ marginTop: 6 }}>Demo accounts are listed in <code>backend/src/store/seed.ts</code>.</p>
    </div>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const toast = useToast();
  const done = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/products" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError(new Error('Passwords do not match'));
    setBusy(true);
    setError(null);
    try {
      const u = await register(form.name, form.email, form.password);
      toast('Welcome to the club!', { detail: `Your Delux membership is active, ${u.name.split(' ')[0]}`, icon: '✨', duration: 4500 });
      done(u.role);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const field = (name: keyof typeof form, label: string, type = 'text', auto?: string) => (
    <label className="v-field"><span>{label}</span><input className="v-input" type={type} autoComplete={auto} required value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} /></label>
  );

  return (
    <div className="v-panel" style={{ maxWidth: 420, margin: '20px auto' }}>
      <h1 className="v-h1">Join the club</h1>
      <p className="v-muted" style={{ marginBottom: 18 }}>Become a member of Delux Sport Club.</p>
      <form className="v-form" onSubmit={submit}>
        {field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password (8+ characters)', 'password', 'new-password')}
        {field('confirm', 'Confirm password', 'password', 'new-password')}
        <ErrorAlert error={error} />
        <button className="v-btn v-btn-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="v-small v-muted" style={{ marginTop: 16 }}>Already a member? <Link className="v-link" to="/login">Sign in</Link></p>
    </div>
  );
}
