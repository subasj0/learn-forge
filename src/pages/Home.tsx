import React, { useState, FormEvent, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import localforage from 'localforage';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateLearningModule, FileData } from '../lib/generate';
import { Plus, X, ArrowUp, Zap, BookOpen, Layers, CheckSquare, ChevronDown, FileText } from 'lucide-react';

const MODULE_TYPES = [
  { id: 'guided', icon: BookOpen, title: 'Guided Lesson' },
  { id: 'quick', icon: Zap, title: 'Quick Review' },
  { id: 'quiz', icon: CheckSquare, title: 'Quiz' },
  { id: 'flashcards', icon: Layers, title: 'Flashcards' },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [moduleType, setModuleType] = useState('guided');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  
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
        navigate('/login');
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
    <div className="flex flex-col h-full items-center pt-[15vh] px-4 w-full max-w-4xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-medium text-gray-900 mb-8 tracking-tight">
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

      <div className="w-full max-w-3xl bg-gray-50 border border-gray-200 rounded-3xl p-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-gray-200 focus-within:bg-white relative">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 px-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl max-w-xs shadow-sm">
                <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="text-xs text-gray-700 truncate font-medium">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to learn today?"
          className="w-full bg-transparent border-none focus:ring-0 resize-none text-gray-800 text-base placeholder-gray-400 px-3 py-2 min-h-[80px]"
          style={{ maxHeight: '400px' }}
        />

        <div className="flex items-center justify-between mt-2 pt-2">
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              title="Attach files"
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="application/pdf,text/plain,image/*"
            />

            <div className="relative">
              <button
                onClick={() => setShowTypeMenu(!showTypeMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full text-sm font-medium shadow-sm transition-colors"
              >
                <ActiveIcon className="h-3.5 w-3.5 text-gray-500" />
                {activeType.title}
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>

              {showTypeMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {MODULE_TYPES.map(type => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setModuleType(type.id);
                            setShowTypeMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors
                            ${type.id === moduleType ? 'text-gray-900 bg-gray-50 font-medium' : 'text-gray-600'}
                          `}
                        >
                          <Icon className={`h-4 w-4 ${type.id === moduleType ? 'text-gray-900' : 'text-gray-400'}`} />
                          {type.title}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={loading || (!content.trim() && files.length === 0)}
            className="p-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-sm"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
      {loading && <p className="text-sm text-gray-400 mt-4 animate-pulse">Processing your request...</p>}
    </div>
  );
}
