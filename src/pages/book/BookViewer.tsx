import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { doc, getDoc, collection, query, onSnapshot, where } from 'firebase/firestore';
import Markdown from 'react-markdown';
import { ChevronRight, ChevronLeft, Menu, CheckCircle2, Bookmark, FileText, Search, MoreHorizontal, PenTool, Loader2 } from 'lucide-react';
import localforage from 'localforage';
import { generateCourseOutline, generateChapterContent } from '../../lib/agents/courseGenerator';

function QuizBlock({ block }: { block: any }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selected === block.correctOptionIndex;

  return (
    <div className="bg-white border text-left border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <h4 className="font-bold text-gray-900">{block.title || "Quick Quiz"}</h4>
        </div>
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Quiz</span>
      </div>
      <p className="text-sm font-semibold text-gray-800 mb-4">{block.question}</p>
      <div className="space-y-2">
        {block.options?.map((opt: string, oIdx: number) => {
          let btnClass = "w-full text-left p-3 border rounded-xl text-sm transition-colors flex items-center justify-between ";
          
          if (!submitted) {
            btnClass += selected === oIdx ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300";
          } else {
            if (oIdx === block.correctOptionIndex) {
              btnClass += "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium";
            } else if (selected === oIdx) {
              btnClass += "border-rose-500 bg-rose-50 text-rose-900 font-medium";
            } else {
              btnClass += "border-gray-200 text-gray-400";
            }
          }

          return (
            <button 
              key={oIdx} 
              disabled={submitted}
              onClick={() => setSelected(oIdx)}
              className={btnClass}
            >
              <div>
                <span className="font-mono opacity-50 mr-2">{String.fromCharCode(65 + oIdx)}.</span> {opt}
              </div>
              {submitted && oIdx === block.correctOptionIndex && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </button>
          );
        })}
      </div>
      
      {!submitted && selected !== null && (
        <button onClick={() => setSubmitted(true)} className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors">Submit Answer</button>
      )}

      {submitted && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${isCorrect ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <div className="font-bold mb-1">{isCorrect ? 'Great!' : 'Not quite.'}</div>
          <div className="text-gray-700">{block.explanation}</div>
          {!isCorrect && (
            <button onClick={() => { setSubmitted(false); setSelected(null); }} className="mt-2 text-indigo-600 font-bold hover:underline">Try Again</button>
          )}
        </div>
      )}
    </div>
  );
}

function TryItBlock({ block }: { block: any }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-white border text-left border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center">
          <PenTool className="w-3.5 h-3.5" />
        </div>
        <h4 className="font-bold text-gray-900">{block.title || "Try It Yourself"}</h4>
      </div>
      <p className="text-sm text-gray-600 mb-4">{block.content}</p>
      
      {submitted ? (
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
           <strong className="text-emerald-800 text-sm block mb-2">Awesome! Here is what you wrote:</strong>
           <p className="text-sm text-emerald-900 whitespace-pre-wrap">{value}</p>
           <button onClick={() => setSubmitted(false)} className="mt-3 text-emerald-700 text-xs font-bold hover:underline">Edit</button>
        </div>
      ) : (
        <>
          <textarea 
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px]" 
            placeholder="Type your answer here..."
          ></textarea>
          <div className="mt-3 flex justify-end">
            <button 
              disabled={!value.trim()}
              onClick={() => setSubmitted(true)} 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
            >Submit</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function BookViewer() {
  const { user } = useAuth();
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [generatingChapterIds, setGeneratingChapterIds] = useState<Record<string, 'generating' | 'failed'>>({});
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);

  useEffect(() => {
    if (!activeChapterId && course?.outline?.length > 0 && course.outline[0].chapters?.length > 0) {
      setActiveChapterId(course.outline[0].chapters[0].id);
    }
  }, [course, activeChapterId]);

  useEffect(() => {
    let unsubscribeChapters: any;
    let unsubscribeCourse: any;
    
    async function loadData() {
      if (!courseId || !user) return;

      unsubscribeCourse = onSnapshot(doc(db, 'courses', courseId), (docSnap) => {
        if (docSnap.exists()) {
          const cData: any = { id: docSnap.id, ...docSnap.data() };
          setCourse(cData);
        }
      });

      try {
        const chaptersRef = collection(db, 'courses', courseId, 'chapters');
        const q = query(chaptersRef, where('userId', '==', user.uid));
        unsubscribeChapters = onSnapshot(q, (snapshot) => {
           const chaps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
           chaps.sort((a, b) => (a.order || 0) - (b.order || 0));
           setChapters(chaps);
           setChaptersLoaded(true);
        });
      } catch (err) {
        console.error("Error loading chapters:", err);
      }
    }
    
    loadData();
    return () => {
      if (unsubscribeChapters) unsubscribeChapters();
      if (unsubscribeCourse) unsubscribeCourse();
    };
  }, [courseId, user]);

  useEffect(() => {
    async function generateTOC() {
      if (!courseId || !course || isGeneratingOutline || course.status !== 'draft_outline') return;
      setIsGeneratingOutline(true);
      try {
        const files = await localforage.getItem<any[]>(`course_files_${courseId}`);
        await generateCourseOutline(courseId, course.topic, files || undefined);
      } catch (err) {
         console.error("error generating TOC", err);
      } finally {
         setIsGeneratingOutline(false);
      }
    }
    generateTOC();
  }, [course?.status, courseId]);



  async function generateChapter(chapId: string) {
    if (!courseId || !user || !course) return;
    setGeneratingChapterIds(prev => ({ ...prev, [chapId]: 'generating' }));
    
    // Find chapter info in course outline
    let targetChap = null;
    let targetPart = null;
    let orderIndex = 0;
    for (const part of course.outline || []) {
      for (const chap of part.chapters || []) {
        if (chap.id === chapId) {
          targetChap = chap;
          targetPart = part;
          break;
        }
        orderIndex++;
      }
      if (targetChap) break;
    }

    if (!targetChap) {
       setGeneratingChapterIds(prev => ({ ...prev, [chapId]: 'failed' }));
       return;
    }

    try {
      const files = await localforage.getItem<any[]>(`course_files_${courseId}`);
      await generateChapterContent(
        courseId, 
        { id: targetChap.id, title: targetChap.title, partTitle: targetPart.title }, 
        course.topic, 
        orderIndex, 
        user.uid, 
        files || undefined
      );
    } catch (e) {
      console.error(e);
      setGeneratingChapterIds(prev => ({ ...prev, [chapId]: 'failed' }));
    }
  }

  if (!course) return <div className="p-10 flex text-center justify-center">Loading...</div>;

  const outline = course.outline || [];
  const activeChapterData = chapters.find(c => c.chapterId === activeChapterId);
  const flatOutlineChapters = outline.flatMap((p: any) => p.chapters || []);
  const currentChapterIndex = flatOutlineChapters.findIndex((c: any) => c.id === activeChapterId);
  const totalChapters = flatOutlineChapters.length;
  const isGeneratingActive = generatingChapterIds[activeChapterId as string] === 'generating';
  const hasFailedActive = generatingChapterIds[activeChapterId as string] === 'failed';

  if (course.status === 'draft_outline') {
    return (
      <div className="flex flex-col h-screen bg-gray-50 w-full overflow-hidden font-sans items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Crafting your curriculum...</h2>
        <p className="text-gray-500 mt-2">Analyzing content and creating the module structure.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 w-full overflow-hidden font-sans">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold font-serif italic text-xl">L</div>
            <span className="font-bold text-gray-900 tracking-tight hidden sm:block">LearnForge Book</span>
          </Link>
          <div className="h-6 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          
          {totalChapters > 0 && (
            <div className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <button disabled={currentChapterIndex <= 0} onClick={() => setActiveChapterId(flatOutlineChapters[currentChapterIndex - 1]?.id)} className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              Chapter {currentChapterIndex + 1} of {totalChapters}
              <button disabled={currentChapterIndex >= totalChapters - 1} onClick={() => setActiveChapterId(flatOutlineChapters[currentChapterIndex + 1]?.id)} className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
           <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><PenTool className="w-3.5 h-3.5"/> Highlights</button>
           <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><FileText className="w-3.5 h-3.5"/> Notes</button>
           <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><Bookmark className="w-3.5 h-3.5"/> Bookmarks</button>
           <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><MoreHorizontal className="w-4 h-4"/></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (TOC) */}
        {sidebarOpen && (
          <aside className="w-72 bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col shrink-0 custom-scrollbar">
            <div className="p-6">
              <h1 className="text-xl font-bold text-gray-900 mb-2 leading-tight tracking-tight">{course.title || course.topic}</h1>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${((currentChapterIndex + 1) / totalChapters) * 100}%` }}></div>
                </div>
                <span className="text-xs font-semibold text-gray-500">{Math.round(((currentChapterIndex + 1) / totalChapters) * 100)}% complete</span>
              </div>
              
              <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search in book" className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono border border-gray-200 rounded px-1">⌘K</span>
              </div>

              <div className="space-y-8">
                {outline.map((part: any, pIdx: number) => {
                  return (
                    <div key={pIdx}>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">PART {pIdx + 1} - {part.title}</h4>
                      <ul className="space-y-1">
                        {(part.chapters || []).map((chap: any, cIdx: number) => {
                          const isActive = activeChapterId === chap.id;
                          const isGenerated = chapters.some(c => c.chapterId === chap.id);
                          const isGenerating = generatingChapterIds[chap.id] === 'generating';
                          return (
                            <li key={cIdx}>
                              <button
                                onClick={() => setActiveChapterId(chap.id)}
                                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                                  isActive 
                                    ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                    : isGenerated
                                      ? 'text-gray-900 hover:bg-gray-100 font-medium'
                                      : 'text-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>{pIdx+1}.{cIdx+1} {chap.title}</span>
                                  {!isGenerated && !isGenerating && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-400 uppercase">Draft</span>
                                  )}
                                  {isGenerating && (
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                                  )}
                                </span>
                                {isActive && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 ml-2"></div>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Main Content & Right Sidebar Container */}
        <main className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-32 scroll-smooth">
          {activeChapterData ? (
             <div className="flex flex-col lg:flex-row max-w-7xl mx-auto h-full">
               
               {/* Center Column */}
               <div className="flex-1 max-w-3xl mx-auto px-6 py-12 lg:px-12 lg:py-16">
                 <h1 className="text-4xl lg:text-5xl font-serif font-bold text-gray-900 mb-10 leading-tight">
                   {activeChapterData.chapterId.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                 </h1>
                 
                 <div className="space-y-8">
                   {activeChapterData.mainContent?.map((block: any, idx: number) => {
                     if (block.type === 'heading') {
                       return <h3 key={idx} className="text-2xl font-bold text-gray-900 mt-12 mb-4 font-serif">{block.content}</h3>;
                     }
                     if (block.type === 'image_placeholder') {
                        return (
                          <div key={idx} className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center my-10 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
                              <span className="text-gray-500 text-xs font-mono">IMG</span>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">{block.content}</p>
                          </div>
                        );
                     }
                     if (block.type === 'callout') {
                       return (
                         <div key={idx} className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-6 my-8">
                           <h4 className="text-[#166534] font-bold mb-2 flex items-center gap-2">
                              {block.calloutType || 'Notice'}
                           </h4>
                           <div className="text-[#166534] text-[15px] leading-relaxed">
                             <Markdown>{block.content}</Markdown>
                           </div>
                         </div>
                       );
                     }
                     
                     // Text default
                     return (
                       <div key={idx} className="text-gray-800 text-[17px] leading-8 font-serif">
                         <Markdown>{block.content}</Markdown>
                       </div>
                     );
                   })}
                 </div>

                 {/* Bottom Navigation */}
                 <div className="mt-20 pt-8 border-t border-gray-100 flex items-center justify-between">
                    <button 
                      disabled={currentChapterIndex <= 0} 
                      onClick={() => setActiveChapterId(flatOutlineChapters[currentChapterIndex - 1]?.id)}
                      className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4"/> Previous
                    </button>
                    
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                      <div className="flex items-center gap-1">
                        {flatOutlineChapters.map((_, i) => (
                           <div key={i} className={`w-8 h-1.5 rounded-full ${i === currentChapterIndex ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                        ))}
                      </div>
                      <span>{currentChapterIndex + 1} / {totalChapters}</span>
                    </div>

                    <button 
                      disabled={currentChapterIndex >= totalChapters - 1} 
                      onClick={() => setActiveChapterId(flatOutlineChapters[currentChapterIndex + 1]?.id)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 shadow-sm transition-colors"
                    >
                      Next <ChevronRight className="w-4 h-4"/>
                    </button>
                 </div>
               </div>

               {/* Right Sidebar */}
               <div className="w-full lg:w-80 shrink-0 border-l border-gray-100 bg-gray-50/50 p-6 space-y-6">
                 {activeChapterData.sidebarContent?.map((block: any, idx: number) => {
                   if (block.type === 'try_it') {
                     return <TryItBlock key={idx} block={block} />;
                   }
                   if (block.type === 'quiz') {
                     return <QuizBlock key={idx} block={block} />;
                   }
                   if (block.type === 'takeaway') {
                     return (
                       <div key={idx} className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                         <div className="flex items-center gap-2 mb-3">
                           <div className="w-6 h-6 rounded bg-amber-200 text-amber-800 flex items-center justify-center text-lg">★</div>
                           <h4 className="font-bold text-amber-900">{block.title}</h4>
                         </div>
                         <p className="text-sm text-amber-800 leading-relaxed font-medium">
                           {block.content}
                         </p>
                       </div>
                     );
                   }

                   return null;
                 })}
               </div>

             </div>
          ) : isGeneratingActive ? (
             <div className="flex items-center justify-center h-full text-indigo-600 p-8 flex-col gap-4 text-center">
                 <Loader2 className="w-8 h-8 animate-spin" />
                 <p className="font-medium">Generating this chapter...</p>
                 <p className="text-sm text-gray-500 max-w-md">Our AI is reading your files and crafting the interactive content for this chapter. This typically takes 10-15 seconds.</p>
             </div>
          ) : hasFailedActive ? (
             <div className="flex items-center justify-center h-full text-gray-400 p-8 flex-col gap-4 text-center">
                 <p className="text-rose-500 font-medium">Failed to generate this chapter.</p>
                 <button onClick={() => generateChapter(activeChapterId as string)} className="text-indigo-600 font-bold hover:underline">Try Again</button>
             </div>
          ) : chaptersLoaded ? (
             <div className="flex items-center justify-center h-full p-8 flex-col gap-6 text-center max-w-md mx-auto">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-2">
                    <FileText className="w-8 h-8" />
                 </div>
                 <div>
                   <h2 className="text-xl font-bold text-gray-900 mb-2">Chapter Not Generated</h2>
                   <p className="text-gray-500 text-sm">This chapter hasn't been generated yet. Click the button below to have AI create the content and interactive exercises for this section.</p>
                 </div>
                 <button 
                   onClick={() => generateChapter(activeChapterId as string)}
                   className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2"
                 >
                   <PenTool className="w-4 h-4" /> Generate Chapter
                 </button>
             </div>
          ) : (
             <div className="flex items-center justify-center h-full text-gray-400">Loading chapter content...</div>
          )}
        </main>
      </div>

    </div>
  );
}
