// Leaflet pieces (lazy-loaded): a pin picker for the item form and a read-only mini map.
// Tiles: OpenStreetMap. Place search: Nominatim (free, CORS-enabled; please keep usage light).
import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search } from 'lucide-react';
import { Spinner } from './ui.jsx';

// A heart-shaped pin as a DivIcon (avoids Leaflet's default image paths breaking under Vite).
export const heartIcon = (color = '#C65D70') =>
  L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
    html: `<span style="display:block;width:22px;height:22px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(37,35,38,.3)"></span>`,
  });

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function ClickToPin({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat !== null && lat !== undefined) map.flyTo([lat, lng], Math.max(map.getZoom(), 11), { duration: 0.6 }); }, [lat, lng, map]);
  return null;
}

/** Pin picker: tap the map or search a place. Calls onChange({lat,lng,name?}). */
export function MapPicker({ lat, lng, query, onChange }) {
  const [q, setQ] = useState(query || '');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const center = lat !== null && lat !== undefined ? [lat, lng] : [10.85, 76.27]; // default: Kerala

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } });
      setResults(await r.json());
    } catch { setResults([]); }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="input" placeholder="Search a place to drop a pin" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
        <button type="button" className="btn-soft px-3" onClick={search} aria-label="Search place">{busy ? <Spinner className="h-4 w-4" /> : <Search size={18} />}</button>
      </div>
      {results.length > 0 && (
        <ul className="list-group hairline max-h-44 overflow-y-auto text-[14px]">
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-cream-50 dark:hover:bg-white/5"
                onClick={() => { onChange({ lat: +r.lat, lng: +r.lon, name: r.display_name.split(',').slice(0, 2).join(',') }); setResults([]); }}>
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="h-56 overflow-hidden rounded-2xl">
        <MapContainer center={center} zoom={lat ? 11 : 6} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
          <ClickToPin onPick={(a, b) => onChange({ lat: a, lng: b })} />
          <FlyTo lat={lat} lng={lng} />
          {lat !== null && lat !== undefined && <Marker position={[lat, lng]} icon={heartIcon()} />}
        </MapContainer>
      </div>
      <p className="muted text-[13px]">Tap the map to place the pin.</p>
    </div>
  );
}

export function MiniMap({ lat, lng }) {
  return (
    <div className="h-40 overflow-hidden rounded-2xl border border-line dark:border-line-dark">
      <MapContainer center={[lat, lng]} zoom={11} className="h-full w-full" scrollWheelZoom={false} dragging={false} zoomControl={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <Marker position={[lat, lng]} icon={heartIcon()} />
      </MapContainer>
    </div>
  );
}
