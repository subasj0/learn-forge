import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router';
import { LayoutTemplate, Trash2, MoreVertical, Loader2, Globe, Lock } from 'lucide-react';
import { ModuleCard } from '../components/ModuleCard';

interface Course {
  id: string;
  title: string;
  status: 'draft_outline' | 'review_outline' | 'generating_chapters' | 'ready' | 'failed' | 'processing';
  errorMessage?: string;
  createdAt: any;
  isPublic?: boolean;
  authorName?: string;
  coverImageUrl?: string;
}

export default function Library() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = async (courseId: string) => {
    setMenuOpenId(null);
    setDeletingId(courseId);
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (error: any) {
      console.error('Failed to delete course:', error);
      alert(`Failed to delete course: ${error.message}`);
      setDeletingId(null);
    }
  };

  const handleTogglePublic = async (course: Course) => {
    setMenuOpenId(null);
    try {
      await updateDoc(doc(db, 'courses', course.id), { isPublic: !course.isPublic });
    } catch (e) {
      console.error(e);
    }
  };

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
      })) as Course[];
      
      // Sort by creation time descending
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setCourses(docs);
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
        {courses.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {courses.map((course) => {
                const isDeleting = deletingId === course.id;
                const linkTo = course.status === 'ready' || course.status === 'generating_chapters' 
                  ? `/book/${course.id}` 
                  : course.status === 'draft_outline' || course.status === 'review_outline'
                  ? `/create-course/${course.id}`
                  : '#';

                return (
                  <ModuleCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    topic={course.status === 'failed' ? course.errorMessage : 'Interactive AI Course'}
                    authorName={course.authorName || (user?.displayName || user?.email?.split('@')[0]) || 'You'}
                    coverImageUrl={course.coverImageUrl}
                    linkTo={linkTo}
                    isDeleting={isDeleting}
                    statusSlot={
                      <div className="flex items-center gap-2">
                        <StatusBadge status={course.status} />
                        {course.isPublic && (
                          <span className="px-2 py-1 bg-[#1A1E27]/80 backdrop-blur-md text-white border border-white/10 text-[10px] font-bold uppercase rounded-md shadow-sm flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Public
                          </span>
                        )}
                      </div>
                    }
                    actionMenuSlot={
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === course.id ? null : course.id);
                          }}
                          className="p-1 -mr-1 text-white hover:text-gray-300 rounded transition-colors drop-shadow-md"
                          disabled={isDeleting}
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>

                        {menuOpenId === course.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpenId(null); }} />
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-100 rounded-lg shadow-lg overflow-hidden z-20">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTogglePublic(course);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors border-b border-gray-100"
                              >
                                <span className="font-medium">{course.isPublic ? 'Make Private' : 'Make Public'}</span>
                                {course.isPublic ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDelete(course.id);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between transition-colors"
                              >
                                <span className="font-medium">Delete</span>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    }
                  />
                );
              })}
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
