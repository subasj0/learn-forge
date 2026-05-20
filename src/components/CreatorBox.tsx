import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Settings, Send, Sparkles, ChevronDown, CheckSquare, Layers, FileText, Zap, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MODULE_TYPES = [
  { id: 'guided', icon: BookOpen, title: 'Guided Lesson' },
  { id: 'interactive', icon: Sparkles, title: 'Interactive Module' },
  { id: 'quick', icon: Zap, title: 'Explore New Topic' },
  { id: 'quiz', icon: CheckSquare, title: 'Quiz' },
  { id: 'flashcards', icon: Layers, title: 'Flashcards' },
];

export interface ExtractedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  text?: string;
  status: 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
}

export interface PersonalizationOptions {
  complexity: string;
  intent: string;
  interests: string;
  interactivity: 'minimal' | 'medium' | 'high';
  learningStyle: 'balanced' | 'visual' | 'hands-on';
}

interface CreatorBoxProps {
  content: string;
  setContent: (val: string) => void;
  files: ExtractedFile[];
  setFiles: React.Dispatch<React.SetStateAction<ExtractedFile[]>>;
  moduleType: string;
  setModuleType: (val: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

import { extractTextFromFile } from '../lib/agents/ocr';

export function CreatorBox({
  content,
  setContent,
  files,
  setFiles,
  moduleType,
  setModuleType,
  onSubmit,
  disabled
}: CreatorBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);

  const [personalization, setPersonalization] = useState<PersonalizationOptions>({
    complexity: 'Primary Level',
    intent: '',
    interests: '',
    interactivity: 'medium',
    learningStyle: 'balanced'
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Adjust min height based on whether files are uploaded or content is present
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`;
    }
  }, [content]);

  // Persist personalization across parent re-renders if we want, or eventually lift it up
  // We can pass personalization to localstorage via parent by adding it to onSubmit?
  // Let's fire an event to parent to sync personalization if needed, but doing it in parent is better.
  // Actually, parent doesn't strictly need it unless they do something with it. 
  // Let's modify the signature to not need personalization upstream for now if they don't consume it, 
  // wait we MUST save it to localstorage so that the generation gets it. We can add a function to get it.

  // To not break existing parent, we can dispatch a custom event or let parent read it.
  // We'll update the parent signature to accept personalization on submit later, but for now we can just store in localStorage directly or run onSubmit.

  const textId = React.useId(); // we can use React.useId directly, wait React is imported as default
  const fileInputId = React.useId();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files);
      const newExtractedFiles: ExtractedFile[] = newFiles.map(f => ({
        id: Math.random().toString(36).substring(7),
        name: f.name,
        size: f.size,
        type: f.type,
        status: 'uploading',
        progress: 10
      }));

      setFiles(prev => [...prev, ...newExtractedFiles]);

      if (fileInputRef.current) fileInputRef.current.value = '';

      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const fileRecord = newExtractedFiles[i];
        
        try {
          setFiles(prev => prev.map(f => f.id === fileRecord.id ? { ...f, status: 'processing', progress: 50 } : f));
          const text = await extractTextFromFile(file);
          setFiles(prev => prev.map(f => f.id === fileRecord.id ? { ...f, status: 'done', progress: 100, text } : f));
        } catch (error: any) {
          console.error("OCR failed for", file.name, error);
          setFiles(prev => prev.map(f => f.id === fileRecord.id ? { ...f, status: 'error', progress: 0 } : f));
          if (error.name === 'BudgetExceededError') {
            alert(error.message);
          }
        }
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmitWrapper();
    }
  };

  const onSubmitWrapper = () => {
    if (disabled || (!content.trim() && files.length === 0)) return;
    
    // Save personalization so parent can grab it or the generation script can grab it
    localStorage.setItem('currentPersonalization', JSON.stringify(personalization));
    
    onSubmit();
  };

  const activeType = MODULE_TYPES.find(t => t.id === moduleType) || MODULE_TYPES[0];
  const ActiveIcon = activeType.icon;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-[20px] shadow-sm flex flex-col focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.08)] focus-within:border-gray-300 transition-all overflow-visible ring-1 ring-black/5 relative">
      
      {/* Top Header Section */}
      <div className="flex items-start justify-between p-4 border-b border-gray-50/50 hover:bg-gray-50/30 transition-colors">
        <label 
          htmlFor={fileInputId}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors flex-shrink-0">
            <Paperclip className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <div className="flex items-center gap-1 font-semibold text-gray-700 text-sm">
              Add files <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Drag & drop files or click to upload</div>
          </div>
        </label>
        <input
          id={fileInputId}
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="application/pdf,text/plain,image/*"
        />

        {/* Files Area */}
        {files.length > 0 && (
          <>
            <style>{`.custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }`}</style>
            <div className="flex flex-wrap items-center gap-2 justify-end flex-1 ml-6 overflow-y-auto max-h-[140px] custom-scrollbar pr-1">
              {files.map((f) => {
                const isUploading = f.status === 'uploading' || f.status === 'processing';
                const hasError = f.status === 'error';

                return (
                  <div key={f.id} className={`flex items-center bg-white border ${hasError ? 'border-red-200' : 'border-gray-200'} rounded-xl px-3 py-2 shadow-sm min-w-0 w-[200px] relative overflow-hidden group`}>
                    {/* Progress bar background */}
                    {isUploading && (
                      <div 
                        className="absolute left-0 bottom-0 top-0 bg-indigo-50/50 transition-all duration-300 z-0 ease-out" 
                        style={{ width: `${f.progress}%` }} 
                      />
                    )}

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mr-3 z-10 ${hasError ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
                      {isUploading ? (
                        <div className="w-4 h-4 border-[2px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                      <div className="text-xs font-medium text-gray-700 truncate">{f.name}</div>
                      <div className={`text-[10px] leading-none mt-1 ${hasError ? 'text-red-400' : 'text-gray-400'}`}>
                        {f.status === 'processing' ? 'Extracting text...' : isUploading ? `Uploading... ${Math.round(f.progress)}%` : hasError ? 'Failed to read' : formatFileSize(f.size)}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(f.id); }} 
                      className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 z-10 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Main Textarea */}
      <div className="p-4 flex-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message, request, or instructions..."
          className="w-full bg-transparent border-none focus:ring-0 resize-none text-gray-800 text-base placeholder-gray-400 min-h-[40px] p-0"
          style={{ maxHeight: '400px' }}
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between p-3 border-t border-gray-100/50 bg-gray-50/50 rounded-b-[20px]">
        {/* Module Type Selector */}
        <div className="relative">
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <ActiveIcon className="h-4 w-4 text-indigo-500" />
            {activeType.title}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          <AnimatePresence>
            {showTypeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 py-2 overflow-hidden"
                >
                  {MODULE_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => { setModuleType(type.id); setShowTypeMenu(false); }}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${type.id === moduleType ? 'text-gray-900 font-medium bg-gray-50' : 'text-gray-600'}`}
                      >
                        <Icon className={`h-4 w-4 ${type.id === moduleType ? 'text-indigo-500' : 'text-gray-400'}`} />
                        {type.title}
                      </button>
                    )
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          
          <div className="relative">
            <button
              onClick={() => setShowPersonalization(!showPersonalization)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border shadow-sm
                ${showPersonalization 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : 'bg-indigo-50/50 hover:bg-indigo-50 border-indigo-100 text-indigo-600'}`}
            >
              <Settings className="h-4 w-4" />
              Personalization
            </button>

            <AnimatePresence>
              {showPersonalization && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPersonalization(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-2 w-[320px] bg-white border border-gray-200 rounded-2xl shadow-xl z-20 p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Personalization Settings</h4>
                      <button onClick={() => setShowPersonalization(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Complexity */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Complexity</label>
                        <select 
                          value={personalization.complexity}
                          onChange={e => setPersonalization(p => ({...p, complexity: e.target.value}))}
                          className="w-full text-sm border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-1.5 px-3 border shadow-sm outline-none"
                        >
                          <option value="Primary Level">Primary Level</option>
                          <option value="High School">High School</option>
                          <option value="College/University">College/University</option>
                          <option value="Graduate">Graduate</option>
                          <option value="Professional">Professional</option>
                          <option value="Expert">Expert</option>
                        </select>
                      </div>

                      {/* Learning Goal (Intent) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Learning Goal (Intent)</label>
                        <input 
                          type="text" 
                          value={personalization.intent}
                          onChange={e => setPersonalization(p => ({...p, intent: e.target.value}))}
                          placeholder="E.g. Master the basics, prepare for exam..."
                          className="w-full text-sm border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-1.5 px-3 border shadow-sm outline-none placeholder-gray-400"
                        />
                      </div>

                      {/* Interests */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Interests (Engagement Triggers)</label>
                        <input 
                          type="text" 
                          value={personalization.interests}
                          onChange={e => setPersonalization(p => ({...p, interests: e.target.value}))}
                          placeholder="E.g. Space, Video games, Sports..."
                          className="w-full text-sm border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 py-1.5 px-3 border shadow-sm outline-none placeholder-gray-400"
                        />
                      </div>

                      {/* Interactivity */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Interactivity Level</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          {(['minimal', 'medium', 'high'] as const).map(level => (
                            <button
                              key={level}
                              onClick={() => setPersonalization(p => ({...p, interactivity: level}))}
                              className={`flex-1 text-xs py-1.5 rounded-md font-medium capitalize transition-colors ${
                                personalization.interactivity === level 
                                  ? 'bg-white text-gray-900 shadow-sm' 
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Learning Style */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Learning Style</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          {(['balanced', 'visual', 'hands-on'] as const).map(style => (
                            <button
                              key={style}
                              onClick={() => setPersonalization(p => ({...p, learningStyle: style}))}
                              className={`flex-1 text-xs py-1.5 rounded-md font-medium capitalize transition-colors ${
                                personalization.learningStyle === style 
                                  ? 'bg-white text-gray-900 shadow-sm' 
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onSubmitWrapper}
            disabled={disabled || (!content.trim() && files.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors shadow-sm font-medium text-sm"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
