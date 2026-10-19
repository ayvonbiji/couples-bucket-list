// Derived-data hooks shared by list, dashboard, calendar and map.
import { useMemo } from 'react';
import { useApp } from '../store/AppStore.jsx';
import { groupByItem, withVotes } from './stats.js';

/**
 * Items decorated with: _votes (voteSummary), _cover (storage path), _photoCount,
 * _subtasks {done,total}, _comments count. Includes trash only if asked.
 */
export function useDecoratedItems({ includeDeleted = false } = {}) {
  const { data, me, partner } = useApp();
  return useMemo(() => {
    const photos = groupByItem(data.item_photos);
    const subs = groupByItem(data.subtasks);
    const comments = groupByItem(data.comments);
    const base = includeDeleted ? data.items : data.items.filter((i) => !i.is_deleted);
    return withVotes(base, data.item_votes, me?.id, partner?.id).map((i) => {
      const ps = (photos.get(i.id) || []).sort((a, b) => a.position - b.position);
      const cover = ps.find((p) => p.id === i.cover_photo_id) || ps[0];
      const ss = subs.get(i.id) || [];
      return {
        ...i,
        _cover: cover?.storage_path ?? null,
        _photoCount: ps.length,
        _subtasks: { done: ss.filter((s) => s.done).length, total: ss.length },
        _comments: (comments.get(i.id) || []).length,
      };
    });
  }, [data, me?.id, partner?.id, includeDeleted]);
}
