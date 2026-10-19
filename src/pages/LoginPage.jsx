// Sign in. Supabase mode: email magic link. Demo Mode: pick which partner you are.
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { DEMO_USERS } from '../data/localBackend.js';
import { Spinner } from '../components/ui.jsx';
import { errMsg } from '../lib/utils.js';

export default function LoginPage() {
  const { backend, mode, toast } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address');
    setBusy(true);
    try {
      await backend.signInWithEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      {/* soft decorative blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-200/60 blur-3xl dark:bg-rose-900/30" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold-400/30 blur-3xl dark:bg-gold-500/10" />

      <div className="relative w-full max-w-sm animate-fade-up text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[28px] bg-rose-600 text-4xl shadow-lg animate-pop">💞</div>
        <h1 className="text-4xl font-bold">Our Bucket List</h1>
        <p className="muted mx-auto mt-2 max-w-xs">One shared list for the two of you — dreams, plans and the memories you make.</p>

        {mode === 'supabase' ? (
          sent ? (
            <div className="card mt-8 p-6">
              <div className="text-4xl">📬</div>
              <h2 className="mt-2 text-xl font-bold">Check your inbox</h2>
              <p className="muted mt-1 text-sm">We sent a magic link to <b>{email}</b>. Open it on this device to sign in.</p>
              <button className="btn-ghost mt-4" onClick={() => setSent(false)}>Use a different email</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-3 text-left" noValidate>
              <label className="label" htmlFor="email">Your email</label>
              <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
              {error && <p className="err" role="alert">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : <Mail size={18} />} Send me a magic link
              </button>
              <p className="muted text-center text-xs">No password needed. Your partner signs in with their own email.</p>
            </form>
          )
        ) : (
          <div className="mt-8 space-y-3">
            <p className="chip mx-auto bg-gold-400/25 text-ink-800 dark:text-cream-100">Demo Mode · data stays in this browser</p>
            {DEMO_USERS.map((u, k) => (
              <button key={u.id} className={k === 0 ? 'btn-primary w-full py-3' : 'btn-soft w-full py-3'}
                onClick={() => backend.signInDemo(u.id).catch((e) => toast(errMsg(e), 'error'))}>
                Continue as {k === 0 ? 'me' : 'my partner'} <span className="opacity-70">({u.display_name})</span>
              </button>
            ))}
            <p className="muted pt-2 text-xs">Connect Supabase (see README) for real accounts that sync between two phones.</p>
          </div>
        )}
      </div>
    </main>
  );
}
