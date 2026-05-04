import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { Zap, ArrowUp, Plus, FileText, X, ChevronDown, Globe, LayoutTemplate, LogIn, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ModuleCard } from '../components/ModuleCard';
import { CreatorBox } from '../components/CreatorBox';

const MODULE_TYPES = [
  { id: 'guided', title: 'Guided Lesson' },
  { id: 'quick', title: 'Quick Review' },
  { id: 'quiz', title: 'Quiz' },
  { id: 'flashcards', title: 'Flashcards' },
];

export default function Landing() {
  const { openLoginModal } = useAuth();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [moduleType, setModuleType] = useState('guided');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  
  const [publicCourses, setPublicCourses] = useState<any[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // keep it single line if empty, otherwise expand
      textareaRef.current.style.height = content ? `${Math.max(60, textareaRef.current.scrollHeight)}px` : '40px';
    }
  }, [content]);

  useEffect(() => {
    document.title = "LearnForge - What do you want to learn?";
    
    // Fetch public courses for Explore section
    const q = query(
      collection(db, 'courses'),
      where('isPublic', '==', true),
      limit(8)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      courses.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setPublicCourses(courses);
      setLoadingPublic(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFilesAsBase64 = async (files: File[]) => {
    return Promise.all(
      files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          inlineData: {
            data: (reader.result as string).split(',')[1],
            mimeType: file.type || 'application/octet-stream'
          }
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }))
    );
  };

  const handleStart = async () => {
    if (!content.trim() && files.length === 0) return;
    
    // Read files first, save to local storage, then open login modal
    try {
      const fileDataList = await readFilesAsBase64(files);
      localStorage.setItem('pendingModuleGeneration', JSON.stringify({
        content,
        fileDataList,
        moduleType
      }));
      openLoginModal();
    } catch (err) {
      console.error(err);
      alert("Failed to prepare files. Please try again.");
    }
  };

  const activeType = MODULE_TYPES.find(t => t.id === moduleType) || MODULE_TYPES[0];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col items-center selection:bg-indigo-100 selection:text-indigo-900">
      <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />
      
      {/* Navbar */}
      <nav className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">LearnForge</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={openLoginModal}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Log in
          </button>
          <button 
            onClick={openLoginModal}
            className="text-sm font-semibold bg-gray-900 text-white px-5 py-2 rounded-full hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center md:pt-20 px-4 z-10 pb-20">
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-3xl md:text-5xl font-medium tracking-tight text-center text-gray-700 mb-10"
        >
          What do you want to learn?
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full relative"
        >
          {/* Main Prompt Box */}
          <CreatorBox
            content={content}
            setContent={setContent}
            files={files}
            setFiles={setFiles}
            moduleType={moduleType}
            setModuleType={setModuleType}
            onSubmit={handleStart}
            disabled={!content.trim() && files.length === 0}
          />
          
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {['Master React Hooks', 'History of Ancient Rome', 'Intermediate Spanish Quiz'].map(suggest => (
              <button 
                key={suggest}
                onClick={() => setContent(suggest)}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-full text-sm font-medium transition-colors border border-gray-200"
              >
                {suggest}
              </button>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Explore Section */}
      <section className="w-full bg-[#f9fafb] border-t border-gray-100 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <Globe className="w-6 h-6 text-indigo-500" />
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Explore Community Courses</h2>
          </div>

          {loadingPublic ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : publicCourses.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm border-dashed">
              <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No public courses yet</h3>
              <p className="text-gray-500 mt-1 max-w-sm mx-auto">Join the platform and be the first to share your learning modules with the world.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {publicCourses.map((course, idx) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <ModuleCard
                    id={course.id}
                    title={course.title}
                    topic={course.topic}
                    authorName={course.authorName}
                    coverImageUrl={course.coverImageUrl}
                    linkTo={`/book/${course.id}`}
                    statusSlot={
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur-md text-gray-900 border border-black/5 text-[10px] font-bold uppercase rounded-md shadow-sm">
                        Course
                      </div>
                    }
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
