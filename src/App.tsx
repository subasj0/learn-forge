/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import { AuthProvider, useAuth } from './lib/auth';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import LoginModal from './components/LoginModal';
import Landing from './pages/Landing';

// Lazy load the full app pages to keep the initial bundle lightweight
const Home = React.lazy(() => import('./pages/Home'));
const Library = React.lazy(() => import('./pages/Library'));
const BookViewer = React.lazy(() => import('./pages/book/BookViewer'));

function AppLayout() {
  return (
    <div className="bg-[#F9FAFB] text-[#111827] font-sans h-screen w-full flex overflow-hidden">
      <Navigation />
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] overflow-y-auto">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function MainRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={!user ? <Landing /> : <Navigate to="/home" replace />} />
      
      {/* Shared Dashboard Layout */}
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/library" element={<Library />} />
        </Route>
      </Route>

      {/* Viewers/Editors - use their own isolated layouts */}
      <Route path="/book/:courseId" element={
        <Suspense fallback={
          <div className="h-screen w-full flex items-center justify-center bg-white">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <BookViewer />
        </Suspense>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LoginModal />
      <BrowserRouter>
        <MainRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
