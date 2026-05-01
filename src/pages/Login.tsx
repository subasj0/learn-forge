import { useAuth } from '../lib/auth';
import { Navigate } from 'react-router';
import { signInWithGoogle } from '../lib/firebase';
import { MonitorPlay } from 'lucide-react';

export default function Login() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#F9FAFB] py-12 px-4 sm:px-6 lg:px-8 w-full h-full">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-gray-200">
        <div className="text-center">
          <MonitorPlay className="mx-auto h-12 w-12 text-indigo-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
            Lumos Systems LearnForge
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            Sign in to start creating interactive modules
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={signInWithGoogle}
            className="group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
