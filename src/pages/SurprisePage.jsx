// Surprise Me as a full page (reached from Home and More).
import { PageHeader } from '../components/ui.jsx';
import { SurpriseContent } from '../components/SurpriseMe.jsx';

export default function SurprisePage() {
  return (
    <div>
      <PageHeader title="Surprise me" back />
      <div className="px-5 pb-10 pt-2">
        <SurpriseContent />
      </div>
    </div>
  );
}
