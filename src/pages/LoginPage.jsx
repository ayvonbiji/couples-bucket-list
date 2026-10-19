// Sign in with username + password.
// Supabase mode: Supabase Auth (bcrypt-hashed passwords, refresh-token sessions).
// Demo Mode: accounts created on the setup screen, stored as PBKDF2 hashes on this device.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Heart } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { Spinner } from '../components/ui.jsx';
import { validateUsername, validatePassword } from '../lib/auth.js';
import { errMsg } from '../lib/utils.js';

export default function LoginPage() {
  const { backend, mode } = useApp();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  async function submit(e) {
    e.preventDefault();
    const errs = { username: validateUsername(username), password: validatePassword(password) };
    setErrors(errs);
    if (errs.username || errs.password) return;
    setBusy(true);
    try {
      await backend.signInWithPassword(username, password);
      nav('/', { replace: true }); // always land on Home after signing in
    } catch (err) {
      setErrors({ form: errMsg(err) });
      setPassword('');
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
          <p className="muted mx-auto mt-3 max-w-[18rem] text-[15px]">A private space for the two of you.</p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={username} onChange={(e) => { setUsername(e.target.value); setErrors({}); }} aria-invalid={!!errors.username} aria-describedby={errors.username ? 'username-err' : undefined} />
            {errors.username && <p id="username-err" className="err">{errors.username}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" className="input pr-12" type={show ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => { setPassword(e.target.value); setErrors({}); }} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined} />
              <button type="button" className="icon-btn absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                {show ? <EyeOff size={17} strokeWidth={1.6} /> : <Eye size={17} strokeWidth={1.6} />}
              </button>
            </div>
            {errors.password && <p id="password-err" className="err">{errors.password}</p>}
          </div>
          {errors.form && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[14px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" role="alert">{errors.form}</p>}
          <button className="btn-dark w-full" disabled={busy}>{busy ? <><Spinner className="h-4 w-4" /> Signing in…</> : 'Sign in'}</button>
        </form>

        {mode === 'local' && <p className="muted mt-8 text-center text-[12px]">Demo mode — accounts and data live on this device only.</p>}
      </div>
    </main>
  );
}
