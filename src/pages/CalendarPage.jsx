// Calendar: month / week / agenda. Shows dated items, important dates and (read-only) Google Calendar.
// Drag an item to another day to reschedule (mouse or long-press on touch).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import {
  addDays, addMonths, addWeeks, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';
import { useDecoratedItems } from '../lib/hooks.js';
import { occurrenceTitle, occurrencesBetween, yearsAt } from '../lib/recurrence.js';
import { parseICS } from '../lib/ics.js';
import { IMPORTANT_DATE_COLOR, STATUS_META, categoryColor } from '../lib/constants.js';
import { cn, countdownLabel, errMsg, fmtDate, toDate } from '../lib/utils.js';
import { Modal, PageHeader, Segmented, SegmentedControl, Spinner, Toggle } from '../components/ui.jsx';

const iso = (d) => format(d, 'yyyy-MM-dd');
const GCAL_COLOR = '#0ea5e9';

export default function CalendarPage() {
  const { data, me, backend, updateItem, toast } = useApp();
  const nav = useNavigate();
  const items = useDecoratedItems();
  const [view, setView] = useState(() => localStorage.getItem('cbl:calView') || 'month');
  const [cursor, setCursor] = useState(new Date());
  const [colorBy, setColorBy] = useState(() => localStorage.getItem('cbl:calColor') || 'category');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showGcal, setShowGcal] = useState(true);
  const [gcal, setGcal] = useState({ events: [], loading: false, error: null });
  const [daySheet, setDaySheet] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => localStorage.setItem('cbl:calView', view), [view]);
  useEffect(() => localStorage.setItem('cbl:calColor', colorBy), [colorBy]);

  // Read-only Google Calendar overlay (iCal feed URL saved in Settings).
  const icalUrl = me?.gcal_ical_url;
  const loadGcal = async () => {
    if (!icalUrl) return;
    setGcal((g) => ({ ...g, loading: true, error: null }));
    try {
      setGcal({ events: parseICS(await backend.fetchIcal(icalUrl)), loading: false, error: null });
    } catch (e) {
      setGcal({ events: [], loading: false, error: errMsg(e) });
    }
  };
  useEffect(() => { loadGcal(); }, [icalUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visible range for the current view.
  const range = useMemo(() => {
    if (view === 'month') return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
    if (view === 'week') return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
    return { start: new Date(new Date().setHours(0, 0, 0, 0)), end: addDays(new Date(), 90) };
  }, [view, cursor]);

  // Build events keyed by day.
  const byDay = useMemo(() => {
    const m = new Map();
    const push = (day, ev) => { const k = iso(day); if (!m.has(k)) m.set(k, []); m.get(k).push(ev); };
    for (const i of items) {
      if (!i.start_date || (!showCompleted && i.status === 'Completed')) continue;
      const s = toDate(i.start_date), e = toDate(i.end_date) || s;
      if (e < range.start || s > range.end) continue;
      const color = colorBy === 'status' ? STATUS_META[i.status].color : colorBy === 'type' ? '#C65D70' : categoryColor(i.category);
      for (const d of eachDayOfInterval({ start: s < range.start ? range.start : s, end: e > range.end ? range.end : e })) {
        push(d, { id: `item-${i.id}-${iso(d)}`, type: 'item', item: i, title: i.title, color, isStart: iso(d) === i.start_date, done: i.status === 'Completed' });
      }
    }
    for (const d of data.important_dates) {
      for (const occ of occurrencesBetween(d, range.start, range.end)) {
        const y = yearsAt(d, occ);
        push(occ, { id: `date-${d.id}-${iso(occ)}`, type: 'date', date: d, title: occurrenceTitle(d, y), color: IMPORTANT_DATE_COLOR });
      }
    }
    if (showGcal) {
      for (const g of gcal.events) {
        const s = toDate(g.start);
        if (s && s >= range.start && s <= range.end) push(s, { id: `gcal-${g.id}-${g.start}`, type: 'gcal', title: g.title, color: GCAL_COLOR, gcal: g });
      }
    }
    // Important dates first, then items.
    for (const list of m.values()) list.sort((a, b) => (a.type === 'date' ? -1 : 0) - (b.type === 'date' ? -1 : 0));
    return m;
  }, [items, data.important_dates, gcal.events, showGcal, showCompleted, colorBy, range]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 6 } })
  );

  async function onDragEnd({ active, over }) {
    setDragging(null);
    if (!over) return;
    const item = active.data.current?.item;
    const target = over.id;
    if (!item || !target || target === item.start_date) return;
    // Keep the trip length when moving multi-day items.
    const len = item.end_date ? differenceInCalendarDays(toDate(item.end_date), toDate(item.start_date)) : null;
    const patch = { start_date: target, end_date: len !== null ? iso(addDays(toDate(target), len)) : null };
    if (item.status === 'Idea') patch.status = 'Planned';
    const ok = await updateItem(item.id, patch);
    if (ok) toast(`Moved to ${fmtDate(target, 'EEE d MMM')}`, 'info', { label: 'Undo', onClick: () => updateItem(item.id, { start_date: item.start_date, end_date: item.end_date, status: item.status }) });
  }

  const [eventSheet, setEventSheet] = useState(null);
  const openEvent = (ev) => { setDaySheet(null); setEventSheet(ev); };
  const step = (dir) => setCursor((c) => (view === 'month' ? addMonths(c, dir) : addWeeks(c, dir)));
  const title = view === 'month' ? format(cursor, 'MMMM yyyy') : view === 'week' ? `${format(range.start, 'd MMM')} – ${format(range.end, 'd MMM')}` : 'Next 90 days';

  // Countdown chips for the next upcoming items.
  const nextUp = useMemo(() => items.filter((i) => i.start_date && i.status !== 'Completed' && toDate(i.start_date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 6), [items]);

  return (
    <div>
      <PageHeader title="Calendar" actions={<>
        {icalUrl && <button className="icon-btn" onClick={loadGcal} aria-label="Refresh Google Calendar">{gcal.loading ? <Spinner className="h-4 w-4" /> : <RefreshCw size={18} />}</button>}
        <button className="icon-btn" onClick={() => setShowOptions(true)} aria-label="Calendar options"><CalendarPlus size={20} /></button>
      </>} />

      <div className="space-y-3 px-4">
        <div className="flex items-center gap-2">
          <SegmentedControl className="w-full" value={view} onChange={setView} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'agenda', label: 'Agenda' }]} />
        </div>

        {nextUp.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {nextUp.map((i) => (
              <button key={i.id} onClick={() => nav(`/item/${i.id}`)} className="card flex shrink-0 items-center gap-2.5 px-3.5 py-2 text-left">
                <span className="h-6 w-[3px] rounded-full" style={{ background: categoryColor(i.category) }} />
                <span><span className="block max-w-[9rem] truncate text-[14px] font-medium">{i.title}</span><span className="muted text-[12px]">{countdownLabel(i.start_date)}</span></span>
              </button>
            ))}
          </div>
        )}

        {view !== 'agenda' && (
          <div className="flex items-center justify-between">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></button>
            <button className="title-serif text-xl" onClick={() => setCursor(new Date())} title="Jump to today">{title}</button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="Next"><ChevronRight /></button>
          </div>
        )}

        <DndContext sensors={sensors} onDragStart={(e) => setDragging(e.active.data.current)} onDragCancel={() => setDragging(null)} onDragEnd={onDragEnd}>
          {view === 'month' && <MonthGrid range={range} cursor={cursor} byDay={byDay} onDay={setDaySheet} onEvent={openEvent} />}
          {view === 'week' && <WeekList range={range} byDay={byDay} onDay={setDaySheet} onEvent={openEvent} />}
          {view === 'agenda' && <Agenda byDay={byDay} onEvent={openEvent} />}
          <DragOverlay dropAnimation={null}>{dragging ? <Chip ev={dragging} overlay /> : null}</DragOverlay>
        </DndContext>

        <Legend colorBy={colorBy} hasGcal={!!icalUrl && showGcal} />
        {gcal.error && <p className="muted rounded-xl bg-cream-100 px-3.5 py-3 text-[13px] dark:bg-white/5">Google Calendar: {gcal.error}</p>}
        {view !== 'agenda' && <p className="muted pb-4 text-center text-[12px]">Drag a dream to another day to reschedule · tap a day to add</p>}
      </div>

      {/* Day sheet */}
      <Modal open={!!daySheet} onClose={() => setDaySheet(null)} title={daySheet ? fmtDate(daySheet, 'EEEE, d MMMM') : ''}
        footer={<>
          <button className="btn-soft flex-1" onClick={() => nav(`/dates?new=1&date=${daySheet}`)}>Important date</button>
          <button className="btn-primary flex-1" onClick={() => nav(`/item/new?date=${daySheet}`)}><Plus size={16} /> New item</button>
        </>}>
        {(byDay.get(daySheet) || []).length ? (
          <ul className="space-y-1.5">{(byDay.get(daySheet) || []).map((ev) => <li key={ev.id}><EventRow ev={ev} onClick={() => openEvent(ev)} /></li>)}</ul>
        ) : <p className="muted py-6 text-center text-[14px]">Nothing planned — a free day.</p>}
      </Modal>

      {eventSheet && <EventSheet ev={eventSheet} onClose={() => setEventSheet(null)} />}

      {/* Options */}
      <Modal open={showOptions} onClose={() => setShowOptions(false)} title="Calendar options">
        <div className="space-y-4">
          <div><span className="label">Colour by</span><Segmented value={colorBy} onChange={setColorBy} options={[{ value: 'category', label: 'Category' }, { value: 'status', label: 'Status' }, { value: 'type', label: 'Type' }]} /></div>
          <Toggle checked={showCompleted} onChange={setShowCompleted} label="Show completed items" />
          <Toggle checked={showGcal} onChange={setShowGcal} label="Show Google Calendar" description={icalUrl ? 'Read-only overlay from your iCal link' : 'Add your Google Calendar iCal link in Settings'} />
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
function MonthGrid({ range, cursor, byDay, onDay, onEvent }) {
  const days = eachDayOfInterval(range);
  return (
    <div className="card overflow-hidden px-1 pb-1.5 pt-2">
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium uppercase text-ink-700/50 dark:text-cream-100/50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => (
          <DayCell key={iso(d)} day={d} events={byDay.get(iso(d)) || []} faded={!isSameMonth(d, cursor)} onDay={onDay} onEvent={onEvent} compact />
        ))}
      </div>
    </div>
  );
}

