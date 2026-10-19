// One fantasy: entry, status checklist, sharing, partner responses, consent, experience,
// photos (only with both partners' agreement), private notes and discussion.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, EyeOff, ImagePlus, Lock, MessageCircle, Pencil, Send, Shield, Trash2, X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useFantasy } from './FantasyLayout.jsx';
import { FANTASY_STATUSES, REACTIONS, hasConsent, hasMutualInterest, photosAllowed, reactionLabel, statusBlockedReason, statusLabel } from '../lib/fantasy.js';
import { cn, fmtDate, timeAgo } from '../lib/utils.js';
import { Avatar, ConfirmDialog, Disclosure, EmptyState, Modal, Stars, StoredImage, Toggle } from '../components/ui.jsx';

export default function FantasyDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { me, partner, personLabel, toast } = useApp();
  const f = useFantasy();
  const fantasy = f.data.fantasies.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(null); // 'share' | 'unshare' | 'delete'
  const [experience, setExperience] = useState(false);
  useEffect(() => { if (params.get('experience')) { setExperience(true); setParams({}, { replace: true }); } }, [params, setParams]);

  if (!fantasy) {
    return (
      <div>
        <div className="px-3 pt-[max(env(safe-area-inset-top),0.6rem)]"><button className="icon-btn" onClick={() => nav('/fantasy')} aria-label="Back"><ChevronLeft size={22} strokeWidth={1.75} /></button></div>
        <EmptyState icon={Lock} title="Not available" body="It may have been deleted, or made private by its author." />
      </div>
    );
  }

  const mine = fantasy.created_by === me.id;
  const isPrivate = fantasy.visibility === 'private';
  const responses = f.responsesFor(id);
  const myResponse = responses.find((r) => r.user_id === me.id) || {};
  const otherResponse = responses.find((r) => r.user_id !== me.id) || null;
  const consent = hasConsent(responses, f.memberIds);
  const mutual = hasMutualInterest(fantasy, responses);
  const canPhotos = photosAllowed(fantasy, responses, f.memberIds, me.id);
  const photos = f.data.fantasy_photos.filter((p) => p.fantasy_id === id);
  const comments = f.data.fantasy_comments.filter((c) => c.fantasy_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const otherName = partner?.display_name || 'Your partner';

  async function chooseStatus(s) {
    if (s === fantasy.status) return;
    const reason = statusBlockedReason(fantasy, s, responses, f.memberIds);
    if (reason) return toast(reason, 'error');
    if ((await f.setStatus(id, s)) && s === 'completed') setExperience(true);
  }

  return (
    <div className="pb-12">
      <div className="sticky top-0 z-20 flex items-center justify-between bg-cream-50/85 px-3 pb-1 pt-[max(env(safe-area-inset-top),0.6rem)] backdrop-blur-xl dark:bg-ink-950/85">
        <button className="icon-btn" onClick={() => nav('/fantasy')} aria-label="Back"><ChevronLeft size={22} strokeWidth={1.75} /></button>
        {mine && <button className="icon-btn" onClick={() => nav(`/fantasy/${id}/edit`)} aria-label="Edit"><Pencil size={17} strokeWidth={1.6} /></button>}
      </div>

      <article className="space-y-8 px-6 pt-2">
        <header>
          <p className="muted text-[13px]">{fantasy.category} · {statusLabel(fantasy.status)} · {isPrivate ? 'only you' : 'shared'}</p>
          <h1 className="title-serif mt-2 text-[38px] leading-[1.08]">{fantasy.title}</h1>
          <p className="muted mt-2 text-[13px] leading-relaxed">
            {mine ? 'Written by you' : `From ${personLabel(fantasy.created_by)}`} · added {fmtDate(fantasy.created_at, 'd MMM yyyy')}
            {fantasy.planned_date && ` · planned ${fmtDate(fantasy.planned_date, 'd MMM yyyy')}`}
            {fantasy.completed_at && ` · completed ${fmtDate(fantasy.completed_at, 'd MMM yyyy')}`}
            {fantasy.interest_level ? ` · interest ${fantasy.interest_level}/5` : ''}
          </p>
        </header>

        {fantasy.image_path && <StoredImage bucket="fantasy" path={fantasy.image_path} className="aspect-[4/3] w-full rounded-2xl" />}
        {fantasy.description && <p className="title-serif whitespace-pre-wrap text-[21px] leading-[1.45] text-ink-700 dark:text-[#D4CFD5]">{fantasy.description}</p>}

        {/* Sharing (author only) */}
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

        {/* Status — choose any directly */}
        <section className="space-y-2.5">
          <h2 className="section-title">Status</h2>
          <div className="flex flex-wrap gap-1.5">
            {FANTASY_STATUSES.map((s) => {
              const blocked = statusBlockedReason(fantasy, s.value, responses, f.memberIds);
              return (
                <button key={s.value} type="button" aria-pressed={fantasy.status === s.value} aria-disabled={Boolean(blocked)} title={blocked || undefined}
                  className={cn('chip-toggle', blocked && 'opacity-40')} onClick={() => chooseStatus(s.value)}>
                  {fantasy.status === s.value && <Check size={12} strokeWidth={2.5} />}{s.label}
                </button>
              );
            })}
          </div>
          {!isPrivate && !consent && <p className="muted text-[13px]">Agreed, planned, in progress and completed need both of you to say you’re comfortable.</p>}
        </section>

        {/* Experience */}
        {fantasy.status === 'completed' && (
          <section>
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="section-title">How was the experience?</h2>
              <button className="btn-link text-[13px]" onClick={() => setExperience(true)}>{fantasy.experience_note ? 'Edit' : 'Add'}</button>
            </div>
            <div className="list-group px-4 py-4">
              {fantasy.experience_note ? <p className="title-serif whitespace-pre-wrap text-[20px] italic leading-snug">“{fantasy.experience_note}”</p>
                : <button className="muted text-left text-[14px]" onClick={() => setExperience(true)}>A short note about how it went — optional, only for the two of you.</button>}
              {fantasy.experience_rating && <div className="mt-3"><Stars value={fantasy.experience_rating} readOnly size={14} /></div>}
            </div>
          </section>
        )}

        {/* Responses */}
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
                {otherResponse?.reaction ? <>{otherName}: <span className="font-medium">{reactionLabel(otherResponse.reaction)}</span></> : <span className="muted">{otherName} hasn’t responded yet — and doesn’t have to.</span>}
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
                <span className="muted">{consent ? 'You’re both comfortable.' : 'Nothing moves to agreed until you both say you’re comfortable.'}</span>
              </div>
            </div>
          </section>
        )}

        {/* Wishlist & date */}
        {!isPrivate && (
          <section className="list-group hairline">
            <div className="px-4 py-2">
              <Toggle checked={fantasy.on_wishlist} onChange={(on) => (!on || mutual ? f.setWishlist(id, on) : toast('Available once you’re both interested', 'error'))}
                label="On our wishlist" description={fantasy.on_wishlist ? 'Either of you can remove it.' : mutual ? 'You’re both interested.' : `Available once ${mine ? otherName : 'you'} respond${mine ? 's' : ''} with Interested or Curious.`} />
            </div>
            <label className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[15px]">Target date</span>
              <input type="date" className="bg-transparent text-right text-[15px] text-ink-600 focus:outline-none dark:text-[#B9B3BA]" value={fantasy.planned_date || ''} onChange={(e) => f.setPlannedDate(id, e.target.value)} aria-label="Target date" />
            </label>
          </section>
        )}

        {/* Photos — only with agreement */}
        <Disclosure title="Photos" icon={ImagePlus} meta={photos.length || (isPrivate ? 'only you' : '')}>
          <PhotosSection fantasy={fantasy} isPrivate={isPrivate} myResponse={myResponse} otherResponse={otherResponse} canPhotos={canPhotos} photos={photos} otherName={otherName} />
        </Disclosure>

        <Disclosure title="My private notes" icon={Lock} meta="only you">
          <NotesEditor fantasyId={id} />
        </Disclosure>

        {!isPrivate && (
          <Disclosure title="Shared discussion" icon={MessageCircle} meta={comments.length || ''} defaultOpen={comments.length > 0}>
            <Discussion fantasyId={id} comments={comments} />
          </Disclosure>
        )}

        {/* My participation */}
        <section className="list-group px-4 py-1">
          <Toggle checked={Boolean(myResponse.hidden)} onChange={(on) => f.setHiddenForMe(id, on)}
            label="Hide from my list" description="Step back from this without deleting it. You can bring it back any time." />
        </section>

        {mine && (
          <button className="btn-ghost w-full text-rose-700 dark:text-rose-300" onClick={() => setConfirm('delete')}><Trash2 size={16} strokeWidth={1.6} /> Delete</button>
        )}
      </article>

      {experience && <ExperienceSheet fantasy={fantasy} onClose={() => setExperience(false)} />}
      <ConfirmDialog open={confirm === 'share'} title={`Share with ${otherName}?`} confirmLabel="Share"
        message={`${otherName} will be able to read this entry and respond. Sharing doesn’t mean agreeing — each of you responds in your own time. Your personal notes stay private, and you can make it private again at any time.`}
        onClose={() => setConfirm(null)} onConfirm={() => f.share(id)} />
      <ConfirmDialog open={confirm === 'unshare'} title="Make private again?" confirmLabel="Make private"
        message={`${otherName} will no longer see this entry. It also comes off your wishlist.`}
        onClose={() => setConfirm(null)} onConfirm={() => f.unshare(id)} />
      <ConfirmDialog open={confirm === 'delete'} title="Delete this entry?" danger confirmLabel="Delete"
        message="It will be deleted for both of you, with its responses, notes and photos. This can’t be undone."
        onClose={() => setConfirm(null)} onConfirm={async () => { await f.remove(id); nav('/fantasy', { replace: true }); }} />
    </div>
  );
}

