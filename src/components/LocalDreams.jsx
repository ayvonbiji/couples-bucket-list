// One-time rescue for dreams that were saved only in this browser.
// Before the shared database was connected, the app ran in Demo Mode and kept everything in this
// browser's storage, so each phone had its own separate list. Once Supabase is connected, this
// offers to copy those dreams into the shared list (sample dreams are left unticked).
import { useMemo, useState } from 'react';
import { ChevronRight, Upload } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { seedItems } from '../lib/seed.js';
import { Modal } from './ui.jsx';
import { CompleteCheck } from './ItemViews.jsx';

const DB_KEY = 'cbl:db:v1';
const DONE_KEY = 'cbl:local-dreams-handled';
const SAMPLE_TITLES = new Set(seedItems('x').map((i) => i.title));

function readLocalDreams() {
  try {
    if (localStorage.getItem(DONE_KEY)) return [];
    const db = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
    return (db?.items || []).filter((i) => !i.is_deleted && i.title)
      .map((i) => ({ ...i, _subtasks: (db.subtasks || []).filter((s) => s.item_id === i.id) }));
  } catch { return []; }
}
const markHandled = () => { try { localStorage.setItem(DONE_KEY, new Date().toISOString()); } catch { /* ignore */ } };

export default function LocalDreams() {
  const { mode, items, importLocalDreams } = useApp();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const shared = useMemo(() => new Set(items.map((i) => i.title.trim().toLowerCase())), [items]);
  const local = useMemo(() => (mode === 'supabase' ? readLocalDreams() : []).filter((i) => !shared.has(i.title.trim().toLowerCase())), [mode, shared]);
  const [picked, setPicked] = useState(() => new Set());
  const [touched, setTouched] = useState(false);
  const chosen = touched ? picked : new Set(local.filter((i) => !SAMPLE_TITLES.has(i.title)).map((i) => i.id));
  const [busy, setBusy] = useState(false);

  // Only sample dreams on this device → nothing worth bringing over.
  if (hidden || !local.some((i) => !SAMPLE_TITLES.has(i.title))) return null;
  const real = local.filter((i) => !SAMPLE_TITLES.has(i.title)).length;
  const toggle = (id) => { const n = new Set(chosen); n.has(id) ? n.delete(id) : n.add(id); setPicked(n); setTouched(true); };
  async function copy() {
    setBusy(true);
    const ok = await importLocalDreams(local.filter((i) => chosen.has(i.id)));
    setBusy(false);
    if (ok) { markHandled(); setOpen(false); setHidden(true); }
  }

  return (
    <>
      <button className="list-group list-row w-full text-left" onClick={() => setOpen(true)}>
        <Upload size={18} strokeWidth={1.6} className="text-rose-500" />
        <span className="flex-1 text-[14px]">{real} dream{real > 1 ? 's are' : ' is'} saved only on this device. Add {real > 1 ? 'them' : 'it'} to your shared list?</span>
        <ChevronRight size={16} className="text-ink-500" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Dreams on this device"
        footer={<>
          <button className="btn-ghost flex-1" onClick={() => { markHandled(); setHidden(true); setOpen(false); }}>Don’t ask again</button>
          <button className="btn-dark flex-1" disabled={busy || !chosen.size} onClick={copy}>Add {chosen.size || ''} to shared list</button>
        </>}>
        <p className="muted mb-3 text-[14px]">These were saved in this browser before the shared database was connected, so your partner can’t see them. Sample dreams are unticked. You can set “Created by” on each one afterwards.</p>
        <ul className="list-group hairline">
          {local.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <CompleteCheck done={chosen.has(i.id)} onToggle={() => toggle(i.id)} label={`Include ${i.title}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{i.title}</span>
                <span className="muted text-[12px]">{i.category} · {i.status}{SAMPLE_TITLES.has(i.title) ? ' · sample' : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
