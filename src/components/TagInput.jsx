// Free-form tags with suggestions from tags already used in the workspace.
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../store/AppStore.jsx';

export default function TagInput({ value = [], onChange }) {
  const { data } = useApp();
  const [text, setText] = useState('');
  const known = useMemo(() => [...new Set(data.items.flatMap((i) => i.tags || []))].sort(), [data.items]);
  const suggestions = known.filter((t) => !value.includes(t) && (!text || t.includes(text.toLowerCase()))).slice(0, 8);

  const add = (t) => {
    const tag = t.trim().toLowerCase().replace(/^#/, '').slice(0, 30);
    if (tag && !value.includes(tag) && value.length < 12) onChange([...value, tag]);
    setText('');
  };

  return (
    <div>
      <div className="input flex min-h-[2.75rem] flex-wrap items-center gap-1.5 py-1.5">
        {value.map((t) => (
          <span key={t} className="chip-quiet">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
          </span>
        ))}
        <input className="min-w-[6rem] flex-1 bg-transparent py-1 outline-none" value={text} placeholder={value.length ? '' : 'weekend, romantic…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (['Enter', ',', ' '].includes(e.key)) { e.preventDefault(); add(text); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)} aria-label="Add tag" />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((t) => <button key={t} type="button" className="chip border border-line text-ink-500 dark:border-line-dark" onClick={() => add(t)}>+ {t}</button>)}
        </div>
      )}
    </div>
  );
}
