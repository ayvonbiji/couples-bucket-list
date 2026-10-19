// Export & backup: PDF, CSV, JSON, photo ZIP; cloud backups (manual + weekly auto); restore from JSON.
import { useState } from 'react';
import { CloudUpload, FileJson, FileSpreadsheet, FileText, FolderArchive, RotateCcw, Upload } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { buildCsv, buildJsonBackup, buildPdf, buildPhotoZip, parseBackup } from '../lib/export.js';
import { downloadBlob, errMsg, fmtDate, sortBy, timeAgo } from '../lib/utils.js';
import { ConfirmDialog, Modal, PageHeader, Segmented, Spinner } from '../components/ui.jsx';

const stamp = () => new Date().toISOString().slice(0, 10);

export default function ExportPage() {
  const app = useApp();
  const { data, items, me, partner, workspace, membership, backend, backupNow, downloadBackup, restoreBackup, toast } = app;
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState('');
  const [zipScope, setZipScope] = useState('all');
  const [restore, setRestore] = useState(null); // { backup, mode }

  const download = (path) => backend.downloadFile('photos', path);
  const members = membership.members;

  async function go(key, fn) {
    setBusy(key);
    setProgress('');
    try { await fn(); } catch (e) { toast(errMsg(e), 'error'); }
    setBusy(null);
    setProgress('');
  }

  const exports = [
    { key: 'pdf', icon: FileText, title: 'PDF book', desc: '“Our Bucket List” — styled, with photos and memories', run: async () => {
      const blob = await buildPdf({ workspace, members, items, votes: data.item_votes, photos: data.item_photos, journal: data.journal_entries, meId: me.id, partnerId: partner?.id, download, onProgress: (n, t) => setProgress(`${n}/${t}`) });
      downloadBlob(blob, `our-bucket-list-${stamp()}.pdf`);
    } },
    { key: 'csv', icon: FileSpreadsheet, title: 'CSV spreadsheet', desc: 'Items, statuses, votes and costs for Excel / Sheets', run: async () => {
      downloadBlob(buildCsv({ items, votes: data.item_votes, members, meId: me.id, partnerId: partner?.id }), `bucket-list-${stamp()}.csv`);
    } },
    { key: 'json', icon: FileJson, title: 'JSON backup', desc: 'Everything, re-importable below', run: async () => {
      downloadBlob(buildJsonBackup({ workspace, members, data }), `bucket-list-backup-${stamp()}.json`);
    } },
  ];

  const backups = sortBy(data.backups, (b) => b.created_at, -1);

  return (
    <div>
      <PageHeader title="Export & backup" back />
      <div className="space-y-5 px-4 pb-8">
        <section className="space-y-2">
          <h2 className="section-title">Export</h2>
          {exports.map(({ key, icon: Icon, title, desc, run }) => (
            <button key={key} className="card flex w-full items-center gap-3 p-4 text-left transition active:scale-[.99]" disabled={!!busy} onClick={() => go(key, run)}>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50"><Icon size={22} /></span>
              <span className="flex-1"><span className="block font-bold">{title}</span><span className="muted text-xs">{desc}</span></span>
              {busy === key && <span className="flex items-center gap-2 text-xs"><Spinner className="h-4 w-4" />{progress}</span>}
            </button>
          ))}
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50"><FolderArchive size={22} /></span>
              <span className="flex-1"><span className="block font-bold">Photo album ZIP</span><span className="muted text-xs">Original photos in a folder per item</span></span>
            </div>
            <select className="input text-sm" value={zipScope} onChange={(e) => setZipScope(e.target.value)} aria-label="Which photos">
              <option value="all">Whole list ({data.item_photos.length} photos)</option>
              {items.filter((i) => data.item_photos.some((p) => p.item_id === i.id)).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
            <button className="btn-soft w-full" disabled={!!busy} onClick={() => go('zip', async () => {
              const scoped = zipScope === 'all' ? items : items.filter((i) => i.id === zipScope);
              const blob = await buildPhotoZip({ items: scoped, photos: data.item_photos, journal: zipScope === 'all' ? data.journal_entries.filter((j) => !j.item_id) : [], download, onProgress: (n, t) => setProgress(`${n}/${t}`) });
              downloadBlob(blob, `bucket-list-photos-${stamp()}.zip`);
            })}>{busy === 'zip' ? <><Spinner className="h-4 w-4" /> {progress}</> : 'Download ZIP'}</button>
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="section-title flex items-center gap-2"><CloudUpload size={18} /> Cloud backup</h2>
          <p className="muted text-sm">A full JSON snapshot is saved {app.mode === 'supabase' ? 'to your private Supabase storage' : 'in this browser'} automatically every week. Last backup: <b>{workspace.last_backup_at ? `${fmtDate(workspace.last_backup_at)} (${timeAgo(workspace.last_backup_at)})` : 'never'}</b>.</p>
          <button className="btn-primary w-full" disabled={!!busy} onClick={() => go('backup', () => backupNow('manual'))}>{busy === 'backup' ? <Spinner className="h-4 w-4" /> : <CloudUpload size={17} />} Back up now</button>
          {backups.length > 0 && (
            <ul className="divide-y divide-rose-100 text-sm dark:divide-white/5">
              {backups.slice(0, 8).map((b) => (
                <li key={b.id} className="flex items-center gap-2 py-2">
                  <span className="flex-1">{fmtDate(b.created_at, 'd MMM yyyy, HH:mm')} <span className="muted text-xs">· {b.kind} · {b.item_count} items · {Math.round((b.size_bytes || 0) / 1024)} KB</span></span>
                  <button className="btn-ghost px-2 py-1 text-xs" disabled={!!busy} onClick={() => go(`r-${b.id}`, async () => { const backup = await downloadBackup(b); if (backup) setRestore({ backup: parseBackup(JSON.stringify(backup)), mode: 'merge' }); })}>
                    {busy === `r-${b.id}` ? <Spinner className="h-3 w-3" /> : <><RotateCcw size={13} /> Restore</>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="section-title flex items-center gap-2"><Upload size={18} /> Restore from file</h2>
          <p className="muted text-sm">Import a JSON backup exported from this app.</p>
          <label className="btn-soft w-full cursor-pointer">
            <Upload size={16} /> Choose backup file
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
              const f = e.target.files[0]; e.target.value = '';
              if (!f) return;
              try { setRestore({ backup: parseBackup(await f.text()), mode: 'merge' }); } catch (err) { toast(errMsg(err), 'error'); }
            }} />
          </label>
        </section>
      </div>

      {restore && (
        <RestoreDialog restore={restore} setRestore={setRestore} onConfirm={() => restoreBackup(restore.backup, restore.mode)} />
      )}
    </div>
  );
}

function RestoreDialog({ restore, setRestore, onConfirm }) {
  const { backup, mode } = restore;
  const n = backup.data.items?.length ?? 0;
  if (mode === 'replace-confirm') {
    return <ConfirmDialog open danger title="Replace everything?" confirmLabel="Replace" onClose={() => setRestore(null)} onConfirm={onConfirm}
      message="All current items, dates, journal entries and gift ideas will be deleted and replaced by the backup. This can't be undone." />;
  }
  return (
    <Modal open onClose={() => setRestore(null)} title="Restore backup"
      footer={<>
        <button className="btn-ghost flex-1" onClick={() => setRestore(null)}>Cancel</button>
        <button className="btn-primary flex-1" onClick={async () => { if (mode === 'replace') return setRestore({ ...restore, mode: 'replace-confirm' }); await onConfirm(); setRestore(null); }}>Restore</button>
      </>}>
      <p className="text-sm">Backup from <b>{fmtDate(backup.exported_at, 'd MMM yyyy, HH:mm')}</b> — {n} items, {backup.data.item_photos?.length ?? 0} photo records, {backup.data.important_dates?.length ?? 0} dates.</p>
      <div className="mt-4"><Segmented value={mode} onChange={(m) => setRestore({ ...restore, mode: m })} options={[{ value: 'merge', label: 'Add alongside current' }, { value: 'replace', label: 'Replace everything' }]} /></div>
      <p className="muted mt-3 text-xs">Photos are restored by reference: they show up if the original files are still in your storage. Use the Photo ZIP export to keep offline copies.</p>
    </Modal>
  );
}