function WeekList({ range, byDay, onDay, onEvent }) {
  return (
    <div className="space-y-1.5">
      {eachDayOfInterval(range).map((d) => <DayCell key={iso(d)} day={d} events={byDay.get(iso(d)) || []} onDay={onDay} onEvent={onEvent} />)}
    </div>
  );
}

function DayCell({ day, events, faded, onDay, onEvent, compact }) {
  const id = iso(day);
  const { setNodeRef, isOver } = useDroppable({ id });
  const today = isToday(day);
  if (compact) {
    const shown = events.slice(0, 3);
    return (
      <div ref={setNodeRef} onClick={() => onDay(id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onDay(id)} aria-label={`${format(day, 'd MMMM')}, ${events.length} events`}
        className={cn('min-h-[74px] cursor-pointer rounded-lg p-0.5 transition', faded && 'opacity-40', isOver ? 'bg-rose-100 dark:bg-rose-900/40' : 'hover:bg-cream-100 dark:hover:bg-white/5')}>
        <div className={cn('mx-auto mb-0.5 grid h-6 w-6 place-items-center rounded-full text-[12px]', today && 'bg-rose-600 font-medium text-white')}>{format(day, 'd')}</div>
        <div className="space-y-0.5">
          {shown.map((ev) => <Chip key={ev.id} ev={ev} onClick={(e) => { e.stopPropagation(); onEvent(ev); }} tiny />)}
          {events.length > 3 && <div className="text-center text-[10px] font-medium text-ink-700/60 dark:text-cream-100/60">+{events.length - 3}</div>}
        </div>
      </div>
    );
  }
  return (
    <div ref={setNodeRef} className={cn('flex gap-3 border-b border-line py-3 transition dark:border-line-dark', isOver && 'bg-rose-50 dark:bg-rose-900/20')}>
      <button onClick={() => onDay(id)} className={cn('w-11 shrink-0 rounded-xl py-1 text-center', today ? 'bg-rose-600 text-white' : '')}>
        <div className="text-[10px] font-medium uppercase">{format(day, 'EEE')}</div>
        <div className="title-serif text-xl">{format(day, 'd')}</div>
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        {events.length ? events.map((ev) => <Chip key={ev.id} ev={ev} onClick={() => onEvent(ev)} />) : <button className="muted h-full w-full text-left text-[13px]" onClick={() => onDay(id)}>Add something</button>}
      </div>
    </div>
  );
}

/** Event chip. Item chips on their start day are draggable. */
function Chip({ ev, onClick, tiny, overlay }) {
  const draggable = ev.type === 'item' && ev.isStart && !overlay;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: overlay ? `overlay-${ev.id}` : ev.id, data: ev, disabled: !draggable });
  // Soft tint with a coloured edge: calm, but still colour-coded.
  return (
    <div ref={setNodeRef} {...(draggable ? listeners : {})} {...(draggable ? attributes : {})}
      onClick={onClick} role="button" title={ev.title}
      className={cn('flex cursor-pointer items-center gap-1 truncate rounded-[5px] border-l-2 text-ink-800 dark:text-cream-100',
        tiny ? 'px-1 py-[1px] text-[9.5px] leading-tight' : 'px-2.5 py-1.5 text-[14px]',
        isDragging && 'opacity-30', overlay && 'scale-105 shadow-float', draggable && 'touch-none', ev.done && 'text-ink-500 line-through')}
      style={{ background: `${ev.color}${ev.done ? '14' : '26'}`, borderColor: ev.color }}>
      <span className="truncate">{ev.title}</span>
    </div>
  );
}