function ExperienceSheet({ fantasy, onClose }) {
  const { saveExperience } = useFantasy();
  const [note, setNote] = useState(fantasy.experience_note || '');
  const [rating, setRating] = useState(fantasy.experience_rating || 0);
  return (
    <Modal open onClose={onClose} title="How was the experience?"
      footer={<><button className="btn-ghost flex-1" onClick={onClose}>Later</button>
        <button className="btn-dark flex-1" onClick={async () => { if (await saveExperience(fantasy.id, note, rating)) onClose(); }}>Save</button></>}>
      <div className="space-y-4">
        <p className="muted text-[14px]">Optional. What you enjoyed, what you’d like to remember. You can edit this later.</p>
        <textarea className="input min-h-[140px] resize-none" maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Experience note" />
        <div><span className="label">Rating (optional)</span><Stars value={rating} onChange={setRating} label="Experience rating" /></div>
      </div>
    </Modal>
  );
}

function PhotosSection({ fantasy, isPrivate, myResponse, otherResponse, canPhotos, photos, otherName }) {
  const f = useFantasy();
  const { me } = useApp();
  return (
    <div className="space-y-3">
      {!isPrivate && (
        <>
          <Toggle checked={Boolean(myResponse.allow_photos)} onChange={(on) => f.respond(fantasy.id, { allow_photos: on })}
            label="I’m OK with keeping photos" description={otherResponse?.allow_photos ? `${otherName} is OK with it too.` : `${otherName} also needs to agree.`} />
          {!canPhotos && <p className="muted flex items-center gap-2 text-[13px]"><EyeOff size={13} /> Photos can be added once you both agree.</p>}
        </>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg">
              <StoredImage bucket="fantasy" path={p.storage_path} className="h-full w-full" />
              {(p.uploaded_by === me.id || fantasy.created_by === me.id) && (
                <button className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white" onClick={() => f.deletePhoto(p)} aria-label="Delete photo"><X size={12} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {canPhotos && (
        <label className="btn-soft w-full cursor-pointer">
          <ImagePlus size={16} strokeWidth={1.6} /> Add photos
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; if (files.length) f.addPhotos(fantasy.id, files); }} aria-label="Add photos" />
        </label>
      )}
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
