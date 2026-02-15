import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Spinner from './components/Spinner';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const PlayPage = lazy(() => import('./pages/PlayPage'));
const EndPage = lazy(() => import('./pages/EndPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const ChallengePage = lazy(() => import('./pages/ChallengePage'));
const SharedCollectionPage = lazy(() => import('./pages/SharedCollectionPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <OfflineIndicator />
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="play" element={<ErrorBoundary><PlayPage /></ErrorBoundary>} />
              <Route path="end" element={<ErrorBoundary><EndPage /></ErrorBoundary>} />
              <Route path="collection" element={<ErrorBoundary><CollectionPage /></ErrorBoundary>} />
              <Route path="collection/share/:token" element={<ErrorBoundary><SharedCollectionPage /></ErrorBoundary>} />
              <Route path="challenge/:token" element={<ErrorBoundary><ChallengePage /></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
              <Route path="legal" element={<LegalPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
