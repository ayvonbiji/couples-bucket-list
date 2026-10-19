// Settings: profile, partner link, appearance, notifications, Google Calendar, sharing, data, demo tools.
import { useState } from 'react';
import { Bell, Copy, LogOut, Repeat, Share2 } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { DEMO_USERS } from '../data/localBackend.js';
import { CURRENCIES } from '../lib/constants.js';
import { notificationsSupported, requestNotificationPermission } from '../lib/notifications.js';
import { Avatar, ConfirmDialog, PageHeader, SegmentedControl, Toggle } from '../components/ui.jsx';
import { errMsg } from '../lib/utils.js';

const COLORS = ['#C65D70', '#7D6B91', '#6E8FAF', '#6F9884', '#C39A62', '#B0809A', '#6B666D'];

function applyTheme(t) {
  localStorage.setItem('cbl:theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export default function SettingsPage() {
  const { me, partner, workspace, mode, backend, updateProfile, updateWorkspace, switchDemoUser, toast } = useApp();
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
      <PageHeader title="Settings" back />
      <div className="space-y-7 px-5 pb-10">
        {/* Profile */}
        <Group title="You">
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar user={me} size={44} />
            <div className="min-w-0 flex-1">
              <input className="w-full bg-transparent text-[16px] font-medium focus:outline-none" maxLength={40} value={name} onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== me.display_name && updateProfile({ display_name: name.trim() })} aria-label="Display name" />
              <p className="muted truncate text-[13px]">{me.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px]">Colour</span>
            <div className="flex gap-2">{COLORS.map((c) => (
              <button key={c} onClick={() => updateProfile({ avatar_color: c })} aria-label={`Colour ${c}`} aria-pressed={me.avatar_color === c}
                className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-ink-900 ${me.avatar_color === c ? 'ring-[1.5px] ring-ink-800 dark:ring-cream-100' : ''}`} style={{ background: c }} />
            ))}</div>
          </div>
        </Group>

        {/* Partner */}
        <Group title="Partner">
          {partner ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar user={partner} size={36} />
              <div className="min-w-0 flex-1"><p className="text-[15px]">{partner.display_name}</p><p className="muted truncate text-[13px]">{partner.email}</p></div>
              <span className="muted text-[13px]">Linked</span>
            </div>
          ) : (
            <div className="space-y-3 px-4 py-4">
              <p className="text-[14px]">Send this code to your partner. They sign in with their own email and choose “I have a code”.</p>
              <button className="flex w-full items-center justify-between rounded-xl bg-cream-100 px-4 py-3 dark:bg-white/5" onClick={() => copy(workspace.invite_code, 'Invite code copied')}>
                <span className="font-mono text-[20px] tracking-[0.3em]">{workspace.invite_code}</span>
                <Copy size={16} strokeWidth={1.6} className="text-ink-500" />
              </button>
              {navigator.share && <button className="btn-link" onClick={() => navigator.share({ title: 'Join our bucket list', text: `Join our shared bucket list. Sign in at ${window.location.origin} and enter code ${workspace.invite_code}` }).catch(() => {})}><Share2 size={14} strokeWidth={1.75} /> Share invite</button>}
            </div>
          )}
        </Group>

        {/* Appearance */}
        <Group title="Appearance">
          <div className="px-4 py-3">
            <SegmentedControl value={theme} onChange={(t) => { setTheme(t); applyTheme(t); }} options={[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </div>
        </Group>

        {/* Reminders */}
        <Group title="Reminders" footer="Reminders appear on this device while the app is open. Add it to your home screen for the best experience.">
          <div className="flex min-h-[52px] items-center justify-between px-4 py-2">
            <span className="flex items-center gap-3 text-[15px]"><Bell size={18} strokeWidth={1.6} className="text-ink-500" /> Notifications</span>
            {perm === 'granted' ? <span className="muted text-[14px]">On</span>
              : perm === 'unsupported' ? <span className="muted text-[14px]">Not supported</span>
              : perm === 'denied' ? <span className="muted text-[14px]">Blocked in browser</span>
              : <button className="btn-link" onClick={async () => setPerm(await requestNotificationPermission())}>Turn on</button>}
          </div>
        </Group>

        {/* List */}
        <Group title="Our list">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="shrink-0 text-[15px]">Name</span>
            <input className="min-w-0 flex-1 bg-transparent text-right text-[15px] text-ink-600 focus:outline-none dark:text-[#B9B3BA]" maxLength={80} value={wsName} onChange={(e) => setWsName(e.target.value)}
              onBlur={() => wsName.trim() && wsName !== workspace.name && updateWorkspace({ name: wsName.trim() }, 'Renamed')} aria-label="List name" />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[15px]">Currency</span>
            <select className="bg-transparent text-right text-[15px] text-ink-600 focus:outline-none dark:text-[#B9B3BA]" value={workspace.currency} onChange={(e) => updateWorkspace({ currency: e.target.value }, 'Currency updated')} aria-label="Currency">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="px-4 py-2">
            <Toggle checked={workspace.share_enabled} onChange={(on) => updateWorkspace({ share_enabled: on }, on ? 'Share link is on' : 'Share link is off')}
              label="Read-only share link" description="Anyone with the link can view the list — never surprises, gifts, notes or Secret Fantasy." />
          </div>
          {workspace.share_enabled && (
            <button className="flex w-full items-center gap-2 px-4 py-3 text-left" onClick={() => copy(shareUrl, 'Link copied')}>
              <span className="muted min-w-0 flex-1 truncate font-mono text-[12px]">{shareUrl}</span><Copy size={15} strokeWidth={1.6} className="text-ink-500" />
            </button>
          )}
        </Group>

        {/* Google Calendar */}
        <Group title="Google Calendar" footer="Google Calendar → Settings → your calendar → Integrate calendar → copy “Secret address in iCal format”. Events show read-only on the Calendar.">
          <div className="flex gap-2 px-4 py-3">
            <input className="input py-2 text-[14px]" inputMode="url" placeholder="https://calendar.google.com/…/basic.ics" value={ical} onChange={(e) => setIcal(e.target.value)} aria-label="Google Calendar iCal address" />
            <button className="btn-soft min-h-[42px] px-4" disabled={ical === (me.gcal_ical_url || '') || (ical && !/^https:\/\//.test(ical))} onClick={() => updateProfile({ gcal_ical_url: ical.trim() || null })}>Save</button>
          </div>
          {mode === 'local' && <p className="muted px-4 pb-3 text-[13px]">Available once Supabase is connected.</p>}
        </Group>

        {mode === 'local' && (
          <Group title="Demo mode" footer="Data lives in this browser. Switch partner to see the list from the other side — surprises, hidden gifts and private fantasies disappear.">
            <button className="list-row" onClick={() => switchDemoUser(DEMO_USERS.find((u) => u.id !== me.id).id)}>
              <Repeat size={18} strokeWidth={1.6} className="text-ink-500" />
              <span className="flex-1 text-[15px]">Switch to {DEMO_USERS.find((u) => u.id !== me.id).display_name}</span>
            </button>
            <button className="list-row text-rose-700 dark:text-rose-300" onClick={() => setConfirmReset(true)}>
              <span className="flex-1 pl-[30px] text-[15px]">Reset demo data</span>
            </button>
          </Group>
        )}

        <button className="btn-ghost w-full" onClick={() => backend.signOut().catch((e) => toast(errMsg(e), 'error'))}><LogOut size={16} strokeWidth={1.6} /> Sign out</button>
      </div>
      <ConfirmDialog open={confirmReset} title="Reset demo?" message="Deletes all demo data in this browser and starts fresh with the sample dreams." danger confirmLabel="Reset"
        onClose={() => setConfirmReset(false)} onConfirm={async () => { await backend.resetAll(); localStorage.removeItem('cbl:demoUser'); window.location.href = '/'; }} />
    </div>
  );
}

function Group({ title, footer, children }) {
  return (
    <section>
      <h2 className="section-title mb-2 px-1">{title}</h2>
      <div className="list-group hairline">{children}</div>
      {footer && <p className="muted mt-2 px-1 text-[13px] leading-snug">{footer}</p>}
    </section>
  );
}
