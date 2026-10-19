// Routing + auth gate. Signed-out → Login; signed-in without a partner link → Link screen.
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './store/AppStore.jsx';
import BottomNav from './components/BottomNav.jsx';
import Toasts from './components/Toasts.jsx';
import { Spinner } from './components/ui.jsx';
import LoginPage from './pages/LoginPage.jsx';
import LinkPage from './pages/LinkPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ListPage from './pages/ListPage.jsx';
import ItemDetailPage from './pages/ItemDetailPage.jsx';
import ItemEditPage from './pages/ItemEditPage.jsx';
import TimelinePage from './pages/TimelinePage.jsx';
import MemoriesPage from './pages/MemoriesPage.jsx';
import DatesPage from './pages/DatesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import TrashPage from './pages/TrashPage.jsx';
import GiftsPage from './pages/GiftsPage.jsx';
import ExportPage from './pages/ExportPage.jsx';
import SharePage from './pages/SharePage.jsx';

// Calendar (dnd-kit) and Map (Leaflet) are heavier, so they load on demand.
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));

export default function App() {
  const { user, workspace, loading } = useApp();
  const { pathname } = useLocation();

  // Public read-only share link works signed-out.
  if (pathname.startsWith('/share/')) {
    return (
      <Routes>
        <Route path="/share/:token" element={<SharePage />} />
      </Routes>
    );
  }

  if (loading) return <FullScreenLoader />;
  if (!user) return (<><LoginPage /><Toasts /></>);
  if (!workspace) return (<><LinkPage /><Toasts /></>);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/item/new" element={<ItemEditPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/item/:id/edit" element={<ItemEditPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/memories" element={<MemoriesPage />} />
          <Route path="/dates" element={<DatesPage />} />
          <Route path="/gifts" element={<GiftsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
      <Toasts />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-rose-600">
        <span className="animate-heartbeat text-4xl" aria-hidden>💗</span>
        <Spinner />
      </div>
    </div>
  );
}
