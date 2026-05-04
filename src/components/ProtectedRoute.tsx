import { Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { Lock } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, loading, openLoginModal } = useAuth();

  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#F9FAFB]">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
          <Lock className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Access Restricted</h2>
        <p className="mt-2 text-gray-500 max-w-sm mb-8">
          Please sign in to view this content and interact with your courses.
        </p>
        <button
          onClick={openLoginModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return <Outlet />;
}
