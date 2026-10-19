// Shown only on a device that hasn't opened its personal link (Supabase mode).
// No form and no buttons: the data stays protected by the database.
import { Heart } from 'lucide-react';

export default function PrivatePage() {
  return <Notice>This is a private app. Open your personal link on this device to continue.</Notice>;
}

/** A deployed build without database settings — never fall back to a per-browser copy of the list. */
export function NotConnectedPage() {
  return (
    <Notice>
      The shared database isn’t connected, so nothing can be saved yet. Add <code className="text-[13px]">VITE_SUPABASE_URL</code> and{' '}
      <code className="text-[13px]">VITE_SUPABASE_ANON_KEY</code> to the hosting settings and redeploy.
    </Notice>
  );
}

function Notice({ children }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm animate-fade-up text-center">
        <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border border-line text-rose-500 dark:border-line-dark">
          <Heart size={22} strokeWidth={1.5} />
        </span>
        <h1 className="title-serif text-[44px] leading-none">Our Bucket List</h1>
        <p className="muted mx-auto mt-3 max-w-[20rem] text-[15px]">{children}</p>
      </div>
    </main>
  );
}
