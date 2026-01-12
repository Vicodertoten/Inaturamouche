import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Spinner from './components/Spinner';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const PlayPage = lazy(() => import('./pages/PlayPage'));
const EndPage = lazy(() => import('./pages/EndPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage').then(m => ({ default: m.CollectionPage })));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="play" element={<PlayPage />} />
            <Route path="end" element={<EndPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

