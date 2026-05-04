import React, { useState, FormEvent, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import localforage from 'localforage';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Plus, X, ArrowUp, Zap, BookOpen, Layers, CheckSquare, ChevronDown, FileText, Globe, LayoutTemplate } from 'lucide-react';
import { ModuleCard } from '../components/ModuleCard';
import { CreatorBox } from '../components/CreatorBox';

export interface FileData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

const MODULE_TYPES = [
  { id: 'guided', icon: BookOpen, title: 'Guided Lesson' },
  { id: 'quick', icon: Zap, title: 'Quick Review' },
  { id: 'quiz', icon: CheckSquare, title: 'Quiz' },
  { id: 'flashcards', icon: Layers, title: 'Flashcards' },
];

interface PublicCourse {
  id: string;
  title: string;
  topic?: string;
  authorName?: string;
  coverImageUrl?: string;
  status: 'draft_outline' | 'review_outline' | 'generating_chapters' | 'ready' | 'failed' | 'processing';
  createdAt: any;
}

export default function Home() {
  const { user, openLoginModal } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
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
          
          const displayTitle = 'Generating course...';
          const coursesRef = collection(db, 'courses');
          const newCourseRef = doc(coursesRef);
          const courseId = newCourseRef.id;

          await setDoc(newCourseRef, {
            userId: user.uid,
            authorName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
            title: displayTitle,
            topic: savedContent || 'Generated Course',
            status: 'draft_outline',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          await localforage.setItem(`course_files_${courseId}`, fileDataList);
          
          navigate(`/book/${courseId}`);
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
      console.error("Error fetching public courses:", error);
      setLoadingPublic(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const filesArray = Array.from(selectedFiles);
      setFiles(prev => [...prev, ...filesArray]);
    }
    setTimeout(() => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 0);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const readFilesAsBase64 = async (files: File[]): Promise<FileData[]> => {
    const promises = files.map(file => {
      return new Promise<FileData>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve({
            inlineData: {
              data: base64Data,
              mimeType: file.type || 'application/octet-stream',
            }
          });
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && files.length === 0) return;

    if (!user) {
      setLoading(true);
      try {
        const fileDataList = await readFilesAsBase64(files);
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
      const fileDataList = await readFilesAsBase64(files);
      const displayTitle = 'Generating course...';
      
      const coursesRef = collection(db, 'courses');
      const newCourseRef = doc(coursesRef);
      const courseId = newCourseRef.id;

      await setDoc(newCourseRef, {
        userId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        title: displayTitle,
        topic: content,
        status: 'draft_outline',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await localforage.setItem(`course_files_${courseId}`, fileDataList);

      navigate(`/book/${courseId}`);
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
    <div className="flex flex-col h-full items-center pt-[15vh] px-4 w-full max-w-7xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-medium text-gray-700 mb-8 tracking-tight">
        Welcome to LearnForge.
      </h1>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
        <button 
          onClick={() => handleTemplateClick("I want to learn about the history of Ancient Rome...", "guided")}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors border border-transparent shadow-sm"
        >
          A guided lesson about Ancient Rome...
        </button>
        <button 
          onClick={() => handleTemplateClick("Let's review the principles of React Hooks...", "quick")}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors border border-transparent shadow-sm"
        >
          A quick review of React Hooks...
        </button>
        <button 
          onClick={() => handleTemplateClick("Test me on intermediate Spanish vocabulary...", "quiz")}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors border border-transparent shadow-sm"
        >
          A quiz on Spanish vocabulary...
        </button>
      </div>

      <div className="w-full max-w-3xl relative">
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
      </div>
      {loading && <p className="text-sm text-gray-400 mt-4 animate-pulse">Processing your request...</p>}

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
