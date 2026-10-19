// Export & backup: PDF, CSV, JSON, photo ZIP; cloud backups (manual + weekly auto); restore from JSON.
import { useState } from 'react';
import { CloudUpload, Download, FileJson, FileSpreadsheet, FileText, FolderArchive, Upload } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { buildCsv, buildJsonBackup, buildPdf, buildPhotoZip, parseBackup } from '../lib/export.js';
import { downloadBlob, errMsg, fmtDate, sortBy, timeAgo } from '../lib/utils.js';
import { ConfirmDialog, Modal, PageHeader, SegmentedControl, Spinner } from '../components/ui.jsx';

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
      <div className="space-y-7 px-5 pb-10">
        <section>
          <h2 className="section-title mb-2 px-1">Export</h2>
          <ul className="list-group hairline">
            {exports.map(({ key, icon: Icon, title, desc, run }) => (
              <li key={key}>
                <button className="list-row" disabled={!!busy} onClick={() => go(key, run)}>
                  <Icon size={19} strokeWidth={1.6} className="text-ink-500" />
                  <span className="flex-1"><span className="block text-[15px]">{title}</span><span className="muted text-[13px]">{desc}</span></span>
                  {busy === key ? <span className="muted flex items-center gap-2 text-[13px]"><Spinner className="h-4 w-4" />{progress}</span> : <Download size={16} strokeWidth={1.6} className="text-ink-500" />}
                </button>
              </li>
            ))}
            <li className="space-y-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <FolderArchive size={19} strokeWidth={1.6} className="text-ink-500" />
                <span className="flex-1"><span className="block text-[15px]">Photo album ZIP</span><span className="muted text-[13px]">Original photos, a folder per dream</span></span>
              </div>
              <div className="flex gap-2">
                <select className="input py-2 text-[14px]" value={zipScope} onChange={(e) => setZipScope(e.target.value)} aria-label="Which photos">
                  <option value="all">Everything ({data.item_photos.length} photos)</option>
                  {items.filter((i) => data.item_photos.some((p) => p.item_id === i.id)).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
                <button className="btn-soft min-h-[42px] shrink-0 px-4" disabled={!!busy} onClick={() => go('zip', async () => {
                  const scoped = zipScope === 'all' ? items : items.filter((i) => i.id === zipScope);
                  const blob = await buildPhotoZip({ items: scoped, photos: data.item_photos, journal: zipScope === 'all' ? data.journal_entries.filter((j) => !j.item_id) : [], download, onProgress: (n, t) => setProgress(`${n}/${t}`) });
                  downloadBlob(blob, `bucket-list-photos-${stamp()}.zip`);
                })}>{busy === 'zip' ? <><Spinner className="h-4 w-4" /> {progress}</> : 'Download ZIP'}</button>
              </div>
            </li>
          </ul>
          <p className="muted mt-2 px-1 text-[13px]">Secret Fantasy is never included in exports or backups.</p>
        </section>

        <section>
          <h2 className="section-title mb-2 px-1">Cloud backup</h2>
          <div className="list-group hairline">
            <div className="px-4 py-4">
              <p className="text-[14px]">A full snapshot is saved {app.mode === 'supabase' ? 'to your private storage' : 'in this browser'} every week.</p>
              <p className="muted mt-0.5 text-[13px]">Last backup: {workspace.last_backup_at ? `${fmtDate(workspace.last_backup_at)} (${timeAgo(workspace.last_backup_at)})` : 'never'}</p>
              <button className="btn-dark mt-4 w-full" disabled={!!busy} onClick={() => go('backup', () => backupNow('manual'))}>{busy === 'backup' ? <Spinner className="h-4 w-4" /> : <CloudUpload size={17} strokeWidth={1.6} />} Back up now</button>
            </div>
            {backups.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1 text-[14px]">{fmtDate(b.created_at, 'd MMM yyyy, HH:mm')} <span className="muted text-[12px]">· {b.kind} · {b.item_count} dreams · {Math.round((b.size_bytes || 0) / 1024)} KB</span></span>
                <button className="btn-link text-[13px]" disabled={!!busy} onClick={() => go(`r-${b.id}`, async () => { const backup = await downloadBackup(b); if (backup) setRestore({ backup: parseBackup(JSON.stringify(backup)), mode: 'merge' }); })}>
                  {busy === `r-${b.id}` ? <Spinner className="h-3 w-3" /> : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title mb-2 px-1">Restore from file</h2>
          <label className="list-group list-row cursor-pointer">
            <Upload size={19} strokeWidth={1.6} className="text-ink-500" />
            <span className="flex-1 text-[15px]">Choose a backup file</span>
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
        <button className="btn-dark flex-1" onClick={async () => { if (mode === 'replace') return setRestore({ ...restore, mode: 'replace-confirm' }); await onConfirm(); setRestore(null); }}>Restore</button>
      </>}>
      <p className="text-[14px]">Backup from <b className="font-medium">{fmtDate(backup.exported_at, 'd MMM yyyy, HH:mm')}</b> — {n} items, {backup.data.item_photos?.length ?? 0} photo records, {backup.data.important_dates?.length ?? 0} dates.</p>
      <div className="mt-4"><SegmentedControl value={mode} onChange={(m) => setRestore({ ...restore, mode: m })} options={[{ value: 'merge', label: 'Add to current' }, { value: 'replace', label: 'Replace all' }]} /></div>
      <p className="muted mt-3 text-[13px]">Photos are restored by reference: they show up if the original files are still in your storage. Use the Photo ZIP export to keep offline copies.</p>
    </Modal>
  );
}
