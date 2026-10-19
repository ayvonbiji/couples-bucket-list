// Map view: every item with a pin, coloured by category.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDecoratedItems } from '../lib/hooks.js';
import { CATEGORY_META } from '../lib/constants.js';
import { heartIcon, TILE_ATTR, TILE_URL } from '../components/MapBits.jsx';
import { EmptyState, PageHeader, Toggle } from '../components/ui.jsx';
import { StatusPill } from '../components/ItemViews.jsx';
import { useEffect } from 'react';

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 10);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [points, map]);
  return null;
}

export default function MapPage() {
  const all = useDecoratedItems();
  const [showDone, setShowDone] = useState(true);
  const pinned = useMemo(() => all.filter((i) => i.lat !== null && i.lat !== undefined && (showDone || i.status !== 'Completed')), [all, showDone]);
  const points = useMemo(() => pinned.map((i) => [i.lat, i.lng]), [pinned]);
  const unpinned = all.filter((i) => i.location_name && (i.lat === null || i.lat === undefined)).length;

  return (
    <div>
      <PageHeader title="Map" subtitle={`${pinned.length} places on our list`} back="/list" />
      <div className="space-y-3 px-4 pb-6">
        <Toggle checked={showDone} onChange={setShowDone} label="Show completed" />
        {pinned.length === 0 ? (
          <EmptyState emoji="📍" title="No pins yet" body="Add a map pin when you create or edit an item." />
        ) : (
          <div className="h-[62dvh] overflow-hidden rounded-2xl shadow-soft">
            <MapContainer center={points[0]} zoom={6} className="h-full w-full">
              <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
              <FitBounds points={points} />
              {pinned.map((i) => {
                const m = CATEGORY_META[i.category] || CATEGORY_META.Other;
                return (
                  <Marker key={i.id} position={[i.lat, i.lng]} icon={heartIcon(i.status === 'Completed' ? '#10b981' : m.color, m.emoji)}>
                    <Popup>
                      <div className="min-w-[160px] space-y-1">
                        <b className="block text-[14px]">{i.title}</b>
                        <StatusPill status={i.status} />
                        {i.location_name && <div className="text-xs opacity-70">{i.location_name}</div>}
                        <Link to={`/item/${i.id}`} className="block text-sm font-bold text-rose-600">Open →</Link>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}
        {unpinned > 0 && <p className="muted text-xs">{unpinned} item{unpinned > 1 ? 's have' : ' has'} a location but no pin yet.</p>}
        <p className="muted text-xs">Completed places show as green hearts.</p>
      </div>
    </div>
  );
}
