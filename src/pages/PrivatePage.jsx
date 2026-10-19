// Shown only on a device that hasn't opened its personal link (Supabase mode).
// No form and no buttons: the data stays protected by the database.
import { Heart } from 'lucide-react';

export default function PrivatePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm animate-fade-up text-center">
        <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border border-line text-rose-500 dark:border-line-dark">
          <Heart size={22} strokeWidth={1.5} />
        </span>
        <h1 className="title-serif text-[44px] leading-none">Our Bucket List</h1>
        <p className="muted mx-auto mt-3 max-w-[18rem] text-[15px]">This is a private app. Open your personal link on this device to continue.</p>
      </div>
    </main>
  );
}
