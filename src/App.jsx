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
import MorePage from './pages/MorePage.jsx';
import SurprisePage from './pages/SurprisePage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';
import Sidebar from './components/Sidebar.jsx';

// Heavier or private areas load on demand.
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
// Secret Fantasy is its own chunk with its own data provider and lock — nothing loads until opened.
const FantasyLayout = lazy(() => import('./fantasy/FantasyLayout.jsx'));
const FantasyListPage = lazy(() => import('./fantasy/FantasyListPage.jsx'));
const FantasyDetailPage = lazy(() => import('./fantasy/FantasyDetailPage.jsx'));
const FantasyEditPage = lazy(() => import('./fantasy/FantasyEditPage.jsx'));

export default function App() {
  const { user, workspace, loading, needsSetup, finishSetup } = useApp();
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
  // Every protected route renders the login screen until there is a valid session.
  if (needsSetup) return (<><SetupPage onDone={finishSetup} /><Toasts /></>);
  if (!user) return (<><LoginPage /><Toasts /></>);
  if (!workspace) return (<><LinkPage /><Toasts /></>);

  return (
    <div className="lg:flex">
    <Sidebar />
    <div className="mx-auto min-h-dvh w-full max-w-2xl pb-28 lg:pb-12">
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/item/new" element={<ItemEditPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/item/:id/edit" element={<ItemEditPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/memories" element={<MemoriesPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/surprise" element={<SurprisePage />} />
          <Route path="/dates" element={<DatesPage />} />
          <Route path="/gifts" element={<GiftsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/fantasy" element={<FantasyLayout />}>
            <Route index element={<FantasyListPage />} />
            <Route path="new" element={<FantasyEditPage />} />
            <Route path=":id" element={<FantasyDetailPage />} />
            <Route path=":id/edit" element={<FantasyEditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
      <Toasts />
    </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center text-rose-500">
      <Spinner />
    </div>
  );
}
