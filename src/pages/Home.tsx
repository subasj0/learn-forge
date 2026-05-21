import React, { useState, FormEvent, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import localforage from 'localforage';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Plus, X, ArrowUp, Zap, BookOpen, Layers, CheckSquare, ChevronDown, FileText, Globe, LayoutTemplate, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { ModuleCard } from '../components/ModuleCard';
import { CreatorBox, ExtractedFile } from '../components/CreatorBox';
import { createModule } from '../lib/api';

export interface FileData {
  text?: string;
  name: string;
}

const MODULE_TYPES = [
  { id: 'guided', icon: BookOpen, title: 'Guided Lesson' },
  { id: 'interactive', icon: Sparkles, title: 'Interactive Module' },
  { id: 'quick', icon: Zap, title: 'Explore New Topic' },
  { id: 'quiz', icon: CheckSquare, title: 'Quiz' },
  { id: 'flashcards', icon: Layers, title: 'Flashcards' },
];

interface PublicCourse {
  id: string;
  title: string;
  topic?: string;
  authorName?: string;
  coverImageUrl?: string;
  status: 'generating_outline' | 'ready' | 'failed';
  createdAt: any;
}

export default function Home() {
  const { user, openLoginModal } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [moduleType, setModuleType] = useState('guided');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  
  const [publicCourses, setPublicCourses] = useState<PublicCourse[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
    }
  }, [content]);

  useEffect(() => {
    const checkPendingGeneration = async () => {
      if (!user) return;
      const pendingDataStr = localStorage.getItem('pendingModuleGeneration');
      if (pendingDataStr) {
        try {
          const pendingData = JSON.parse(pendingDataStr);
          localStorage.removeItem('pendingModuleGeneration');
          
          setLoading(true);
          const { content: savedContent, fileDataList, moduleType: savedModuleType } = pendingData;
          
          const personalization = JSON.parse(localStorage.getItem('currentPersonalization') || '{}');
          const result = await createModule({
            topic: savedContent || 'Generated Course',
            moduleType: savedModuleType || 'guided',
            personalization: personalization,
            files: fileDataList || [],
          });
          await localforage.setItem(`course_files_${result.courseId}`, fileDataList || []);
          
          navigate(`/book/${result.courseId}`);
        } catch (error) {
          console.error("Error processing pending generation", error);
          setLoading(false);
        }
      }
    };
    checkPendingGeneration();
  }, [user, navigate]);

  useEffect(() => {
    // Fetch public courses
    const q = query(
      collection(db, 'courses'),
      where('isPublic', '==', true),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PublicCourse[];
      
      // Sort by createdAt desc locally to avoid needing composite index just for this
      courses.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setPublicCourses(courses);
      setLoadingPublic(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses/public');
      setLoadingPublic(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && files.length === 0) return;

    if (!user) {
      setLoading(true);
      try {
        const fileDataList = files.filter(f => f.status === 'done').map(f => ({ text: f.text, name: f.name }));
        localStorage.setItem('pendingModuleGeneration', JSON.stringify({
          content,
          fileDataList,
          moduleType
        }));
        openLoginModal();
      } catch (error) {
        console.error("Error preparing files", error);
        alert("Failed to prepare files for login. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    
    try {
      const fileDataList = files.filter(f => f.status === 'done').map(f => ({ text: f.text, name: f.name }));
      const personalization = JSON.parse(localStorage.getItem('currentPersonalization') || '{}');
      const result = await createModule({
        topic: content,
        moduleType: moduleType,
        personalization: personalization,
        files: fileDataList,
      });
      await localforage.setItem(`course_files_${result.courseId}`, fileDataList);

      navigate(`/book/${result.courseId}`);
    } catch (error) {
      console.error("Error creating module", error);
      alert("Failed to submit. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTemplateClick = (text: string, type: string) => {
    setContent(text);
    setModuleType(type);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const activeType = MODULE_TYPES.find(t => t.id === moduleType) || MODULE_TYPES[0];
  const ActiveIcon = activeType.icon;

  return (
    <div className="flex flex-col min-h-full items-center py-12 md:py-24 px-4 w-full max-w-7xl mx-auto overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-50/30 to-transparent pointer-events-none" />
      
      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-3xl md:text-5xl font-medium tracking-tight text-center text-gray-700 mb-10"
      >
        Welcome to LearnForge.
      </motion.h1>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-3xl relative"
      >
        <CreatorBox
          content={content}
          setContent={setContent}
          files={files}
          setFiles={setFiles}
          moduleType={moduleType}
          setModuleType={setModuleType}
          onSubmit={handleSubmit}
          disabled={loading || (!content.trim() && files.length === 0)}
        />
        
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <button 
            onClick={() => handleTemplateClick("I want to learn about the history of Ancient Rome...", "guided")}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-full text-sm font-medium transition-colors border border-gray-200 shadow-sm"
          >
            Ancient Rome History
          </button>
          <button 
            onClick={() => handleTemplateClick("Let's explore a new topic like Quantum Physics...", "quick")}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-full text-sm font-medium transition-colors border border-gray-200 shadow-sm"
          >
            Quantum Physics
          </button>
          <button 
            onClick={() => handleTemplateClick("Test me on intermediate Spanish vocabulary...", "quiz")}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-full text-sm font-medium transition-colors border border-gray-200 shadow-sm"
          >
            Spanish Vocab Quiz
          </button>
        </div>
      </motion.div>

      {loading && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-400 mt-6 animate-pulse"
        >
          Processing your request...
        </motion.p>
      )}

      {/* Explore Section */}
      <div className="w-full mt-16 pb-16">
        <div className="flex items-center gap-2 mb-6">
          <Globe className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold text-gray-900">Explore Public Courses</h2>
        </div>

        {loadingPublic ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : publicCourses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm border-dashed">
            <LayoutTemplate className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No public courses yet</h3>
            <p className="text-sm text-gray-500 mt-1">Be the first to create and share a course.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {publicCourses.map(course => (
              <ModuleCard
                key={course.id}
                id={course.id}
                title={course.title}
                topic={course.topic}
                authorName={course.authorName}
                coverImageUrl={course.coverImageUrl}
                linkTo={`/book/${course.id}`}
                statusSlot={
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1E27]/80 backdrop-blur-md text-white border border-white/10 text-[10px] font-bold uppercase rounded-md shadow-sm">
                    <LayoutTemplate className="w-3 h-3" /> Course
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
