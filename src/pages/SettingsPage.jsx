// Settings: profile, partner link, appearance, notifications, Google Calendar, sharing, data, demo tools.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarHeart, ChevronRight, Copy, Download, Gift, LogOut, Moon, Repeat, Share2, Trash2, Users } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { DEMO_USERS } from '../data/localBackend.js';
import { CURRENCIES } from '../lib/constants.js';
import { notificationsSupported, requestNotificationPermission } from '../lib/notifications.js';
import { Avatar, ConfirmDialog, Field, PageHeader, Segmented, Toggle } from '../components/ui.jsx';
import { errMsg } from '../lib/utils.js';

const COLORS = ['#e2555a', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#64748b'];

function applyTheme(t) {
  localStorage.setItem('cbl:theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export default function SettingsPage() {
  const { me, partner, workspace, mode, backend, trash, updateProfile, updateWorkspace, switchDemoUser, toast } = useApp();
  const [name, setName] = useState(me.display_name || '');
  const [ical, setIcal] = useState(me.gcal_ical_url || '');
  const [wsName, setWsName] = useState(workspace.name);
  const [theme, setTheme] = useState(() => localStorage.getItem('cbl:theme') || 'system');
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  const [confirmReset, setConfirmReset] = useState(false);
  const shareUrl = `${window.location.origin}/share/${workspace.share_token}`;

  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); toast(msg, 'success'); } catch { toast('Copy failed — select and copy manually', 'error'); }
  };

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="space-y-5 px-4 pb-8">
        {/* Profile */}
        <section className="card space-y-4 p-4">
          <div className="flex items-center gap-3"><Avatar user={me} size={48} /><div><h2 className="section-title">You</h2><p className="muted text-sm">{me.email}</p></div></div>
          <Field label="Display name">
            <div className="flex gap-2">
              <input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn-soft" disabled={!name.trim() || name === me.display_name} onClick={() => updateProfile({ display_name: name.trim() })}>Save</button>
            </div>
          </Field>
          <div><span className="label">Colour</span>
            <div className="flex gap-2">{COLORS.map((c) => (
              <button key={c} onClick={() => updateProfile({ avatar_color: c })} aria-label={`Colour ${c}`} aria-pressed={me.avatar_color === c}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-ink-800 ${me.avatar_color === c ? 'ring-2 ring-ink-800 dark:ring-cream-100' : ''}`} style={{ background: c }} />
            ))}</div>
          </div>
        </section>

        {/* Partner */}
        <section className="card space-y-3 p-4">
          <h2 className="section-title flex items-center gap-2"><Users size={18} /> Partner</h2>
          {partner ? (
            <div className="flex items-center gap-3"><Avatar user={partner} size={40} /><div><b>{partner.display_name}</b><p className="muted text-sm">{partner.email} · linked 💞</p></div></div>
          ) : (
            <>
              <p className="text-sm">Send this invite code to your partner. They sign in with their own email and choose <b>“I have a code”</b>.</p>
              <button className="flex w-full items-center justify-between rounded-2xl bg-rose-50 px-4 py-3 dark:bg-rose-950/40" onClick={() => copy(workspace.invite_code, 'Invite code copied')}>
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-rose-700 dark:text-rose-300">{workspace.invite_code}</span>
                <Copy size={18} />
              </button>
              {navigator.share && <button className="btn-soft w-full" onClick={() => navigator.share({ title: 'Join our bucket list', text: `Join our shared bucket list 💕 Sign in at ${window.location.origin} and enter code ${workspace.invite_code}` }).catch(() => {})}><Share2 size={16} /> Share invite</button>}
            </>
          )}
        </section>

        {/* Shortcuts */}
        <section className="card divide-y divide-rose-100 dark:divide-white/5">
          {[
            ['/dates', CalendarHeart, 'Important dates', 'Birthdays, anniversaries, countdowns'],
            ['/gifts', Gift, 'Gift ideas', 'Hints for me & secret plans'],
            ['/export', Download, 'Export & backup', 'PDF, CSV, JSON, photo ZIP, restore'],
            ['/trash', Trash2, 'Recently deleted', `${trash.length} item${trash.length === 1 ? '' : 's'} in Trash`],
          ].map(([to, Icon, l, d]) => (
            <Link key={to} to={to} className="flex items-center gap-3 p-4">
              <Icon size={20} className="text-rose-600" />
              <span className="flex-1"><span className="block font-bold">{l}</span><span className="muted text-xs">{d}</span></span>
              <ChevronRight size={18} className="muted" />
            </Link>
          ))}
        </section>

        {/* Appearance */}
        <section className="card space-y-3 p-4">
          <h2 className="section-title flex items-center gap-2"><Moon size={18} /> Appearance</h2>
          <Segmented value={theme} onChange={(t) => { setTheme(t); applyTheme(t); }} options={[{ value: 'system', label: 'System' }, { value: 'light', label: '☀️ Light' }, { value: 'dark', label: '🌙 Dark' }]} />
        </section>

        {/* Notifications */}
        <section className="card space-y-2 p-4">
          <h2 className="section-title flex items-center gap-2"><Bell size={18} /> Reminders</h2>
          <p className="muted text-sm">Item reminders and important-date reminders pop up on this device while the app is open (install it to your home screen for best results).</p>
          {perm === 'granted' ? <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">✓ Notifications are on</p>
            : perm === 'unsupported' ? <p className="muted text-sm">This browser doesn't support notifications — reminders still show on the dashboard.</p>
            : perm === 'denied' ? <p className="text-sm">Notifications are blocked. Allow them in your browser's site settings.</p>
            : <button className="btn-soft" onClick={async () => setPerm(await requestNotificationPermission())}>Turn on notifications</button>}
        </section>

        {/* Google Calendar */}
        <section className="card space-y-3 p-4">
          <h2 className="section-title">📆 Google Calendar (read-only)</h2>
          <p className="muted text-sm">In Google Calendar → Settings → your calendar → <i>Integrate calendar</i>, copy the <b>Secret address in iCal format</b> and paste it here. Your events appear on our Calendar view (read-only).</p>
          <div className="flex gap-2">
            <input className="input" inputMode="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value={ical} onChange={(e) => setIcal(e.target.value)} />
            <button className="btn-soft" disabled={ical === (me.gcal_ical_url || '') || (ical && !/^https:\/\//.test(ical))} onClick={() => updateProfile({ gcal_ical_url: ical.trim() || null })}>Save</button>
          </div>
          {mode === 'local' && <p className="text-xs text-amber-700 dark:text-amber-300">Needs Supabase mode (the feed is fetched through a small server function).</p>}
        </section>

        {/* List settings + sharing */}
        <section className="card space-y-4 p-4">
          <h2 className="section-title">Our list</h2>
          <Field label="Name">
            <div className="flex gap-2">
              <input className="input" maxLength={80} value={wsName} onChange={(e) => setWsName(e.target.value)} />
              <button className="btn-soft" disabled={!wsName.trim() || wsName === workspace.name} onClick={() => updateWorkspace({ name: wsName.trim() }, 'Renamed')}>Save</button>
            </div>
          </Field>
          <Field label="Default currency">
            <select className="input" value={workspace.currency} onChange={(e) => updateWorkspace({ currency: e.target.value }, 'Currency updated')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Toggle checked={workspace.share_enabled} onChange={(on) => updateWorkspace({ share_enabled: on }, on ? 'Share link is live' : 'Share link turned off')}
            label="Read-only share link" description="Anyone with the link can view the list (no surprises, gifts or comments). Turn off anytime." />
          {workspace.share_enabled && (
            <button className="flex w-full items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-left text-sm dark:bg-rose-950/40" onClick={() => copy(shareUrl, 'Link copied')}>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{shareUrl}</span><Copy size={16} />
            </button>
          )}
        </section>

        {/* Demo tools */}
        {mode === 'local' && (
          <section className="card space-y-3 border-2 border-dashed border-gold-400 p-4">
            <h2 className="section-title">🧪 Demo Mode</h2>
            <p className="muted text-sm">Data lives in this browser. Switch partner to see the list from the other side — surprises and hidden gifts disappear!</p>
            <button className="btn-soft w-full" onClick={() => switchDemoUser(DEMO_USERS.find((u) => u.id !== me.id).id)}>
              <Repeat size={16} /> Switch to {DEMO_USERS.find((u) => u.id !== me.id).display_name}
            </button>
            <button className="btn-ghost w-full text-red-600" onClick={() => setConfirmReset(true)}>Reset demo data</button>
          </section>
        )}

        <button className="btn-ghost w-full" onClick={() => backend.signOut().catch((e) => toast(errMsg(e), 'error'))}><LogOut size={16} /> Sign out</button>
        <p className="muted text-center text-xs">Made with 💕 · {mode === 'supabase' ? 'Synced with Supabase' : 'Demo Mode'}</p>
      </div>
      <ConfirmDialog open={confirmReset} title="Reset demo?" message="Deletes all demo data in this browser and starts fresh with the sample items." danger confirmLabel="Reset"
        onClose={() => setConfirmReset(false)} onConfirm={async () => { await backend.resetAll(); localStorage.removeItem('cbl:demoUser'); window.location.href = '/'; }} />
    </div>
  );
}
