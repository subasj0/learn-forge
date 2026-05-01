/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import { AuthProvider } from './lib/auth';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Library from './pages/Library';
import Viewer from './pages/Viewer';
import BookViewer from './pages/book/BookViewer';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="bg-[#F9FAFB] text-[#111827] font-sans h-screen w-full flex overflow-hidden">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Shared Layout */}
            <Route element={
              <>
                <Navigation />
                <main className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] overflow-y-auto">
                  <Outlet />
                </main>
              </>
            }>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/library" element={<Library />} />
              </Route>
            </Route>

            {/* Viewers/Editors - Protected, use their own isolated layouts */}
            <Route element={<ProtectedRoute />}>
              <Route path="/module/:id" element={<Viewer />} />
              <Route path="/book/:courseId" element={<BookViewer />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
