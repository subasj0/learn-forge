import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { logout } from '../lib/firebase';
import { Home as HomeIcon, LogOut, User, Zap, Library as LibraryIcon, LogIn } from 'lucide-react';

export default function Navigation() {
  const { user, openLoginModal } = useAuth();

  if (!user) return null;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold"><Zap className="h-4 w-4" /></div>
        <span className="font-bold text-xl tracking-tight text-gray-900">LearnForge</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        <Link to="/home" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors">
          <HomeIcon className="w-5 h-5" />
          Home
        </Link>
        <Link to="/library" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md font-medium text-sm transition-colors">
          <LibraryIcon className="w-5 h-5" />
          Library
        </Link>
      </nav>

      {user ? (
        <div className="p-4 border-t border-gray-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-gray-600 p-2 transition-colors focus:outline-none"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={openLoginModal}
            className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 font-semibold py-2 px-4 rounded-lg hover:bg-indigo-100 transition-colors focus:outline-none"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </button>
        </div>
      )}
    </aside>
  );
}
