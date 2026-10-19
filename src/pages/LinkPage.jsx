// After first sign-in: create the shared list (partner #1) or join with an invite code (partner #2).
import { useState } from 'react';
import { useApp } from '../store/AppStore.jsx';
import { Field, SegmentedControl, Spinner } from '../components/ui.jsx';
import { CURRENCIES } from '../lib/constants.js';
import { errMsg } from '../lib/utils.js';

export default function LinkPage() {
  const { backend, user, setMembership, toast } = useApp();
  const [tab, setTab] = useState('create');
  const [name, setName] = useState('Our Bucket List');
  const [currency, setCurrency] = useState('INR');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setMembership(await backend.getMembership(user.id));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-6">
      <div className="w-full animate-fade-up">
        <div className="mb-6 text-center">
          <h1 className="title-serif text-[36px] leading-tight">Link your accounts</h1>
          <p className="muted mt-1 text-[14px]">Signed in as {user.email}</p>
        </div>

        <SegmentedControl className="mb-5" value={tab} onChange={(k) => { setTab(k); setError(''); }}
          options={[{ value: 'create', label: 'Start our list' }, { value: 'join', label: 'I have a code' }]} />

        <div className="space-y-4">
          {tab === 'create' ? (
            <>
              <Field label="Name your list"><input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Currency">
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <p className="muted text-xs">You'll get an 8-letter invite code to send your partner. We'll add 5 sample ideas to get you started.</p>
              <button className="btn-dark w-full" disabled={busy || !name.trim()} onClick={() => go(() => backend.createWorkspace(name, currency))}>
                {busy && <Spinner className="h-4 w-4" />} Create our list
              </button>
            </>
          ) : (
            <>
              <Field label="Invite code" hint="Your partner finds it in Settings → Partner">
                <input className="input text-center font-mono text-xl uppercase tracking-[0.3em]" maxLength={8} value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="AB12CD34" />
              </Field>
              <button className="btn-dark w-full" disabled={busy || code.length !== 8} onClick={() => go(() => backend.joinWorkspace(code))}>
                {busy && <Spinner className="h-4 w-4" />} Join our list
              </button>
            </>
          )}
          {error && <p className="err" role="alert">{error}</p>}
        </div>
        <button className="btn-ghost mx-auto mt-4 flex" onClick={() => backend.signOut().catch((e) => toast(errMsg(e), 'error'))}>Sign out</button>
      </div>
    </main>
  );
}
