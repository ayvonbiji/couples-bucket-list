// Privacy settings for Secret Fantasy on this device: PIN and biometric unlock.
import { useEffect, useState } from 'react';
import { useApp } from '../store/AppStore.jsx';
import { Field, Modal, Toggle } from '../components/ui.jsx';
import { biometricsAvailable, clearLock, disableBiometrics, enableBiometrics, getLock, setPin } from './lock.js';

export default function LockSettings({ onClose }) {
  const { me, toast } = useApp();
  const [lock, setLock] = useState(() => getLock(me.id));
  const [pin, setPinValue] = useState('');
  const [bio, setBio] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { biometricsAvailable().then(setBio); }, []);
  const refresh = () => setLock(getLock(me.id));

  async function savePin(e) {
    e.preventDefault();
    try { await setPin(me.id, pin); setPinValue(''); setError(''); refresh(); toast('PIN set', 'success'); } catch (err) { setError(err.message); }
  }

  return (
    <Modal open onClose={onClose} title="Privacy">
      <div className="space-y-6">
        <p className="muted text-[14px] leading-snug">
          Private entries are protected by the database itself — they’re never sent to your partner’s phone. A lock adds a second layer on this device.
        </p>

        <form onSubmit={savePin} className="space-y-3">
          <Field label={lock?.pinHash ? 'Change PIN' : 'Set a PIN'} error={error} hint="4–6 digits, stored only as a secure hash on this device">
            <input className="input text-center tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
              value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} aria-label="PIN" />
          </Field>
          <button className="btn-dark w-full" disabled={pin.length < 4}>{lock?.pinHash ? 'Update PIN' : 'Set PIN'}</button>
        </form>

        {bio && (
          <div className="list-group px-4 py-1">
            <Toggle checked={Boolean(lock?.credentialId)} label="Face ID or fingerprint" description="Unlock with this device’s biometrics"
              onChange={async (on) => {
                try {
                  if (on) await enableBiometrics(me.id, me.display_name); else disableBiometrics(me.id);
                  refresh();
                } catch { toast('Biometric setup was cancelled', 'error'); }
              }} />
          </div>
        )}

        {lock && <button className="btn-ghost w-full text-rose-700 dark:text-rose-300" onClick={() => { clearLock(me.id); refresh(); toast('Lock removed', 'success'); }}>Remove lock from this device</button>}
      </div>
    </Modal>
  );
}
