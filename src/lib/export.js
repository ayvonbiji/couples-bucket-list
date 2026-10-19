// Export & backup: JSON (full, re-importable), CSV, styled PDF, photo ZIP,
// plus the ID-remapping plan used when restoring a JSON backup.
// All exports are generated in the browser — no server needed — so they work in
// both Demo Mode and Supabase mode.
import { DATA_TABLES } from '../data/tables.js';
import { voteSummary } from './scoring.js';
import { groupByItem, summary } from './stats.js';
import { blobToDataURL } from './image.js';
import { fmtDate, uid } from './utils.js';

export const BACKUP_VERSION = 1;

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------
export function buildJsonBackup({ workspace, members, data }) {
  const payload = {
    app: 'couples-bucket-list',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    workspace: { name: workspace.name, currency: workspace.currency },
    members: members.map((m) => ({ id: m.id, display_name: m.display_name })),
    data: Object.fromEntries(DATA_TABLES.filter((t) => t !== 'backups').map((t) => [t, data[t] || []])),
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

/** Validate an uploaded backup object; throws with a friendly message. */
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid JSON'); }
  if (obj?.app !== 'couples-bucket-list' || !obj.data?.items) throw new Error('That does not look like a bucket-list backup');
  if (obj.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of the app');
  return obj;
}

/**
 * Build insert batches for a restore, remapping every id so a backup can be
 * imported into any workspace (or twice) without collisions.
 * Users from the backup are mapped onto the current partners by position.
 * Returns an ordered array of [table, rows].
 */
export function restorePlan(backup, { workspaceId, meId, partnerId }) {
  const d = backup.data;
  const ids = new Map();
  const newId = (old) => { if (!old) return null; if (!ids.has(old)) ids.set(old, uid()); return ids.get(old); };
  const known = new Set([meId, partnerId].filter(Boolean));
  const userMap = new Map();
  const targets = [meId, partnerId].filter(Boolean);
  (backup.members || []).forEach((m, k) => userMap.set(m.id, known.has(m.id) ? m.id : targets[k] ?? meId));
  const user = (u) => (u ? userMap.get(u) ?? (known.has(u) ? u : meId) : null);

  const strip = (r) => { const { id, workspace_id, ...rest } = r; return rest; }; // eslint-disable-line no-unused-vars
  const items = (d.items || []).map((r) => ({ ...strip(r), id: newId(r.id), workspace_id: workspaceId, created_by: user(r.created_by), owner_user_id: user(r.owner_user_id), cover_photo_id: r.cover_photo_id ? newId(r.cover_photo_id) : null }));
  const itemIds = new Set(items.map((i) => i.id));
  const child = (rows, extra = (x) => x) => (rows || []).map((r) => extra({ ...strip(r), id: newId(r.id), workspace_id: workspaceId, item_id: r.item_id ? newId(r.item_id) : null })).filter((r) => !r.item_id || itemIds.has(r.item_id));

  const journal = child(d.journal_entries, (r) => ({ ...r, created_by: user(r.created_by) }));
  const journalIds = new Set(journal.map((j) => j.id));
  const photos = (d.item_photos || []).map((r) => ({ ...strip(r), id: newId(r.id), workspace_id: workspaceId, item_id: r.item_id ? newId(r.item_id) : null, journal_entry_id: r.journal_entry_id ? newId(r.journal_entry_id) : null, uploaded_by: user(r.uploaded_by) }))
    .filter((p) => (p.item_id && itemIds.has(p.item_id)) || (p.journal_entry_id && journalIds.has(p.journal_entry_id)));

  // Votes: composite key, at most one per user per item after mapping.
  const voteKeys = new Set();
  const votes = (d.item_votes || []).map((r) => ({ item_id: newId(r.item_id), user_id: user(r.user_id), stars: r.stars, workspace_id: workspaceId, updated_at: r.updated_at }))
    .filter((v) => itemIds.has(v.item_id) && !voteKeys.has(`${v.item_id}:${v.user_id}`) && voteKeys.add(`${v.item_id}:${v.user_id}`));
  const reactKeys = new Set();
  const reactions = child(d.item_reactions, (r) => ({ ...r, user_id: user(r.user_id) }))
    .filter((r) => !reactKeys.has(`${r.item_id}:${r.user_id}:${r.emoji}`) && reactKeys.add(`${r.item_id}:${r.user_id}:${r.emoji}`));

  return [
    ['items', items],
    ['subtasks', child(d.subtasks)],
    ['item_links', child(d.item_links, (r) => ({ ...r, created_by: user(r.created_by) }))],
    ['comments', child(d.comments, (r) => ({ ...r, user_id: user(r.user_id) }))],
    ['item_votes', votes],
    ['item_reactions', reactions],
    ['journal_entries', journal],
    ['item_photos', photos],
    ['wishlist_entries', child(d.wishlist_entries, (r) => ({ ...r, created_by: user(r.created_by), for_user_id: user(r.for_user_id) }))],
    ['important_dates', (d.important_dates || []).map((r) => ({ ...strip(r), id: newId(r.id), workspace_id: workspaceId, created_by: user(r.created_by) }))],
  ];
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCsv({ items, votes, members, meId, partnerId }) {
  const name = (id) => (id ? members.find((m) => m.id === id)?.display_name ?? 'Unknown' : 'Both');
  const g = groupByItem(votes);
  const meName = name(meId), partnerName = partnerId ? name(partnerId) : 'Partner';
  const head = ['Title', 'Category', 'Priority', 'Status', 'Owner', 'Added by', 'Timeframe', 'Start date', 'End date', 'Location',
    'Estimated cost', 'Actual cost', 'Currency', 'Saved', 'Savings target', `${meName} vote`, `${partnerName} vote`, 'Mutual score', 'Both want it',
    'Tags', 'Completed on', 'Would do again', 'Description', 'Journal note'];
  const rows = items.map((i) => {
    const v = voteSummary(g.get(i.id) || [], meId, partnerId);
    return [i.title, i.category, i.priority, i.status, name(i.owner_user_id), i.added_by_both ? 'Both' : name(i.created_by), i.timeframe, i.start_date, i.end_date, i.location_name,
      i.est_cost, i.actual_cost, i.currency, i.savings_saved, i.savings_target, v.mine, v.theirs, v.score, v.mutual ? 'yes' : 'no',
      i.tags, i.completed_at, i.would_do_again, i.description, i.completion_note];
  });
  // BOM so Excel opens UTF-8 (₹, emoji) correctly.
  return new Blob(['﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
}

// ---------------------------------------------------------------------------
// Photo ZIP
// ---------------------------------------------------------------------------
const safeName = (s) => (s || 'untitled').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'untitled';

/** Zip photos for one item or every item. `download(path)` returns a Blob. */
export async function buildPhotoZip({ items, photos, journal, download, onProgress }) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const title = new Map(items.map((i) => [i.id, i.title]));
  const jTitle = new Map(journal.map((j) => [j.id, j.title]));
  const list = photos.filter((p) => title.has(p.item_id) || jTitle.has(p.journal_entry_id));
  const captions = {};
  let n = 0;
  for (const p of list.sort((a, b) => a.position - b.position)) {
    const folder = safeName(p.item_id ? title.get(p.item_id) : `Journal - ${jTitle.get(p.journal_entry_id)}`);
    const ext = p.storage_path.split('.').pop();
    const file = `${String(p.position + 1).padStart(2, '0')}${p.caption ? ' - ' + safeName(p.caption) : ''}.${ext}`;
    try {
      zip.folder(folder).file(file, await download(p.storage_path));
      if (p.caption) (captions[folder] ||= []).push(`${file}: ${p.caption}`);
    } catch (e) {
      console.warn('Skipping missing photo', p.storage_path, e);
    }
    onProgress?.(++n, list.length);
  }
  for (const [folder, lines] of Object.entries(captions)) zip.folder(folder).file('captions.txt', lines.join('\n'));
  if (!n) throw new Error('No photos to export yet');
  return zip.generateAsync({ type: 'blob' });
}

// ---------------------------------------------------------------------------
// PDF — "Our Bucket List"
// ---------------------------------------------------------------------------
const ROSE = [199, 59, 69], INK = [42, 30, 34], MUTED = [120, 100, 105], CREAM = [253, 244, 234];
// jsPDF's built-in fonts can't render ₹ or emoji, so money is written as "INR 1,200".
const money = (n, cur) => (n === null || n === undefined || n === '' ? '' : `${cur || ''} ${Number(n).toLocaleString('en-IN')}`.trim());
const ascii = (s) => (s || '').replace(/[^\x20-\x7E -ÿ\n]/g, '').replace(/\s+\n/g, '\n').trim();

/** Re-encode any image blob as a JPEG data URL (jsPDF handles JPEG everywhere). */
async function toJpegDataUrl(blob, maxEdge = 900) {
  const url = await blobToDataURL(blob);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.78), w: c.width, h: c.height };
}

export async function buildPdf({ workspace, members, items, votes, photos, journal, meId, partnerId, download, onProgress }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16;
  let y = M;
  const name = (id) => (id ? members.find((m) => m.id === id)?.display_name ?? '' : 'Both');
  const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const g = groupByItem(votes);
  const photosBy = groupByItem(photos);

  // ---- cover ----
  doc.setFillColor(...CREAM); doc.rect(0, 0, W, H, 'F');
  // A simple vector heart: two circles + a triangle.
  doc.setFillColor(...ROSE);
  doc.circle(W / 2 - 8, 92, 9, 'F'); doc.circle(W / 2 + 8, 92, 9, 'F');
  doc.triangle(W / 2 - 16.6, 95, W / 2 + 16.6, 95, W / 2, 113, 'F');
  doc.setTextColor(...INK); doc.setFont('times', 'bold'); doc.setFontSize(34);
  doc.text(ascii(workspace.name) || 'Our Bucket List', W / 2, 135, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...MUTED);
  doc.text(members.map((m) => ascii(m.display_name)).filter(Boolean).join('  &  '), W / 2, 146, { align: 'center' });
  const s = summary(items);
  doc.setFontSize(11);
  doc.text(`${s.total} dreams  ·  ${s.completed} completed  ·  ${s.pct}% done`, W / 2, 160, { align: 'center' });
  doc.text(`Exported ${fmtDate(new Date())}`, W / 2, H - 24, { align: 'center' });

  const sections = [
    ['Still dreaming', items.filter((i) => i.status !== 'Completed')],
    ['Our memories', items.filter((i) => i.status === 'Completed')],
  ];
  let done = 0;
  for (const [label, list] of sections) {
    if (!list.length) continue;
    doc.addPage(); y = M;
    doc.setFont('times', 'bold'); doc.setFontSize(22); doc.setTextColor(...ROSE); doc.text(label, M, y + 6); y += 14;

    for (const i of list) {
      const v = voteSummary(g.get(i.id) || [], meId, partnerId);
      ensure(30);
      doc.setDrawColor(240, 220, 210); doc.line(M, y, W - M, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK);
      const titleLines = doc.splitTextToSize(ascii(i.title), W - 2 * M - 30);
      doc.text(titleLines, M, y);
      if (v.mutual) { doc.setFontSize(8); doc.setTextColor(...ROSE); doc.text('WE BOTH WANT THIS', W - M, y, { align: 'right' }); }
      y += titleLines.length * 5.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
      const meta = [i.category, i.priority, i.status, i.location_name && ascii(i.location_name), i.start_date && fmtDate(i.start_date), i.timeframe && ascii(i.timeframe), money(i.est_cost, i.currency), `Owner: ${ascii(name(i.owner_user_id))}`].filter(Boolean).join('  ·  ');
      const metaLines = doc.splitTextToSize(meta, W - 2 * M); doc.text(metaLines, M, y); y += metaLines.length * 4.2;
      if (v.mine !== null || v.theirs !== null) { doc.text(`Votes: ${ascii(name(meId))} ${v.mine ?? '-'}/5  ·  ${ascii(name(partnerId)) || 'Partner'} ${v.theirs ?? '-'}/5`, M, y); y += 4.5; }
      doc.setTextColor(...INK); doc.setFontSize(10);
      if (i.description) { const t = doc.splitTextToSize(ascii(i.description), W - 2 * M); ensure(t.length * 4.6); doc.text(t, M, y); y += t.length * 4.6 + 1; }
      if (i.status === 'Completed') {
        const j = journal.find((x) => x.item_id === i.id);
        const note = ascii(i.completion_note || j?.note);
        doc.setTextColor(...ROSE); doc.setFontSize(9);
        doc.text(`Completed ${fmtDate(i.completed_at)}${i.would_do_again ? `  ·  Would do again: ${i.would_do_again}/5` : ''}${i.actual_cost ? `  ·  Spent ${money(i.actual_cost, i.currency)}` : ''}`, M, y); y += 5;
        if (note) { doc.setFont('times', 'italic'); doc.setFontSize(11); doc.setTextColor(...INK); const t = doc.splitTextToSize(`"${note}"`, W - 2 * M); ensure(t.length * 5); doc.text(t, M, y); y += t.length * 5 + 1; doc.setFont('helvetica', 'normal'); }
      }
      // up to 3 photos in a row
      const ps = (photosBy.get(i.id) || []).sort((a, b) => a.position - b.position).slice(0, 3);
      if (ps.length) {
        const cell = (W - 2 * M - 8) / 3, hgt = cell * 0.75;
        ensure(hgt + 4);
        for (const [k, p] of ps.entries()) {
          try {
            const img = await toJpegDataUrl(await download(p.storage_path));
            const r = Math.min(cell / img.w, hgt / img.h);
            doc.addImage(img.data, 'JPEG', M + k * (cell + 4), y, img.w * r, img.h * r);
          } catch (e) { console.warn('PDF: skipped photo', e); }
        }
        y += hgt + 4;
      }
      y += 3;
      onProgress?.(++done, items.length);
    }
  }
  return doc.output('blob');
}