function EventRow({ ev, onClick }) {
  return (
    <button onClick={onClick} className="list-row rounded-xl border border-line dark:border-line-dark">
      <span className="h-8 w-[3px] rounded-full" style={{ background: ev.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{ev.title}</span>
        <span className="muted text-[13px]">{ev.type === 'item' ? ev.item.status : ev.type === 'date' ? 'Important date' : 'Google Calendar'}</span>
      </span>
    </button>
  );
}

function Agenda({ byDay, onEvent }) {
  const days = [...byDay.keys()].sort();
  if (!days.length) return <p className="muted py-10 text-center text-[14px]">Nothing in the next 90 days.</p>;
  return (
    <div className="space-y-4 pb-2">
      {days.map((d) => (
        <div key={d}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <h3 className="title-serif font-medium">{fmtDate(d, 'EEE d MMM')}</h3>
            <span className="muted text-[13px]">{countdownLabel(d)}</span>
          </div>
          <ul className="space-y-1.5">{byDay.get(d).map((ev) => <li key={ev.id}><EventRow ev={ev} onClick={() => onEvent(ev)} /></li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function Legend({ colorBy, hasGcal }) {
  const { categories } = useApp();
  const entries = colorBy === 'category' ? categories.map((c) => [c.name, c.color])
    : colorBy === 'status' ? Object.entries(STATUS_META).map(([k, v]) => [k, v.color])
    : [['Bucket item', '#e2555a']];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
      {entries.map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{k}</span>)}
      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: IMPORTANT_DATE_COLOR }} />Important date</span>
      {hasGcal && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: GCAL_COLOR }} />Google Calendar</span>}
    </div>
  );
}

/** Open an event: see it, change its date, or jump to the item / important date. */
function EventSheet({ ev, onClose }) {
  const nav = useNavigate();
  const { updateItem, updateDate } = useApp();
  const isItem = ev.type === 'item', isDate = ev.type === 'date';
  const current = isItem ? ev.item.start_date : isDate ? ev.date.date : ev.gcal?.start;
  const [date, setDate] = useState(current || '');
  async function save() {
    if (!date || date === current) return onClose();
    if (isItem) {
      const len = ev.item.end_date ? differenceInCalendarDays(toDate(ev.item.end_date), toDate(ev.item.start_date)) : null;
      await updateItem(ev.item.id, { start_date: date, end_date: len !== null ? iso(addDays(toDate(date), len)) : null, ...(ev.item.status === 'Idea' ? { status: 'Planned' } : {}) }, 'Date updated');
    } else if (isDate) await updateDate(ev.date.id, { date });
    onClose();
  }
  return (
    <Modal open onClose={onClose} title={ev.title}
      footer={ev.type === 'gcal' ? <button className="btn-ghost flex-1" onClick={onClose}>Close</button> : <>
        <button className="btn-soft flex-1" onClick={() => { onClose(); nav(isItem ? `/item/${ev.item.id}` : '/dates'); }}>{isItem ? 'Open dream' : 'Open dates'}</button>
        <button className="btn-dark flex-1" onClick={save}>Save date</button>
      </>}>
      <div className="space-y-4">
        <p className="muted text-[14px]">{isItem ? `${ev.item.category} · ${ev.item.status}` : isDate ? 'Important date' : 'Google Calendar (read-only)'}</p>
        {ev.type !== 'gcal' ? (
          <label className="block"><span className="label">{isDate && ev.date.repeats_yearly ? 'Original date (repeats yearly)' : 'Date'}</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        ) : <p className="text-[15px]">{fmtDate(current, 'EEEE d MMMM yyyy')}{ev.gcal?.location ? ` · ${ev.gcal.location}` : ''}</p>}
      </div>
    </Modal>
  );
}
