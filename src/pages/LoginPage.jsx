// Sign in. Supabase mode: email magic link. Demo Mode: pick which partner you are.
import { useState } from 'react';
import { Heart, Mail } from 'lucide-react';
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
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-10 text-center">
          <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border border-line text-rose-500 dark:border-line-dark">
            <Heart size={22} strokeWidth={1.5} />
          </span>
          <h1 className="title-serif text-[44px] leading-none">Our Bucket List</h1>
          <p className="muted mx-auto mt-3 max-w-[18rem] text-[15px]">A private space for the two of you — dreams, plans and the memories you make.</p>
        </div>

        {mode === 'supabase' ? (
          sent ? (
            <div className="text-center">
              <Mail size={22} strokeWidth={1.5} className="mx-auto text-rose-500" />
              <h2 className="mt-3 text-[17px] font-semibold">Check your inbox</h2>
              <p className="muted mt-1 text-[14px]">We sent a sign-in link to {email}. Open it on this device.</p>
              <button className="btn-ghost mt-4" onClick={() => setSent(false)}>Use a different email</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3" noValidate>
              <input id="email" type="email" autoComplete="email" className="input" placeholder="Your email"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} aria-label="Your email" />
              {error && <p className="err" role="alert">{error}</p>}
              <button className="btn-dark w-full" disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : 'Continue with email'}
              </button>
              <p className="muted text-center text-[13px]">No password. We’ll email you a magic link.</p>
            </form>
          )
        ) : (
          <div className="space-y-2.5">
            {DEMO_USERS.map((u, k) => (
              <button key={u.id} className={k === 0 ? 'btn-dark w-full' : 'btn-soft w-full'}
                onClick={() => backend.signInDemo(u.id).catch((e) => toast(errMsg(e), 'error'))}>
                Continue as {k === 0 ? 'me' : 'my partner'}
              </button>
            ))}
            <p className="muted pt-3 text-center text-[13px]">Demo mode — data stays in this browser.<br />Connect Supabase for two synced accounts.</p>
          </div>
        )}
      </div>
    </main>
  );
}
