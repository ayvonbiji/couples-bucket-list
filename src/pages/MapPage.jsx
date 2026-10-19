// Map view: every dream with a pin, coloured by category.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { useDecoratedItems } from '../lib/hooks.js';
import { categoryColor } from '../lib/constants.js';
import { heartIcon, TILE_ATTR, TILE_URL } from '../components/MapBits.jsx';
import { EmptyState, PageHeader, Toggle } from '../components/ui.jsx';
import { StatusText } from '../components/ItemViews.jsx';

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
      <PageHeader title="Map" subtitle={`${pinned.length} place${pinned.length === 1 ? '' : 's'}`} back />
      <div className="space-y-3 px-5 pb-8">
        {pinned.length === 0 ? (
          <EmptyState icon={MapPin} title="No places yet" body="Drop a pin when you add or edit a dream." />
        ) : (
          <div className="h-[60dvh] overflow-hidden rounded-2xl border border-line dark:border-line-dark">
            <MapContainer center={points[0]} zoom={6} className="h-full w-full">
              <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
              <FitBounds points={points} />
              {pinned.map((i) => (
                <Marker key={i.id} position={[i.lat, i.lng]} icon={heartIcon(i.status === 'Completed' ? '#8A8590' : categoryColor(i.category))}>
                  <Popup>
                    <div className="min-w-[150px] space-y-0.5">
                      <b className="block text-[14px] font-medium">{i.title}</b>
                      <StatusText status={i.status} />
                      {i.location_name && <div className="text-[12px] opacity-70">{i.location_name}</div>}
                      <Link to={`/item/${i.id}`} className="block pt-1 text-[13px] font-medium text-rose-600">Open</Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
        <div className="list-group px-4"><Toggle checked={showDone} onChange={setShowDone} label="Show completed" description="Completed places appear in grey" /></div>
        {unpinned > 0 && <p className="muted text-[13px]">{unpinned} dream{unpinned > 1 ? 's have' : ' has'} a place but no pin yet.</p>}
      </div>
    </div>
  );
}
