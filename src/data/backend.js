// Picks the data backend.
//  * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set → Supabase: ONE shared database for both partners.
//  * otherwise → Demo Mode (localStorage in this browser) — but only in local development
//    (`npm run dev`) or when VITE_DEMO_MODE=true. A deployed build without database settings
//    shows "Database not connected" instead of silently giving every browser its own private copy
//    of the list (which is why a partner would see an older/different list).
//
// Both expose the same interface: auth, workspace, generic table CRUD
// (insert/update/upsert/remove/loadAll), file storage, realtime subscribe.
import { createLocalBackend } from './localBackend.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);
export const isDemoAllowed = !isSupabaseConfigured && (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true');
export const isBackendAvailable = isSupabaseConfigured || isDemoAllowed;

let backendPromise;
export function getBackend() {
  backendPromise ||= isSupabaseConfigured
    ? import('./supabaseBackend.js').then((m) => m.createSupabaseBackend(url, key))
    : Promise.resolve(createLocalBackend());
  return backendPromise;
}
