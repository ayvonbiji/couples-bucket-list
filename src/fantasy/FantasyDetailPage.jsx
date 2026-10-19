// One fantasy: the entry, private notes, sharing, partner reactions, consent and discussion.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Lock, MessageCircle, Pencil, Send, Shield, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useFantasy } from './FantasyLayout.jsx';
import { REACTIONS, hasConsent, hasMutualInterest, reactionLabel, statusLabel } from '../lib/fantasy.js';
import { cn, fmtDate, timeAgo } from '../lib/utils.js';
import { Avatar, ConfirmDialog, Disclosure, EmptyState, StoredImage, Toggle } from '../components/ui.jsx';

export default function FantasyDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, partner, personLabel } = useApp();
  const f = useFantasy();
  const fantasy = f.data.fantasies.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(null); // 'share' | 'unshare' | 'delete'

  if (!fantasy) {
    return (
      <div>
        <div className="px-3 pt-[max(env(safe-area-inset-top),0.6rem)]"><button className="icon-btn" onClick={() => nav('/fantasy')} aria-label="Back"><ChevronLeft size={22} strokeWidth={1.75} /></button></div>
        <EmptyState icon={Lock} title="Not available" body="It may have been deleted, or made private by its author." />
      </div>
    );
  }

  const mine = fantasy.created_by === me.id;
  const isPrivate = fantasy.status === 'private';
  const responses = f.responsesFor(id);
  const myResponse = responses.find((r) => r.user_id === me.id) || {};
  const otherResponse = responses.find((r) => r.user_id !== me.id) || null;
  const consent = hasConsent(responses, f.memberIds);
  const mutual = hasMutualInterest(fantasy, responses);
  const comments = f.data.fantasy_comments.filter((c) => c.fantasy_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const otherName = partner?.display_name || 'Your partner';

  return (
    <div className="pb-12">
      <div className="sticky top-0 z-20 flex items-center justify-between bg-cream-50/85 px-3 pb-1 pt-[max(env(safe-area-inset-top),0.6rem)] backdrop-blur-xl dark:bg-ink-950/85">
        <button className="icon-btn" onClick={() => nav('/fantasy')} aria-label="Back"><ChevronLeft size={22} strokeWidth={1.75} /></button>
        {mine && <button className="icon-btn" onClick={() => nav(`/fantasy/${id}/edit`)} aria-label="Edit"><Pencil size={17} strokeWidth={1.6} /></button>}
      </div>

      <article className="space-y-8 px-6 pt-2">
        {/* Entry — journal style */}
        <header>
          <p className="muted text-[13px]">{fantasy.category} · {statusLabel(fantasy.status)}{isPrivate && ' · only you'}</p>
          <h1 className="title-serif mt-2 text-[38px] leading-[1.08]">{fantasy.title}</h1>
          <p className="muted mt-2 text-[13px]">
            {mine ? 'Written by you' : `From ${personLabel(fantasy.created_by)}`} · {fmtDate(fantasy.created_at, 'd MMMM yyyy')}
            {fantasy.interest_level ? ` · interest ${fantasy.interest_level}/5` : ''}
          </p>
        </header>

        {fantasy.image_path && <StoredImage bucket="fantasy" path={fantasy.image_path} className="aspect-[4/3] w-full rounded-2xl" />}
        {fantasy.description && <p className="title-serif whitespace-pre-wrap text-[21px] leading-[1.45] text-ink-700 dark:text-[#D4CFD5]">{fantasy.description}</p>}

        {/* Sharing */}
        {mine && (
          <section className="list-group px-4 py-4">
            {isPrivate ? (
              <>
                <p className="flex items-center gap-2 text-[15px]"><Lock size={15} strokeWidth={1.6} className="text-ink-500" /> Private — only you can see this</p>
                <button className="btn-dark mt-3 w-full" onClick={() => setConfirm('share')}>Share with {otherName}</button>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px]">Shared with {otherName}{fantasy.shared_at ? ` · ${timeAgo(fantasy.shared_at)}` : ''}</p>
                <button className="btn-link text-[13px]" onClick={() => setConfirm('unshare')}>Make private</button>
              </div>
            )}
          </section>
        )}

        {/* Partner reactions */}
        {!isPrivate && (
          <section className="space-y-3">
            <h2 className="section-title">Responses</h2>
            {!mine && (
              <div className="grid grid-cols-2 gap-2">
                {REACTIONS.map((r) => (
                  <button key={r.value} aria-pressed={myResponse.reaction === r.value}
                    onClick={() => f.respond(id, { reaction: myResponse.reaction === r.value ? null : r.value, ...(r.value === 'not_comfortable' ? { comfortable: false } : {}) })}
                    className={cn('min-h-[44px] rounded-xl border px-3 text-[14px] transition',
                      myResponse.reaction === r.value ? 'border-ink-800 bg-ink-800 text-white dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900' : 'border-line dark:border-line-dark')}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            {mine && (
              <p className="text-[15px]">
                {otherResponse?.reaction ? <>{otherName}: <span className="font-medium">{reactionLabel(otherResponse.reaction)}</span></> : <span className="muted">{otherName} hasn’t responded yet.</span>}
              </p>
            )}
            {otherResponse?.boundaries && (
              <p className="rounded-xl bg-cream-100 px-4 py-3 text-[14px] dark:bg-white/5"><span className="muted block text-[12px]">{mine ? `${otherName}’s` : 'Your partner’s'} boundaries</span>{otherResponse.boundaries}</p>
            )}
          </section>
        )}

        {/* Consent */}
        {!isPrivate && (
          <section className="space-y-3">
            <h2 className="section-title">Comfort &amp; boundaries</h2>
            <div className="list-group hairline">
              <div className="px-4 py-2">
                <Toggle checked={Boolean(myResponse.comfortable)} onChange={(on) => f.respond(id, { comfortable: on, ...(on && myResponse.reaction === 'not_comfortable' ? { reaction: null } : {}) })}
                  label="I’m comfortable with this" description="You can change your mind at any time." />
              </div>
              <BoundariesEditor value={myResponse.boundaries || ''} onSave={(b) => f.respond(id, { boundaries: b.trim() || null })} />
              <div className="flex items-center gap-2 px-4 py-3 text-[13px]">
                <Shield size={14} strokeWidth={1.6} className="shrink-0 text-ink-500" />
                <span className="muted">
                  {consent ? 'You’re both comfortable.' : `“Agreed” needs both of you to say you’re comfortable${responses.some((r) => r.reaction === 'not_comfortable') ? ', and nobody to be uncomfortable' : ''}.`}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Status & wishlist */}
        {!isPrivate && (
          <section className="space-y-3">
            <h2 className="section-title">Where we are</h2>
            <div className="grid grid-cols-3 gap-2">
              {[['discussing', 'Discussing'], ['agreed', 'Agreed'], ['completed', 'Completed']].map(([s, l]) => {
                const needsConsent = s !== 'discussing' && !consent && fantasy.status !== s;
                return (
                  <button key={s} disabled={needsConsent} aria-pressed={fantasy.status === s}
                    onClick={() => f.setStatus(id, fantasy.status === s ? 'shared' : s)}
                    className={cn('min-h-[44px] rounded-xl border text-[14px] transition disabled:opacity-35',
                      fantasy.status === s ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300' : 'border-line dark:border-line-dark')}>
                    {fantasy.status === s && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{l}
                  </button>
                );
              })}
            </div>
            <div className="list-group hairline">
              <div className="px-4 py-2">
                <Toggle checked={fantasy.on_wishlist} onChange={(on) => (!on || mutual) && f.setWishlist(id, on)}
                  label="On our wishlist" description={fantasy.on_wishlist ? 'Either of you can remove it.' : mutual ? 'You’re both interested.' : `Available once ${mine ? otherName : 'you'} respond${mine ? 's' : ''} with Love this or Curious.`} />
              </div>
              {(fantasy.on_wishlist || ['agreed', 'completed'].includes(fantasy.status)) && (
                <label className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[15px]">Planned for</span>
                  <input type="date" className="bg-transparent text-right text-[15px] text-ink-600 focus:outline-none dark:text-[#B9B3BA]" value={fantasy.planned_date || ''} onChange={(e) => f.setPlannedDate(id, e.target.value)} aria-label="Planned date" />
                </label>
              )}
            </div>
          </section>
        )}

        {/* Private notes */}
        <Disclosure title="My private notes" icon={Lock} meta="only you">
          <NotesEditor fantasyId={id} />
        </Disclosure>

        {/* Discussion */}
        {!isPrivate && (
          <Disclosure title="Talk about it" icon={MessageCircle} meta={comments.length || ''} defaultOpen={comments.length > 0}>
            <Discussion fantasyId={id} comments={comments} />
          </Disclosure>
        )}

        {mine && (
          <button className="btn-ghost w-full text-rose-700 dark:text-rose-300" onClick={() => setConfirm('delete')}><Trash2 size={16} strokeWidth={1.6} /> Delete</button>
        )}
      </article>

      <ConfirmDialog open={confirm === 'share'} title={`Share with ${otherName}?`} confirmLabel="Share"
        message={`${otherName} will be able to read this entry and respond. Your personal notes stay private. You can make it private again at any time.`}
        onClose={() => setConfirm(null)} onConfirm={() => f.share(id)} />
      <ConfirmDialog open={confirm === 'unshare'} title="Make private again?" confirmLabel="Make private"
        message={`${otherName} will no longer see this entry. It also comes off your wishlist.`}
        onClose={() => setConfirm(null)} onConfirm={() => f.unshare(id)} />
      <ConfirmDialog open={confirm === 'delete'} title="Delete this entry?" danger confirmLabel="Delete"
        message="It will be deleted for both of you, with its responses, notes and image. This can’t be undone."
        onClose={() => setConfirm(null)} onConfirm={async () => { await f.remove(id); nav('/fantasy', { replace: true }); }} />
    </div>
  );
}

function BoundariesEditor({ value, onSave }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="px-4 py-3">
      <span className="label">My boundaries <span className="muted font-normal">· visible to both of you</span></span>
      <textarea className="input min-h-[70px] resize-none" maxLength={2000} placeholder="Anything that matters to you — limits, conditions, what would make it feel right."
        value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onSave(text)} aria-label="My boundaries" />
    </div>
  );
}

function NotesEditor({ fantasyId }) {
  const { me } = useApp();
  const { data, saveNotes } = useFantasy();
  const saved = data.fantasy_notes.find((n) => n.fantasy_id === fantasyId && n.user_id === me.id)?.notes || '';
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  return (
    <div>
      <textarea className="input min-h-[100px] resize-none" maxLength={5000} placeholder="Thoughts just for you." value={text} onChange={(e) => setText(e.target.value)} aria-label="Private notes" />
      {text !== saved && <button className="btn-dark mt-2 w-full" onClick={() => saveNotes(fantasyId, text)}>Save note</button>}
    </div>
  );
}

function Discussion({ fantasyId, comments }) {
  const { me, partner, personLabel } = useApp();
  const { addComment, deleteComment } = useFantasy();
  const [text, setText] = useState('');
  return (
    <div>
      <ul className="space-y-3">
        {comments.map((c) => {
          const isMine = c.user_id === me.id;
          return (
            <li key={c.id} className={cn('flex items-end gap-2', isMine && 'flex-row-reverse')}>
              <Avatar user={isMine ? me : partner} size={24} />
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2', isMine ? 'rounded-br-md bg-ink-800 text-white dark:bg-cream-100 dark:text-ink-900' : 'rounded-bl-md bg-cream-100 dark:bg-white/5')}>
                <p className="whitespace-pre-wrap text-[15px]">{c.body}</p>
                <p className={cn('mt-0.5 text-[11px]', isMine ? 'opacity-60' : 'muted')}>
                  {personLabel(c.user_id)} · {timeAgo(c.created_at)}
                  {isMine && <button className="ml-2 underline" onClick={() => deleteComment(c.id)}>Delete</button>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {!comments.length && <p className="muted text-[14px]">No pressure. Say what you feel.</p>}
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && (await addComment(fantasyId, text))) setText(''); }}>
        <input className="input py-2" maxLength={2000} placeholder="Write a message" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
        <button className="btn-primary min-h-[42px] px-3" disabled={!text.trim()} aria-label="Send"><Send size={16} strokeWidth={1.75} /></button>
      </form>
    </div>
  );
}
