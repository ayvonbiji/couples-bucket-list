// First-run account setup (Demo Mode only). In Supabase mode accounts are created
// with `npm run setup-accounts`, which never exposes passwords to the browser.
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { Spinner } from '../components/ui.jsx';
import { validatePassword, validateUsername } from '../lib/auth.js';
import { errMsg } from '../lib/utils.js';

const blank = { display_name: '', username: '', password: '', confirm: '' };

export default function SetupPage({ onDone }) {
  const { backend } = useApp();
  const [accounts, setAccounts] = useState([{ ...blank }, { ...blank }]);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, patch) => setAccounts((a) => a.map((x, j) => (j === k ? { ...x, ...patch } : x)));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    accounts.forEach((a, k) => {
      const u = validateUsername(a.username); if (u) errs[`${k}.username`] = u;
      const p = validatePassword(a.password, { strict: true }); if (p) errs[`${k}.password`] = p;
      if (a.password !== a.confirm) errs[`${k}.confirm`] = 'Passwords don’t match';
    });
    if (!errs['0.username'] && !errs['1.username'] && accounts[0].username.trim().toLowerCase() === accounts[1].username.trim().toLowerCase()) errs['1.username'] = 'Choose a different username';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await backend.setupAccounts(accounts); onDone(); } catch (err) { setErrors({ form: errMsg(err) }); }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="title-serif text-[38px] leading-tight">Set up your accounts</h1>
      <p className="muted mt-2 text-[15px]">Create a login for each of you. You’ll both share the same list; Secret Fantasy entries stay private until shared.</p>
      <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
        {accounts.map((a, k) => (
          <fieldset key={k} className="space-y-3">
            <legend className="section-title mb-3">{k === 0 ? 'First account' : 'Second account'}</legend>
            <input className="input" placeholder="Name (e.g. Ayvon)" value={a.display_name} onChange={(e) => set(k, { display_name: e.target.value })} aria-label={`Account ${k + 1} name`} />
            <div>
              <input className="input" placeholder="Username" autoCapitalize="none" autoComplete="off" value={a.username} onChange={(e) => set(k, { username: e.target.value })} aria-label={`Account ${k + 1} username`} />
              {errors[`${k}.username`] && <p className="err">{errors[`${k}.username`]}</p>}
            </div>
            <div>
              <input className="input" type={show ? 'text' : 'password'} placeholder="Password" autoComplete="new-password" value={a.password} onChange={(e) => set(k, { password: e.target.value })} aria-label={`Account ${k + 1} password`} />
              {errors[`${k}.password`] && <p className="err">{errors[`${k}.password`]}</p>}
            </div>
            <div>
              <input className="input" type={show ? 'text' : 'password'} placeholder="Confirm password" autoComplete="new-password" value={a.confirm} onChange={(e) => set(k, { confirm: e.target.value })} aria-label={`Account ${k + 1} confirm password`} />
              {errors[`${k}.confirm`] && <p className="err">{errors[`${k}.confirm`]}</p>}
            </div>
          </fieldset>
        ))}
        <button type="button" className="btn-link" onClick={() => setShow(!show)}>{show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? 'Hide passwords' : 'Show passwords'}</button>
        {errors.form && <p className="err" role="alert">{errors.form}</p>}
        <button className="btn-dark w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Create accounts'}</button>
        <p className="muted text-[12px]">Passwords are stored only as salted hashes on this device. At least 8 characters with letters and a number.</p>
      </form>
    </main>
  );
}
