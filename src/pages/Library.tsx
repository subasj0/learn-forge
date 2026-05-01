import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router';
import { Plus, LayoutTemplate, Clock, AlertCircle } from 'lucide-react';

interface Module {
  id: string;
  title: string;
  status: 'draft_outline' | 'review_outline' | 'generating_chapters' | 'ready' | 'failed' | 'processing';
  errorMessage?: string;
  createdAt: any;
}

export default function Library() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'courses'),
      where('userId', '==', user.uid),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Module[];
      
      // Sort by creation time descending
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setModules(docs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading courses...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 flex-1 overflow-y-auto">
        {modules.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <LayoutTemplate className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No courses yet</h3>
            <p className="text-gray-500 mt-1 mb-6">Get started by creating your first interactive course.</p>
            <Link
              to="/home"
              className="inline-flex items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 font-medium rounded-lg transition-colors"
            >
              Create your first course
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Your Courses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((mod) => (
                <div key={mod.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <StatusBadge status={mod.status} />
                    <span className="text-[10px] text-gray-400">
                      Created {mod.createdAt ? new Date(mod.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 truncate">{mod.title || 'Untitled Course'}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">Interactive course generated from your content.</p>
                  
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-50">
                    <span className="text-[10px] text-gray-400">Interactive AI Course</span>
                    {mod.status === 'ready' || mod.status === 'generating_chapters' ? (
                      <Link to={`/book/${mod.id}`} className="text-xs font-bold text-indigo-600">Open Course →</Link>
                    ) : mod.status === 'draft_outline' || mod.status === 'review_outline' ? (
                      <Link to={`/create-course/${mod.id}`} className="text-xs font-bold text-indigo-600">Continue Outline →</Link>
                    ) : (
                      <div className="flex flex-col items-end group/error relative">
                        <span className="text-xs font-bold text-gray-400 cursor-not-allowed">
                          Failed
                        </span>
                        {mod.status === 'failed' && mod.errorMessage && (
                           <div className="hidden group-hover/error:block absolute bottom-full mb-2 right-0 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10 whitespace-normal text-left">
                             {mod.errorMessage}
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'processing' || status === 'generating_chapters') {
    return <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-100">Processing</span>;
  }
  if (status === 'failed') {
    return <span className="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold uppercase rounded border border-red-100">Failed</span>;
  }
  if (status === 'draft_outline' || status === 'review_outline') {
    return <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-100">Outline Phase</span>;
  }
  return <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded border border-green-100">Ready</span>;
}
