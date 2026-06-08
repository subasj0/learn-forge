import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import {
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../../lib/firestoreUtils";
import Markdown from "react-markdown";
import {
  CheckCircle2,
  Bookmark,
  FileText,
  MoreHorizontal,
  PenTool,
  Loader2,
  MessageSquare,
  Sparkles,
  X,
  Highlighter,
  BookOpen,
  Image,
  Trash2,
  ArrowUp,
  Type,
  ChevronLeft,
  ChevronRight,
  Plus,
  Notebook,
  Globe,
  Lock,
  Share2,
  Maximize2,
  Minimize2,
  Target,
  Zap,
  History,
  RotateCcw
} from "lucide-react";
import localforage from "localforage";
import { useAIChat } from "../../hooks/useAIChat";
import { completeChat, fetchChapterContent, generateChapter as generateChapterApi } from "../../lib/api";
import { Runner } from "react-runner";
import * as LucideIcons from "lucide-react";
import {
  buildChapterRunnerScope,
  hasChapterDefaultExport,
  prepareChapterCode,
} from "../../chapter-components/runnerScope";

function getChapterRef(course: any, chapterId: string | null) {
  if (!course || !chapterId) return null;
  return course.chapterRefs?.[chapterId] || null;
}

function getChapterVersions(course: any, chapterId: string | null) {
  const chapterRef = getChapterRef(course, chapterId);
  if (!chapterRef?.versions?.length) return [];
  return [...chapterRef.versions]
    .map((version: any) => ({
      ...version,
      id: version.versionId,
      chapterId,
    }))
    .sort((a: any, b: any) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

class InteractiveErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center">
          <LucideIcons.AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <h3 className="font-bold text-rose-900 mb-2">Interactive Component Error</h3>
          <p className="text-sm text-rose-700 mb-4">There was an error rendering this interactive chapter.</p>
          <pre className="text-[10px] bg-white p-4 rounded-xl border border-rose-100 overflow-x-auto text-left max-h-40">
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const InteractiveChapter = React.memo(function InteractiveChapter({ 
  code, 
  annotations, 
  activeChapterId,
  onHighlightClick,
  activeAnnotationId
}: { 
  code: string; 
  annotations: any[]; 
  activeChapterId: string;
  onHighlightClick: (id: string, text: string, note: string) => void;
  activeAnnotationId: string | null;
}) {
  if (!code) return null;

  const containerRef = React.useRef<HTMLDivElement>(null);

  const strippedCode = React.useMemo(() => prepareChapterCode(code), [code]);
  const [runnerError, setRunnerError] = React.useState<string | null>(null);
  const scope = React.useMemo(() => buildChapterRunnerScope(), []);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      // Check if mutations actually added/removed nodes that aren't our highlights
      const isOurMark = (n: Node) => (n as HTMLElement).classList?.contains?.('forge-highlight');
      const isOurMutation = mutations.every(m => {
        return isOurMark(m.target) || 
               Array.from(m.addedNodes).every(isOurMark) || 
               Array.from(m.removedNodes).every(isOurMark);
      });
      
      if (!isOurMutation) {
        applyHighlights();
      }
    });

    const applyHighlights = () => {
      if (!containerRef.current) return;
      
      observer.disconnect();
      
      // Remove previous marks
      const existingMarks = containerRef.current.querySelectorAll('mark.forge-highlight');
      existingMarks.forEach(m => {
        const parent = m.parentNode;
        if (parent) {
          const text = m.textContent;
          parent.replaceChild(document.createTextNode(text || ''), m);
          parent.normalize(); // merge adjacent text nodes
        }
      });

      const chapterAnnos = annotations.filter(a => a.chapterId === activeChapterId && (a.blockIdx === null || a.blockIdx === 0));
      
      chapterAnnos.forEach(anno => {
        if (!anno.text) return;
        
        // Find text nodes and wrap
        const walker = document.createTreeWalker(containerRef.current!, NodeFilter.SHOW_TEXT, null);
        let node;
        let found = false;
        let count = 0;
        
        const nodes: Text[] = [];
        while(node = walker.nextNode()) nodes.push(node as Text);

        for (const textNode of nodes) {
           if (found) break;
           
           let content = textNode.nodeValue || '';
           let index = content.indexOf(anno.text);
           while (index !== -1) {
             count++;
             if (!anno.occurrence || count === anno.occurrence) {
               const parent = textNode.parentNode;
               if (!parent || (parent as HTMLElement).closest('mark.forge-highlight')) {
                  index = content.indexOf(anno.text, index + 1);
                  continue;
               }

               const mark = document.createElement('mark');
               mark.id = `mark-${anno.id}`;
               
               let colorClasses = "bg-yellow-200 text-yellow-900 border-b-2 border-yellow-300";
               if (anno.color === "green") colorClasses = "bg-green-200 text-green-900 border-b-2 border-green-300";
               if (anno.color === "blue") colorClasses = "bg-blue-200 text-blue-900 border-b-2 border-blue-300";
               if (anno.color === "pink") colorClasses = "bg-rose-200 text-rose-900 border-b-2 border-rose-300";
               
               mark.className = `${colorClasses} cursor-pointer rounded px-1 transition-all hover:opacity-80 forge-highlight ${activeAnnotationId === anno.id ? 'ring-2 ring-indigo-500' : ''}`;
               mark.textContent = anno.text;
               mark.onclick = (e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 onHighlightClick(anno.id, anno.text || '', anno.note || '');
               };
               
               const afterText = document.createTextNode(content.substring(index + anno.text.length));
               textNode.nodeValue = content.substring(0, index);
               
               parent.insertBefore(mark, textNode.nextSibling);
               parent.insertBefore(afterText, mark.nextSibling);
               found = true;
               break;
             }
             index = content.indexOf(anno.text, index + 1);
           }
        }
      });

      observer.observe(containerRef.current, { childList: true, subtree: true });
    };

    applyHighlights();
    
    return () => observer.disconnect();
  }, [code, annotations, activeChapterId, activeAnnotationId, onHighlightClick]);

  if (!hasChapterDefaultExport(code)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-gray-500 italic">Designing interactive module...</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="interactive-chapter-container"
      data-block-idx="0" // Treat interactive as block 0
    >
      <InteractiveErrorBoundary>
        {runnerError && (
          <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center mb-6">
            <LucideIcons.AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
            <h3 className="font-bold text-rose-900 mb-2">Build Error</h3>
            <p className="text-sm text-rose-700 mb-4">There was a problem compiling the generated code.</p>
            <pre className="text-[10px] bg-white p-4 rounded-xl border border-rose-100 overflow-x-auto text-left max-h-40 whitespace-pre-wrap">
              {runnerError}
            </pre>
          </div>
        )}
        <Runner
          code={strippedCode}
          scope={scope}
          onRendered={(error) => {
            if (error) {
              const msg = error.message || String(error);
              if (runnerError !== msg) {
                setRunnerError(msg);
              }
            } else if (runnerError !== null) {
              setRunnerError(null);
            }
          }}
        />
      </InteractiveErrorBoundary>
    </div>
  );
});

function TryItBlock({ block }: { block: any }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm my-10 max-w-3xl mx-auto relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full pointer-events-none opacity-50"></div>
      
      <div className="flex items-center gap-3 mb-6 relative z-10 w-full justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <PenTool className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-gray-900 text-lg">
            {block.title || "Try It Yourself"}
          </h4>
        </div>
        <span className="text-[10px] uppercase font-bold text-amber-600 tracking-widest bg-amber-50 px-3 py-1.5 rounded-full">
          Exercise
        </span>
      </div>
      
      <div className="text-base text-gray-700 mb-8 leading-relaxed relative z-10">
        <Markdown>{block.content || "Follow the instructions and write your answer."}</Markdown>
      </div>

      {submitted ? (
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mt-2 relative z-10 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <strong className="text-emerald-800 text-[15px]">
              Awesome! Here is what you wrote:
            </strong>
          </div>
          <div className="p-4 bg-white rounded-xl border border-emerald-100/50 shadow-sm text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {value}
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-5 text-emerald-700 text-sm font-bold hover:text-emerald-800 hover:underline flex items-center gap-1"
          >
           Edit your response
          </button>
        </div>
      ) : (
        <div className="relative z-10">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 text-[15px] leading-relaxed text-gray-800 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 focus:bg-white transition-all outline-none min-h-[140px] resize-y shadow-inner placeholder:text-gray-400"
            placeholder="Type your answer here..."
          ></textarea>
          <div className="mt-5 flex justify-end">
            <button
              disabled={!value.trim()}
              onClick={() => setSubmitted(true)}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-amber-500/20"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlashcardBlock({ block }: { block: any }) {
  const [flipped, setFlipped] = useState(false);
  
  if (!block.backContent) {
    return (
      <div className="bg-white border-2 border-indigo-100 rounded-3xl p-8 shadow-sm my-10 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="mb-4 text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full inline-block">
          Concept
        </div>
        <div className="text-lg font-medium text-gray-800 leading-relaxed">
          <Markdown>{block.content}</Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="my-10 perspective-1000 max-w-2xl mx-auto cursor-pointer group" onClick={() => setFlipped(!flipped)}>
      <div className={`relative w-full transition-all duration-500 preserve-3d ${flipped ? "rotate-y-180" : ""}`} style={{ minHeight: '280px' }}>
        {/* Front */}
        <div className={"absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-100 rounded-3xl p-10 shadow-sm flex flex-col items-center justify-center text-center transition-shadow group-hover:shadow-md"}>
          <div className="absolute top-6 text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-100/50 px-3 py-1.5 rounded-full">
            Flashcard
          </div>
          <div className="text-2xl font-bold text-indigo-950 leading-tight">
            {block.content}
          </div>
          <div className="absolute bottom-6 text-[11px] font-bold uppercase tracking-widest text-indigo-300 group-hover:text-indigo-400 transition-colors flex items-center gap-1">
            Click to Flip
          </div>
        </div>
        
        {/* Back */}
        <div className={"absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-white border-2 border-indigo-200 rounded-3xl p-10 shadow-lg flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar"}>
          <div className="absolute top-6 left-6 text-indigo-300">
            <BookOpen className="w-6 h-6 opacity-50" />
          </div>
          <div className="text-lg text-gray-700 leading-relaxed max-w-lg mt-4">
            <Markdown>{block.backContent}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookViewer() {
  const { user, openLoginModal } = useAuth();
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [localGeneratingChapterIds, setLocalGeneratingChapterIds] = useState<Record<string, boolean>>({});

  // Generation configuration state
  const [genConfig, setGenConfig] = useState({
    guidance: "",
    tone: "conversational",
    depth: "detailed",
    focus: ""
  });
  const [showGenConfig, setShowGenConfig] = useState(false);

  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

  const [fontSize, setFontSize] = useState<number>(17);
  const [fontFamily, setFontFamily] = useState<string>("font-sans");
  const [rightPane, setRightPane] = useState<"ai" | "notes" | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    top: number;
    left: number;
    text: string;
    blockIdx: number | null;
    occurrence?: number;
  }>({ top: 0, left: 0, text: "", blockIdx: null });
  const [isSelectionBoxVisible, setIsSelectionBoxVisible] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editedMainContent, setEditedMainContent] = useState<any[]>([]);
  const [convertingIdx, setConvertingIdx] = useState<number | null>(null);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  const [promptingAddIdx, setPromptingAddIdx] = useState<number | null>(null);
  const [promptingAddType, setPromptingAddType] = useState<
    "flashcard" | "image" | "text" | null
  >(null);
  const [addCustomPrompt, setAddCustomPrompt] = useState<string>("");
  const [isGeneratingNewBlock, setIsGeneratingNewBlock] = useState(false);

  const [chapterContent, setChapterContent] = useState<Record<string, any>>({});
  const [loadingExternal, setLoadingExternal] = useState<Record<string, boolean>>({});

  const dbChaptersForActive = React.useMemo(() => {
    return getChapterVersions(course, activeChapterId);
  }, [course, activeChapterId]);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const dbChapter = React.useMemo(() => {
    if (!dbChaptersForActive.length) return null;
    if (selectedVersionId) {
      return dbChaptersForActive.find(c => c.versionId === selectedVersionId) || dbChaptersForActive[0];
    }
    const latestVersionId = getChapterRef(course, activeChapterId)?.latestVersionId;
    return dbChaptersForActive.find(c => c.versionId === latestVersionId) || dbChaptersForActive[0];
  }, [course, activeChapterId, dbChaptersForActive, selectedVersionId]);

  const activeChapterData = React.useMemo(() => {
    if (!activeChapterId || !dbChapter) return null;

    const extContent = chapterContent[dbChapter.versionId];
    if (!extContent) return null;
    return {
      ...dbChapter,
      ...(typeof extContent === 'object' ? extContent : { componentCode: extContent })
    };
  }, [activeChapterId, dbChapter, chapterContent]);

  const chapterInOutline = course?.outline?.flatMap((p: any) => p.chapters).find((c: any) => c.id === activeChapterId);
  const displayTitle = chapterInOutline?.title || (activeChapterData?.chapterId || activeChapterId || "")
    .split("-")
    .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  const chapterTextContext = React.useMemo(() => {
    if (!activeChapterData) return "";
    
    // For regular chapters, use blocks
    if (activeChapterData.mainContent?.length) {
      return activeChapterData.mainContent
        .map((b: any) => b.content || "")
        .join("\n");
    }
    
    // For interactive chapters, extract text literals from code
    if (activeChapterData.componentCode) {
      // Better text extraction from JSX/Code string
      let code = activeChapterData.componentCode;
      
      // Extract all string literals and JSX children
      const strings: string[] = [];
      
      // Matches double quoted strings
      const doubleQuotes = code.match(/"([^"\\]*(\\.[^"\\]*)*)"/g);
      if (doubleQuotes) strings.push(...doubleQuotes.map(s => s.slice(1, -1)));
      
      // Matches single quoted strings
      const singleQuotes = code.match(/'([^'\\]*(\\.[^'\\]*)*)'/g);
      if (singleQuotes) strings.push(...singleQuotes.map(s => s.slice(1, -1)));
      
      // Matches template literals
      const templates = code.match(/`([^`\\]*(\\.[^`\\]*)*)`/g);
      if (templates) strings.push(...templates.map(s => s.slice(1, -1)));
      
      // Matches text between tags: >Text<
      const jsxText = code.match(/>([^<>{}]*)<(?!\/)/g);
      if (jsxText) strings.push(...jsxText.map(s => s.slice(1, -1)));

      const extractedText = Array.from(new Set(strings))
        .filter(s => s.trim().length > 3)
        .join("\n");

      // Also include the code itself so AI understands the logic/widgets
      return `[extracted visible text]:\n${extractedText}\n\n[source code logic]:\n${code}`.substring(0, 50000);
    }
    
    return "";
  }, [activeChapterData]);

  const {
    sessions: chatSessions,
    activeSession: activeChatSession,
    activeSessionId,
    setActiveSessionId,
    isLoading: isChatLoading,
    streamingMessageText,
    createNewSession,
    deleteSession,
    sendMessage,
  } = useAIChat(courseId, activeChapterId, chapterTextContext, user?.uid || "anonymous");

  const [chatInput, setChatInput] = useState("");
  const [chatSelectionContext, setChatSelectionContext] = useState<
    string | null
  >(null);
  type AnnotationType = "highlight" | "note";
  interface Annotation {
    id: string;
    type: AnnotationType;
    text: string;
    note?: string;
    color?: string;
    createdAt: number;
    chapterId?: string;
    chapterTitle?: string;
    blockIdx?: number | null;
    occurrence?: number;
  }
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(
    null,
  );
  const [annotationsFilter, setAnnotationsFilter] = useState<
    "All" | "Highlight" | "Note"
  >("All");
  const [noteInput, setNoteInput] = useState("");
  const [selectedHighlightText, setSelectedHighlightText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const [personalizeBlockIdx, setPersonalizeBlockIdx] = useState<number | null>(
    null,
  );
  const [personalizePrompt, setPersonalizePrompt] = useState<string>("");
  const [isPersonalizing, setIsPersonalizing] = useState<boolean>(false);

  const isCreator = user && course?.userId === user.uid;
  const isPublic = course?.isPublic === true;

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function loadExternal() {
      if (!activeChapterId || !courseId) return;
      const chap = dbChapter;
      if (chap?.versionId && !chapterContent[chap.versionId] && !loadingExternal[chap.versionId]) {
        setLoadingExternal(prev => ({ ...prev, [chap.versionId]: true }));
        try {
          const data = await fetchChapterContent(courseId, activeChapterId, chap.versionId);
          setChapterContent(prev => ({ ...prev, [chap.versionId]: data }));
        } catch (err) {
          console.error("Failed to load external content", err);
        } finally {
          setLoadingExternal(prev => ({ ...prev, [chap.versionId]: false }));
        }
      }
    }
    loadExternal();
  }, [activeChapterId, courseId, dbChapter, chapterContent, loadingExternal]);

  useEffect(() => {
    async function loadNotes() {
      if (courseId) {
        const userId = user?.uid || "anonymous";
        const savedNotes = await localforage.getItem<any>(
          `course_notes_${courseId}_${userId}`,
        );
        if (savedNotes) {
          const migrated = savedNotes.map((n: any) => ({
            ...n,
            type: n.type || (n.note ? "note" : "highlight"),
            color: n.color || (n.note ? "green" : "yellow"),
          }));
          setAnnotations(migrated);
        } else {
          setAnnotations([]);
        }
      }
    }
    loadNotes();
  }, [courseId, user?.uid]);

  useEffect(() => {
    if (courseId) {
      const userId = user?.uid || "anonymous";
      localforage.setItem(`course_notes_${courseId}_${userId}`, annotations);
    }
  }, [annotations, courseId, user?.uid]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      selection.toString().trim() === ""
    ) {
      setTimeout(() => {
        const currentSelection = window.getSelection();
        if (!currentSelection || currentSelection.isCollapsed) {
          setIsSelectionBoxVisible(false);
        }
      }, 200);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const text = selection.toString().trim();
    const startNode = range.startContainer;

    const blockElement = startNode?.parentElement?.closest("[data-block-idx]");
    let blockIdx = null;
    if (blockElement) {
      blockIdx = parseInt(
        blockElement.getAttribute("data-block-idx") || "-1",
        10,
      );
    }

    let occurrence = 1;
    // For interactive modules, calculate the occurrence within the interactive container
    const isInteractive = activeChapterData?.moduleType === 'interactive' || !!activeChapterData?.componentCode;
    
    if (isInteractive) {
      const container = document.querySelector('.interactive-chapter-container');
      if (container) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let n;
        let count = 0;
        let found = false;
        while (n = walker.nextNode()) {
          const content = n.nodeValue || '';
          let pos = content.indexOf(text);
          while (pos !== -1) {
            count++;
            if (n === startNode && pos === range.startOffset) {
              occurrence = count;
              found = true;
              break;
            }
            pos = content.indexOf(text, pos + 1);
          }
          if (found) break;
        }
      }
    }

    setSelectionBox({
      top: rect.top - 50,
      left: rect.left + rect.width / 2,
      text,
      blockIdx,
      occurrence,
    });
    setIsSelectionBoxVisible(true);
  };

  useEffect(() => {
    if (
      !activeChapterId &&
      course?.outline?.length > 0 &&
      course.outline[0].chapters?.length > 0
    ) {
      handleChapterChange(course.outline[0].chapters[0].id);
    }
  }, [course, activeChapterId]);

  useEffect(() => {
    let unsubscribeCourse: any;

    async function loadData() {
      if (!courseId) return;

      unsubscribeCourse = onSnapshot(
        doc(db, "courses", courseId),
        (docSnap) => {
          if (docSnap.exists()) {
            const cData: any = { id: docSnap.id, ...docSnap.data() };
            setCourse(cData);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `courses/${courseId}`)
      );
    }

    loadData();
    return () => {
      if (unsubscribeCourse) unsubscribeCourse();
    };
  }, [courseId, user]);

  useEffect(() => {
    if (course && activeChapterId && !genConfig.guidance) {
      const chapterInOutline = course?.outline?.flatMap((p: any) => p.chapters).find((c: any) => c.id === activeChapterId);
      if (chapterInOutline) {
        setGenConfig(prev => ({
          ...prev,
          guidance: chapterInOutline.guidance || ""
        }));
      }
    }
  }, [course, activeChapterId]);

  async function generateChapter(chapId: string, customConfig?: typeof genConfig) {
    if (!courseId || !user || !course) return;
    setLocalGeneratingChapterIds((prev) => ({ ...prev, [chapId]: true }));

    try {
      const files = await localforage.getItem<any[]>(`course_files_${courseId}`);
      await generateChapterApi({
        courseId,
        chapterId: chapId,
        generationConfig: customConfig || genConfig,
        files: files || [],
      });
      setSelectedVersionId(null);
      setShowGenConfig(false);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to generate chapter");
    } finally {
      setLocalGeneratingChapterIds((prev) => {
        const next = { ...prev };
        delete next[chapId];
        return next;
      });
    }
  }

  async function completeTextPrompt(prompt: string) {
    const { text } = await completeChat({
      chapterText: chapterTextContext,
      message: prompt,
      history: [],
    });
    return text;
  }

  const handleSendChat = async (
    e?: React.FormEvent,
    presetMessage?: string,
  ) => {
    e?.preventDefault();
    let msg = presetMessage || chatInput.trim();
    if (!msg || isChatLoading) return;

    if (chatSelectionContext) {
      msg = `Regarding this excerpt: "${chatSelectionContext}"\n\n${msg}`;
    }

    setChatInput("");
    setChatSelectionContext(null);
    setRightPane("ai");
    
    // Automatically close sidebar if expanded
    if (isChatExpanded) {
      setSidebarOpen(false);
    }
    
    await sendMessage(msg);
  };

  const toggleChatExpansion = () => {
    const newState = !isChatExpanded;
    setIsChatExpanded(newState);
    if (newState) {
      setSidebarOpen(false);
    }
  };

  const wrapTextInMarkdown = async (
    text: string,
    blockIdx: number | null,
    annoId: string,
  ) => {
    if (blockIdx === null || blockIdx === -1 || !activeChapterData || !activeChapterData.mainContent) return;
    const block = activeChapterData.mainContent[blockIdx];
    if (block && block.content && block.content.includes(text)) {
      const newContent = block.content.replace(
        text,
        `[${text}](#anno-${annoId})`,
      );
      const newMainContent = [...activeChapterData.mainContent];
      newMainContent[blockIdx] = { ...block, content: newContent };

      // If in edit mode, sync the local edit state too
      if (isEditMode) {
        const newEditedContent = [...editedMainContent];
        const editBlock = newEditedContent[blockIdx];
        if (editBlock && editBlock.content && editBlock.content.includes(text)) {
          newEditedContent[blockIdx] = {
            ...editBlock,
            content: editBlock.content.replace(text, `[${text}](#anno-${annoId})`),
          };
          setEditedMainContent(newEditedContent);
        }
      }

      if (activeChapterData.versionId) {
        setChapterContent((prev) => ({
          ...prev,
          [activeChapterData.versionId]: {
            ...(prev[activeChapterData.versionId] || activeChapterData),
            mainContent: newMainContent,
          },
        }));
      }
    }
  };

  const startHighlight = async (text: string, blockIdx: number | null, occurrence?: number) => {
    setIsSelectionBoxVisible(false);
    if (!activeChapterData) return;
    const newId = Date.now().toString();
    const isInteractive = !!activeChapterData.componentCode;
    const newAnno: Annotation = {
      id: newId,
      type: "highlight",
      text,
      color: "yellow",
      createdAt: Date.now(),
      chapterId: activeChapterId || activeChapterData.chapterId,
      chapterTitle: activeChapterData.chapterId || activeChapterId || "",
      blockIdx: isInteractive ? null : blockIdx,
      occurrence,
    };
    setAnnotations((prev) => [newAnno, ...prev]);
    setActiveAnnotationId(newId);
    
    if (!isInteractive) {
      wrapTextInMarkdown(text, blockIdx, newId);
    }
  };

  const startNote = async (text: string, blockIdx: number | null, occurrence?: number) => {
    setIsSelectionBoxVisible(false);
    if (!activeChapterData) return;
    const newId = Date.now().toString();
    const isInteractive = !!activeChapterData.componentCode;
    const newAnno: Annotation = {
      id: newId,
      type: "note",
      text,
      color: "green",
      createdAt: Date.now(),
      chapterId: activeChapterId || activeChapterData.chapterId,
      chapterTitle: activeChapterData.chapterId || activeChapterId || "",
      blockIdx: isInteractive ? null : blockIdx,
      occurrence,
    };
    setAnnotations((prev) => [newAnno, ...prev]);
    setRightPane("notes");
    setActiveAnnotationId(newId);
    setSelectedHighlightText(text);
    setShowNoteInput(true);
    
    if (!isInteractive) {
      wrapTextInMarkdown(text, blockIdx, newId);
    }
  };

  const removeAnnotation = async (anno: Annotation) => {
    // 1. Update local state
    setAnnotations((prev) => prev.filter((a) => a.id !== anno.id));
    if (activeAnnotationId === anno.id) {
      setActiveAnnotationId(null);
      setShowNoteInput(false);
    }
  };

  const executePersonalize = async (idx: number) => {
    const block = editedMainContent[idx];
    if (!block) return;

    setIsPersonalizing(true);
    try {
      const sysMsg = `You are rewriting a specific paragraph from an interactive course to personalize or improve it based on the user's prompt.
Original paragraph:
${block.content}

User Prompt:
${personalizePrompt}

Output ONLY the new rewritten paragraph. Use standard markdown.`;

      const newContent = await completeTextPrompt(sysMsg);

      const newMainContent = [...editedMainContent];
      newMainContent[idx] = { ...block, content: newContent };
      setEditedMainContent(newMainContent);

      setPersonalizeBlockIdx(null);
    } catch (e: any) {
      console.error("error personalizing", e);
      if (e.name === 'BudgetExceededError') {
        alert(e.message);
      }
    } finally {
      setIsPersonalizing(false);
    }
  };

  const deleteBlock = (idx: number) => {
    const newContent = [...editedMainContent];
    newContent.splice(idx, 1);
    setEditedMainContent(newContent);
  };

  const addBlockAfter = async (
    idx: number,
    type: "flashcard" | "image" | "text",
    customUserPrompt: string = "",
  ) => {
    if (addingIdx !== null) return;
    setAddingIdx(idx);
    setIsGeneratingNewBlock(true);
    try {
      let newBlock: any;
      if (type === "text") {
        const contextBlocks = (
          isEditMode ? editedMainContent : activeChapterData?.mainContent || []
        ).slice(0, idx + 1);
        const context =
          contextBlocks.map((b: any) => b.content || "").join("\n") ||
          course.topic;

        const sysMsg = `Generate informative and engaging educational text for a course chapter.
Context from previous parts of the chapter:
${context}

User's specific instruction/prompt for this new section:
"${customUserPrompt || "Write the next logical educational section."}"

Output ONLY the text content in markdown format. No headers if not specifically asked.`;

        const res = await completeTextPrompt(sysMsg);
        newBlock = { type: "markdown", content: res.trim() };
      } else {
        const contextBlocks = (
          isEditMode ? editedMainContent : activeChapterData?.mainContent || []
        ).slice(0, idx + 1);
        const context =
          contextBlocks.map((b: any) => b.content || "").join("\n") ||
          course.topic;

        if (type === "flashcard") {
          const sysMsg = `Generate a JSON flashcard based on this context:\n${context}\n\n${customUserPrompt ? `User request: ${customUserPrompt}\n\n` : ""}Format exactly like this example:\n{"type":"flashcard","content":"Question?","backContent":"Answer."}\nOnly output the JSON object, no markdown.`;
          const res = await completeTextPrompt(sysMsg);
          newBlock = JSON.parse(res.replace(/```json|```/g, "").trim());
        } else if (type === "image") {
          const sysMsg = `Generate a detailed image generation prompt for an illustration related to this context:\n${context}\n\n${customUserPrompt ? `User request for the image: ${customUserPrompt}\n\n` : ""}Just output the prompt text, no markdown.`;
          const prompt = (await completeTextPrompt(sysMsg))
            .replace(/```/g, "")
            .trim();
          newBlock = {
            type: "image",
            content: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=400&nologo=true`,
            caption: prompt.substring(0, 70) + "...",
          };
        }
      }

      if (newBlock) {
        const newContent = [...editedMainContent];
        newContent.splice(idx + 1, 0, newBlock);
        setEditedMainContent(newContent);
        setPromptingAddIdx(null);
        setPromptingAddType(null);
        setAddCustomPrompt("");
      }
    } catch (e: any) {
      console.error("error adding block", e);
      if (e.name === 'BudgetExceededError') {
        alert(e.message);
      }
    } finally {
      setAddingIdx(null);
      setIsGeneratingNewBlock(false);
    }
  };

  const renderAddBlockPrompt = (idx: number) => {
    if (promptingAddIdx !== idx || !promptingAddType) return null;

    return (
      <div className="w-full max-w-lg bg-white border border-indigo-200 shadow-xl rounded-2xl p-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-indigo-700 text-sm font-bold">
            <Sparkles className="w-4 h-4" /> Add {promptingAddType} with AI
          </div>
          <button
            onClick={() => {
              setPromptingAddIdx(null);
              setPromptingAddType(null);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          autoFocus
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[80px] focus:outline-none"
          placeholder={`Describe what the ${promptingAddType} should be about... (e.g., "A flashcard about the three main stages of photosynthesis")`}
          value={addCustomPrompt}
          onChange={(e) => setAddCustomPrompt(e.target.value)}
          disabled={isGeneratingNewBlock}
        />
        <div className="flex justify-end mt-3 gap-2">
          <button
            onClick={() => {
              setPromptingAddIdx(null);
              setPromptingAddType(null);
            }}
            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              addBlockAfter(idx, promptingAddType, addCustomPrompt)
            }
            disabled={!addCustomPrompt.trim() || isGeneratingNewBlock}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            {isGeneratingNewBlock ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : (
              `Generate ${promptingAddType}`
            )}
          </button>
        </div>
      </div>
    );
  };

  const saveEdits = async () => {
    if (!activeChapterData || !courseId) return;
    try {
      if (activeChapterData.versionId) {
        setChapterContent((prev) => ({
          ...prev,
          [activeChapterData.versionId]: {
            ...(prev[activeChapterData.versionId] || activeChapterData),
            mainContent: editedMainContent,
          },
        }));
      }
      setIsEditMode(false);
      setPersonalizeBlockIdx(null);
    } catch (e) {
      console.error("Failed to save edits", e);
    }
  };

  const askAboutSelection = (text: string) => {
    setChatSelectionContext(text);
    setRightPane("ai");
    setIsSelectionBoxVisible(false);
  };

  const generateBlockImage = async (idx: number) => {
    if (!activeChapterData || !courseId) return;
    setGeneratingImages((prev) => ({ ...prev, [idx]: true }));
    try {
      const block = activeChapterData.mainContent[idx];
      const rawPrompt = block.content;

      // Ask the server-side chat agent to refine it.
      const systemPrompt = `You are an expert image prompt engineer.
      Refine the following educational illustration description into a highly detailed, professional prompt for an image generator (like DALL-E or Midjourney).
      Original Description: ${rawPrompt}
      
      Output ONLY the refined prompt text, no markdown, no quotes. Keep it around 50-70 words. Mention it should be high quality, educational, and clean.`;

      const refinedPrompt = await completeTextPrompt(systemPrompt);

      // Using pollinators as a reliable runtime image generator
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(refinedPrompt.trim())}?width=1024&height=576&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

      const newMainContent = [...activeChapterData.mainContent];
      newMainContent[idx] = {
        ...block,
        type: "image",
        content: imageUrl,
        caption:
          rawPrompt.substring(0, 100) + (rawPrompt.length > 100 ? "..." : ""),
      };

      if (activeChapterData.versionId) {
        setChapterContent((prev) => ({
          ...prev,
          [activeChapterData.versionId]: {
            ...(prev[activeChapterData.versionId] || activeChapterData),
            mainContent: newMainContent,
          },
        }));
      }

      if (isEditMode) {
        setEditedMainContent(newMainContent);
      }
    } catch (e: any) {
      console.error("Failed to generate image", e);
      if (e.name === 'BudgetExceededError') {
        alert(e.message);
      }
    } finally {
      setGeneratingImages((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const handleTogglePublic = async () => {
    if (!courseId) return;
    try {
      await updateDoc(doc(db, "courses", courseId), {
        isPublic: !isPublic,
      });
    } catch (e) {
      console.error(e);
      alert("Failed to toggle visibility");
    }
  };

  const saveNote = () => {
    if (!noteInput.trim() || !activeAnnotationId) {
      // fallback for general notes without selection
      if (noteInput.trim() && !activeAnnotationId) {
        const newId = Date.now().toString();
        setAnnotations((prev) => [
          {
            id: newId,
            type: "note",
            text: "",
            note: noteInput.trim(),
            color: "green",
            createdAt: Date.now(),
            chapterId: activeChapterId || activeChapterData?.chapterId,
            chapterTitle: activeChapterId || activeChapterData?.chapterId,
            blockIdx: null,
          },
          ...prev,
        ]);
        setNoteInput("");
        setShowNoteInput(false);
      }
      return;
    }
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === activeAnnotationId
          ? { ...a, note: noteInput.trim(), type: "note" }
          : a,
      ),
    );
    setNoteInput("");
    setShowNoteInput(false);
    setSelectedHighlightText("");
  };

  if (!course)
    return (
      <div className="p-10 flex text-center justify-center">Loading...</div>
    );

  const outline = course.outline || [];
  const flatOutlineChapters = outline.flatMap((p: any) => p.chapters || []);
  const currentChapterIndex = flatOutlineChapters.findIndex(
    (c: any) => c.id === activeChapterId,
  );
  const handleChapterChange = (id: string | undefined) => {
    if (!id) return;
    setActiveChapterId(id);
    setSelectedVersionId(null);
    
    // Reset generation config with defaults for this chapter
    const chapterInOutline = course?.outline?.flatMap((p: any) => p.chapters).find((c: any) => c.id === id);
    if (chapterInOutline) {
      setGenConfig({
        guidance: chapterInOutline.guidance || "",
        tone: "conversational",
        depth: "detailed",
        focus: ""
      });
    }
  };
  const totalChapters = flatOutlineChapters.length;
  const activeChapterRef = getChapterRef(course, activeChapterId);
  const isGeneratingActive =
    activeChapterRef?.generationStatus === "generating" || localGeneratingChapterIds[activeChapterId as string] === true;
  const hasFailedActive =
    activeChapterRef?.generationStatus === "failed";

  if (course.status === "generating_outline") {
    return (
      <div className="flex flex-col h-screen bg-gray-50 w-full overflow-hidden font-sans items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">
          Crafting your curriculum...
        </h2>
        <p className="text-gray-500 mt-2">
          Analyzing content and creating the module structure.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 w-full overflow-hidden font-sans">
      {sidebarOpen && (
        <aside className="w-72 bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col shrink-0 custom-scrollbar h-full z-20">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0 bg-white">
            <Link to="/" className="flex items-center gap-2 shrink-0 group">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold font-serif italic text-xl group-hover:bg-indigo-700 transition-colors shadow-sm">
                L
              </div>
              <span className="font-bold text-gray-900 tracking-tight">
                LearnForge
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Close Sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 px-4 py-6">
            <div className="space-y-8">
              {outline.map((part: any, pIdx: number) => {
                return (
                  <div key={pIdx}>
                    <h4
                      className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 truncate"
                      title={part.title}
                    >
                      {part.title}
                    </h4>
                    <ul className="space-y-1">
                      {(part.chapters || []).map((chap: any, cIdx: number) => {
                        const isActive = activeChapterId === chap.id;
                        const chapterRef = getChapterRef(course, chap.id);
                        const isGenerated = chapterRef?.generationStatus === "ready";
                        const isGenerating =
                          chapterRef?.generationStatus === "generating" || localGeneratingChapterIds[chap.id] === true;
                        return (
                          <li key={cIdx}>
                            <button
                              onClick={() => handleChapterChange(chap.id)}
                              title={chap.title}
                              className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-sm transition-colors overflow-hidden ${
                                isActive
                                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                                  : isGenerated
                                    ? "text-gray-900 hover:bg-gray-100 font-medium"
                                    : "text-gray-400 hover:bg-gray-100"
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{chap.title}</span>
                                {isGenerating && (
                                  <Loader2 className="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
                                )}
                              </span>
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

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between shrink-0 z-10 w-full">
          <div className="flex items-center gap-4 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors mr-2"
                title="Open Sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-gray-900 truncate hidden sm:block max-w-[200px] md:max-w-[400px] lg:max-w-[600px] animate-in fade-in slide-in-from-left-4 duration-500">
                {course.title || course.topic || "Generating..."}
              </h1>
              {(course.authorName || (isCreator ? (user?.displayName || user?.email?.split('@')[0]) : null)) && (
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-gray-500 font-medium hidden sm:block truncate">
                    by <span className="text-indigo-600 font-semibold">{course.authorName || (user?.displayName || user?.email?.split('@')[0])}</span>
                  </p>
                  {dbChaptersForActive.length > 1 && (
                    <div className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
                      <History className="w-2.5 h-2.5" />
                      v{dbChaptersForActive.length - dbChaptersForActive.findIndex(c => c.id === dbChapter?.id)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dbChapter && isCreator && !showGenConfig && (
              <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100">
                {dbChaptersForActive.length > 1 && (
                  <select
                    value={dbChapter.versionId}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    className="bg-transparent border-none text-[11px] font-bold text-gray-600 focus:ring-0 cursor-pointer pr-6 py-1"
                  >
                    {dbChaptersForActive.map((v, idx) => (
                      <option key={v.versionId} value={v.versionId}>
                        Version {dbChaptersForActive.length - idx} ({new Date(v.createdAtMs || Date.now()).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setShowGenConfig(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-indigo-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                >
                  <RotateCcw className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
            )}

            {!(activeChapterData?.moduleType === 'interactive' || activeChapterData?.componentCode) && (
              <>
                <div className="relative group/font">
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="appearance-none text-sm bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-10 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-gray-700 font-bold hover:bg-white hover:border-indigo-200 transition-all cursor-pointer shadow-sm"
                  >
                    <option value="font-sans">Sans Serif</option>
                    <option value="font-serif">Serif</option>
                    <option value="font-mono">Monospace</option>
                  </select>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover/font:text-indigo-500 transition-colors">
                    <Type className="w-4 h-4" />
                  </div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ArrowUp className="w-3 h-3 rotate-180" />
                  </div>
                </div>

                <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                {isEditMode ? (
                  <div className="flex items-center gap-2 mr-2">
                    <button
                      onClick={() => {
                        setIsEditMode(false);
                        setEditedMainContent([]);
                        setPersonalizeBlockIdx(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdits}
                      className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                    >
                      Save Edits
                    </button>
                  </div>
                ) : isCreator ? (
                  <button
                    onClick={() => {
                      setIsEditMode(true);
                      setEditedMainContent([
                        ...(activeChapterData?.mainContent || []),
                      ]);
                    }}
                    className="p-2 mr-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex items-center gap-1 text-sm font-medium"
                    title="Edit Chapter"
                  >
                    <PenTool className="w-4 h-4" />{" "}
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                ) : null}
              </>
            )}

            <button
              onClick={() => setRightPane(rightPane === "ai" ? null : "ai")}
              className={`p-2 rounded-lg transition-colors ${rightPane === "ai" ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Ask AI"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button
              onClick={() =>
                setRightPane(rightPane === "notes" ? null : "notes")
              }
              className={`p-2 rounded-lg transition-colors ${rightPane === "notes" ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}
              title="Annotations"
            >
              <Notebook className="w-5 h-5" />
            </button>

            {isCreator && (
              <div className="relative border-l border-gray-200 pl-2 ml-1">
                <button
                  onClick={() => setIsShareOpen(!isShareOpen)}
                  className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${isShareOpen ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}
                  title="Share"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                {isShareOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 mb-1">Share Course</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Anyone with the link can view public courses. Only you can edit.
                      </p>
                    </div>
                    <div className="p-2">
                       <button
                         onClick={handleTogglePublic}
                         className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                       >
                         <div className="flex items-center gap-3">
                           <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center ${isPublic ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                              {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                           </div>
                           <div>
                             <div className="text-sm font-bold text-gray-900">{isPublic ? 'Public' : 'Private'}</div>
                             <div className="text-xs text-gray-500">{isPublic ? 'Anyone can view' : 'Only you can view'}</div>
                           </div>
                         </div>
                         <div className={`w-10 h-6 rounded-full relative transition-colors ${isPublic ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                           <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0'}`}></div>
                         </div>
                       </button>
                       {isPublic && (
                         <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                            <input type="text" readOnly value={window.location.href} className="w-full bg-transparent text-xs text-gray-600 outline-none truncate" />
                            <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="text-indigo-600 font-bold text-xs shrink-0 hover:underline">Copy Link</button>
                         </div>
                       )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <main
            className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-32 scroll-smooth"
            onMouseUp={handleMouseUp}
          >
            {showGenConfig && isCreator && activeChapterId ? (
               <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFCFD]">
               <div className="max-w-2xl mx-auto p-4 py-12">
                 <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                   <div className="flex items-center justify-between mb-8">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                      <RotateCcw className="w-8 h-8" />
                    </div>
                    <button 
                      onClick={() => setShowGenConfig(false)}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                   </div>
                   
                   <div className="mb-8">
                     <h2 className="text-2xl font-bold text-gray-900 mb-2">
                       Regenerate Chapter
                     </h2>
                     <p className="text-gray-500">
                       Change the parameters below to create a new version of this chapter. Previous versions will be saved in history.
                     </p>
                   </div>

                   <div className="space-y-6">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                         <Target className="w-4 h-4 text-indigo-500" /> Chapter Objective/Guidance
                       </label>
                       <textarea
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[120px] focus:outline-none transition-all"
                         value={genConfig.guidance}
                         onChange={(e) => setGenConfig({ ...genConfig, guidance: e.target.value })}
                         placeholder="What should this chapter cover? Key takeaways..."
                       />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                           <Sparkles className="w-4 h-4 text-pink-500" /> Tone
                         </label>
                         <select
                           className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                           value={genConfig.tone}
                           onChange={(e) => setGenConfig({ ...genConfig, tone: e.target.value })}
                         >
                           <option value="conversational">Conversational & Friendly</option>
                           <option value="formal">Formal & Academic</option>
                           <option value="technical">Technical & Detailed</option>
                           <option value="humorous">Playful & Humorous</option>
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                           <BookOpen className="w-4 h-4 text-emerald-500" /> Depth
                         </label>
                         <select
                           className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                           value={genConfig.depth}
                           onChange={(e) => setGenConfig({ ...genConfig, depth: e.target.value })}
                         >
                           <option value="introductory">Introductory (ELI5)</option>
                           <option value="detailed">In-depth (Standard)</option>
                           <option value="advanced">Advanced / Expert</option>
                         </select>
                       </div>
                     </div>

                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                         <Zap className="w-4 h-4 text-amber-500" /> Specific Focus (Optional)
                       </label>
                       <input
                         type="text"
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                         value={genConfig.focus}
                         onChange={(e) => setGenConfig({ ...genConfig, focus: e.target.value })}
                         placeholder="e.g. Focus specifically on Newtonian physics analogies"
                       />
                     </div>

                     <button
                       onClick={() => {
                        setShowGenConfig(false);
                        generateChapter(activeChapterId as string, genConfig);
                       }}
                       className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0"
                     >
                       <Zap className="w-5 h-5 fill-current" /> Create New Version
                     </button>
                   </div>
                 </div>
               </div>
             </div>
            ) : activeChapterData ? (
              activeChapterData.moduleType === 'interactive' || activeChapterData.componentCode ? (
                <div className="w-full">
                  <InteractiveChapter 
                    code={activeChapterData.componentCode} 
                    annotations={annotations}
                    activeChapterId={activeChapterId as string}
                    activeAnnotationId={activeAnnotationId}
                    onHighlightClick={(id, text, note) => {
                      setRightPane("notes");
                      setActiveAnnotationId(id);
                      setSelectedHighlightText(text);
                      setNoteInput(note);
                      setShowNoteInput(true);
                    }}
                  />
                </div>
              ) : (
                <div
                  className={`max-w-4xl mx-auto px-6 py-12 lg:px-12 lg:py-16 h-full ${fontFamily}`}
                >
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-10 leading-tight">
                    {displayTitle}
                  </h1>

                  <div className="space-y-8">
                    {isEditMode && (
                    <div className="flex items-center justify-center -mt-6 mb-8 flex-col gap-4">
                      <div className="bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1.5 flex items-center gap-1">
                        {addingIdx === -1 && isGeneratingNewBlock ? (
                          <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] px-4 py-1">
                            <Loader2 className="w-3 h-3 animate-spin" />{" "}
                            GENERATING...
                          </div>
                        ) : (
                          <>
                            <span className="text-[9px] font-bold text-gray-400 uppercase mr-1 px-2 border-r border-gray-100">
                              Add to start:
                            </span>
                            <button
                              onClick={() => {
                                setPromptingAddIdx(-1);
                                setPromptingAddType("text");
                              }}
                              className={`p-1 px-2 hover:bg-gray-100 rounded-full text-[10px] font-bold flex items-center gap-1 ${promptingAddIdx === -1 && promptingAddType === "text" ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                            >
                              <Type className="w-3 h-3" /> Text
                            </button>
                            <button
                              onClick={() => {
                                setPromptingAddIdx(-1);
                                setPromptingAddType("flashcard");
                              }}
                              className={`p-1 px-2 hover:bg-gray-100 rounded-full text-[10px] font-bold flex items-center gap-1 ${promptingAddIdx === -1 && promptingAddType === "flashcard" ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                            >
                              <BookOpen className="w-3 h-3 text-emerald-500" />{" "}
                              Flashcard
                            </button>
                            <button
                              onClick={() => {
                                setPromptingAddIdx(-1);
                                setPromptingAddType("image");
                              }}
                              className={`p-1 px-2 hover:bg-gray-100 rounded-full text-[10px] font-bold flex items-center gap-1 ${promptingAddIdx === -1 && promptingAddType === "image" ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                            >
                              <Image className="w-3 h-3 text-pink-500" /> Image
                            </button>
                          </>
                        )}
                      </div>

                      {promptingAddIdx === -1 && renderAddBlockPrompt(-1)}
                    </div>
                  )}

                  {(isEditMode
                    ? editedMainContent
                    : activeChapterData.mainContent
                  )?.map((block: any, idx: number) => {
                    let blockContent;
                    if (block.type === "heading") {
                      blockContent = (
                        <h3 className="text-3xl font-bold text-gray-900 mt-16 mb-6">
                          {block.content}
                        </h3>
                      );
                    } else if (block.type === "subheading") {
                      blockContent = (
                        <h4 className="text-xl font-bold text-gray-800 mt-10 mb-4">
                          {block.content}
                        </h4>
                      );
                    } else if (block.type === "try_it") {
                      blockContent = <TryItBlock block={block} />;
                    } else if (block.type === "flashcard") {
                      blockContent = <FlashcardBlock block={block} />;
                    } else if (block.type === "image") {
                      blockContent = (
                        <figure className="my-10">
                          <img
                            src={block.content}
                            alt={block.caption || "Course graphic"}
                            className="w-full rounded-2xl shadow-xl"
                            referrerPolicy="no-referrer"
                          />
                          {block.caption && (
                            <figcaption className="text-center text-sm text-gray-500 mt-3">
                              {block.caption}
                            </figcaption>
                          )}
                        </figure>
                      );
                    } else if (block.type === "image_placeholder") {
                      const isGenerating = generatingImages[idx];
                      blockContent = (
                        <div className="my-10 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center flex flex-col items-center gap-6 transition-all hover:bg-gray-100 hover:border-indigo-200">
                          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-400">
                            <Image className="w-8 h-8" />
                          </div>
                          <div className="max-w-md">
                            <h4 className="font-bold text-gray-900 mb-2">
                              Illustration Placeholder
                            </h4>
                            <p className="text-sm text-gray-400 leading-relaxed italic line-clamp-3">
                              "{block.content}"
                            </p>
                          </div>
                          <button
                            onClick={() => generateBlockImage(idx)}
                            disabled={isGenerating}
                            className="mt-2 flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Designing Illustration...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                Generate Image
                              </>
                            )}
                          </button>
                        </div>
                      );
                    } else if (block.type === "callout") {
                      blockContent = (
                        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-6 my-8">
                          <h4 className="text-[#166534] font-bold mb-2 flex items-center gap-2">
                            {block.calloutType || "Notice"}
                          </h4>
                          <div className="text-[#166534] text-[15px] leading-relaxed">
                            <Markdown>{block.content}</Markdown>
                          </div>
                        </div>
                      );
                    } else {
                      let displayContent = block.content || "";
                      const chapterAnnos = annotations.filter(a => a.chapterId === activeChapterId && a.blockIdx === idx);
                      chapterAnnos.forEach(anno => {
                          if (anno.text && displayContent.includes(anno.text) && !displayContent.includes(`](#anno-${anno.id})`)) {
                              displayContent = displayContent.replace(anno.text, `[${anno.text}](#anno-${anno.id})`);
                          }
                      });
                      
                      blockContent = (
                        <div
                          className="text-gray-800 leading-8"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          <Markdown
                            components={{
                              a: ({ node, ...props }) => {
                                if (props.href?.startsWith("#anno-")) {
                                  const annoId = props.href.replace(
                                    "#anno-",
                                    "",
                                  );
                                  const anno = annotations.find(
                                    (a) => a.id === annoId,
                                  );
                                  const color = anno?.color || "yellow";
                                  let colorClasses =
                                    "bg-yellow-200 text-yellow-900 border-b-2 border-yellow-300";
                                  if (color === "green")
                                    colorClasses =
                                      "bg-green-200 text-green-900 border-b-2 border-green-300";
                                  if (color === "blue")
                                    colorClasses =
                                      "bg-blue-200 text-blue-900 border-b-2 border-blue-300";
                                  if (color === "pink")
                                    colorClasses =
                                      "bg-rose-200 text-rose-900 border-b-2 border-rose-300";
                                  const isActive =
                                    activeAnnotationId === annoId;

                                  return (
                                    <mark
                                      id={`mark-${annoId}`}
                                      className={`${colorClasses} cursor-pointer rounded px-1 transition-all hover:opacity-80`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setRightPane("notes");
                                        setActiveAnnotationId(annoId);
                                        if (anno) {
                                          setSelectedHighlightText(
                                            anno.text || "",
                                          );
                                          setNoteInput(anno.note || "");
                                          setShowNoteInput(true);
                                        }
                                      }}
                                    >
                                      {props.children}
                                    </mark>
                                  );
                                }
                                if (props.href === "#highlight") {
                                  return (
                                    <mark className="bg-yellow-200 text-yellow-900 rounded px-1 cursor-pointer">
                                      {props.children}
                                    </mark>
                                  );
                                }
                                return <a {...props} />;
                              },
                            }}
                          >
                            {displayContent}
                          </Markdown>
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={idx}>
                        <div
                          className={`relative group/block ${isEditMode ? "ring-2 ring-transparent hover:ring-indigo-300 rounded-xl p-3 mb-2 -mx-3 transition-all" : ""}`}
                          data-block-idx={idx}
                        >
                          {blockContent}

                          {isEditMode && (
                            <div className="absolute top-0 right-0 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-opacity bg-white border border-gray-200 shadow-xl rounded-lg flex items-center p-1 z-20">
                              <button
                                onClick={() => {
                                  setPersonalizeBlockIdx(idx);
                                  setPersonalizePrompt("");
                                }}
                                className="px-2 py-1.5 hover:bg-gray-100 rounded text-xs font-semibold text-gray-700 flex items-center gap-1"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />{" "}
                                Personalize
                              </button>
                              <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                              <button
                                onClick={() => deleteBlock(idx)}
                                className="px-2 py-1.5 hover:bg-rose-50 rounded text-xs font-semibold text-rose-600 flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          )}

                          {convertingIdx === idx && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex items-center justify-center rounded-xl border border-indigo-200">
                              <div className="flex bg-white px-4 py-2 rounded-full shadow-lg items-center gap-2 text-indigo-700 font-bold text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />{" "}
                                Generating...
                              </div>
                            </div>
                          )}

                          {personalizeBlockIdx === idx && isEditMode && (
                            <div className="bg-white border border-indigo-200 shadow-xl rounded-xl p-4 mt-4 relative z-40">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-indigo-700 text-sm font-bold">
                                  <Sparkles className="w-4 h-4" /> Personalize
                                  block
                                </div>
                                <button
                                  onClick={() => setPersonalizeBlockIdx(null)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <textarea
                                autoFocus
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                                placeholder="E.g., rewrite this to sound more casual, make it shorter, explain it to a 5 year old..."
                                value={personalizePrompt}
                                onChange={(e) =>
                                  setPersonalizePrompt(e.target.value)
                                }
                                disabled={isPersonalizing}
                              />
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => executePersonalize(idx)}
                                  disabled={
                                    !personalizePrompt.trim() || isPersonalizing
                                  }
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-colors"
                                >
                                  {isPersonalizing ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />{" "}
                                      Generating...
                                    </>
                                  ) : (
                                    "Update Block"
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {isEditMode && (
                          <div className="flex items-center justify-center py-4 flex-col gap-4 group/add">
                            <div className="flex items-center w-full">
                              <div className="h-[1px] flex-1 bg-gray-100 opacity-0 group-hover/add:opacity-100 transition-opacity"></div>
                              <div className="flex items-center gap-1 mx-4 bg-white border border-gray-200 shadow-sm rounded-full px-2 py-1 opacity-20 group-hover/add:opacity-100 transition-opacity">
                                {addingIdx === idx && isGeneratingNewBlock ? (
                                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] px-4 py-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                    GENERATING...
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase mr-1 px-2 border-r border-gray-100">
                                      Add after:
                                    </span>
                                    <button
                                      onClick={() => {
                                        setPromptingAddIdx(idx);
                                        setPromptingAddType("text");
                                      }}
                                      className={`p-1 px-2 hover:bg-gray-100 rounded-full text-[10px] font-bold flex items-center gap-1 ${promptingAddIdx === idx && promptingAddType === "text" ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                                    >
                                      <Type className="w-3 h-3" /> Text
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPromptingAddIdx(idx);
                                        setPromptingAddType("flashcard");
                                      }}
                                      className={`p-1 px-2 hover:bg-gray-100 rounded-full text-[10px] font-bold flex items-center gap-1 ${promptingAddIdx === idx && promptingAddType === "flashcard" ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                                    >
                                      <BookOpen className="w-3 h-3 text-emerald-500" />{" "}
                                      Flashcard
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPromptingAddIdx(idx);
                                        setPromptingAddType("image");
                                      }}
                                      className={`p-1 px-2 hover:bg-gray-100 rounded-full text-[10px] font-bold flex items-center gap-1 ${promptingAddIdx === idx && promptingAddType === "image" ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                                    >
                                      <Image className="w-3 h-3 text-pink-500" />{" "}
                                      Image
                                    </button>
                                  </>
                                )}
                              </div>
                              <div className="h-[1px] flex-1 bg-gray-100 opacity-0 group-hover/add:opacity-100 transition-opacity"></div>
                            </div>

                            {promptingAddIdx === idx &&
                              renderAddBlockPrompt(idx)}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="mt-20 pt-8 border-t border-gray-100 flex items-center justify-between">
                  <button
                    disabled={currentChapterIndex <= 0}
                    onClick={() =>
                      handleChapterChange(
                        flatOutlineChapters[currentChapterIndex - 1]?.id,
                      )
                    }
                    className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                    <div className="flex items-center gap-1">
                      {flatOutlineChapters.map((_, i) => (
                        <div
                          key={i}
                          className={`w-8 h-1.5 rounded-full ${i === currentChapterIndex ? "bg-indigo-600" : "bg-gray-200"}`}
                        ></div>
                      ))}
                    </div>
                    <span>
                      {currentChapterIndex + 1} / {totalChapters}
                    </span>
                  </div>

                  <button
                    disabled={currentChapterIndex >= totalChapters - 1}
                    onClick={() =>
                      handleChapterChange(
                        flatOutlineChapters[currentChapterIndex + 1]?.id,
                      )
                    }
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 shadow-sm transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
            ) : isGeneratingActive ? (
              <div className="flex items-center justify-center h-full text-indigo-600 p-8 flex-col gap-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="font-medium">Generating this chapter...</p>
                <p className="text-sm text-gray-500 max-w-md">
                  Our AI is reading your files and crafting the interactive
                  content for this chapter. This typically takes 10-15 seconds.
                </p>
              </div>
            ) : hasFailedActive ? (
              <div className="flex items-center justify-center h-full text-gray-400 p-8 flex-col gap-4 text-center">
                <p className="text-rose-500 font-medium">
                  Failed to generate this chapter.
                </p>
                {activeChapterRef?.errorMessage && (
                  <p className="text-sm text-gray-500 max-w-md">
                    {activeChapterRef.errorMessage}
                  </p>
                )}
                <button
                  onClick={() => generateChapter(activeChapterId as string)}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Try Again
                </button>
              </div>
            ) : dbChapter ? (
              <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Loading chapter content...</p>
              </div>
            ) : (activeChapterId && course?.outline) ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-2xl mx-auto p-8 pt-12">
                  <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                      <PenTool className="w-8 h-8" />
                    </div>
                    
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Draft Your Chapter
                      </h2>
                      <p className="text-gray-500">
                        {chapterInOutline?.title} is ready to be generated. Fine-tune these parameters to get the perfect version.
                      </p>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4 text-indigo-500" /> Chapter Objective/Guidance
                        </label>
                        <textarea
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[120px] focus:outline-none transition-all"
                          value={genConfig.guidance}
                          onChange={(e) => setGenConfig({ ...genConfig, guidance: e.target.value })}
                          placeholder="What should this chapter cover? Key takeaways..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-pink-500" /> Tone
                          </label>
                          <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={genConfig.tone}
                            onChange={(e) => setGenConfig({ ...genConfig, tone: e.target.value })}
                          >
                            <option value="conversational">Conversational & Friendly</option>
                            <option value="formal">Formal & Academic</option>
                            <option value="technical">Technical & Detailed</option>
                            <option value="humorous">Playful & Humorous</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-500" /> Depth
                          </label>
                          <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={genConfig.depth}
                            onChange={(e) => setGenConfig({ ...genConfig, depth: e.target.value })}
                          >
                            <option value="introductory">Introductory (ELI5)</option>
                            <option value="detailed">In-depth (Standard)</option>
                            <option value="advanced">Advanced / Expert</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" /> Specific Focus (Optional)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          value={genConfig.focus}
                          onChange={(e) => setGenConfig({ ...genConfig, focus: e.target.value })}
                          placeholder="e.g. Focus specifically on Newtonian physics analogies"
                        />
                      </div>

                      <button
                        onClick={() => generateChapter(activeChapterId as string, genConfig)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <Zap className="w-5 h-5 fill-current" /> Generate This Chapter
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Loading chapter content...</p>
              </div>
            )}
          </main>

          {rightPane && (
            <aside className={`${rightPane === "ai" && isChatExpanded ? "w-[500px]" : "w-80"} transition-all duration-300 bg-white border-l border-gray-200 flex flex-col shrink-0 custom-scrollbar shadow-sm z-20`}>
              <div 
                className="h-14 border-b border-gray-200 flex items-center justify-between px-3 shrink-0 bg-gray-50/50 relative"
                onMouseEnter={() => setIsHeaderHovered(true)}
                onMouseLeave={() => setIsHeaderHovered(false)}
              >
                <div className="flex items-center w-full min-w-0">
                  {rightPane === "ai" ? (
                    <>
                      <div className="shrink-0 mr-2 flex items-center justify-center w-6 h-6">
                        {isHeaderHovered ? (
                          <button
                            onClick={toggleChatExpansion}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                            title={isChatExpanded ? "Shrink Chat" : "Expand Chat"}
                          >
                            {isChatExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </button>
                        ) : (
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                        )}
                      </div>
                      
                      {chatSessions.length > 0 ? (
                        <div className="flex-1 min-w-0 relative">
                          <button
                            onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                            className="w-full flex items-center justify-between bg-transparent border-none text-sm font-bold text-gray-900 p-1.5 hover:bg-white/50 rounded-lg transition-colors cursor-pointer text-left group"
                          >
                            <span className="truncate flex-1">
                              {chatSessions.find(s => s.id === activeSessionId)?.title || "Select Chat"}
                            </span>
                            <Plus className={`w-3.5 h-3.5 text-gray-400 ml-1 transition-transform ${isChatMenuOpen ? 'rotate-45' : ''}`} />
                          </button>

                          {isChatMenuOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setIsChatMenuOpen(false)} 
                              />
                              <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <button
                                  onClick={() => {
                                    createNewSession();
                                    setIsChatMenuOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors border-b border-gray-100"
                                >
                                  <Plus className="w-4 h-4" /> New Chat
                                </button>
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                  {chatSessions.map((s) => (
                                    <div
                                      key={s.id}
                                      className={`group/item flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                                        activeSessionId === s.id 
                                          ? "bg-indigo-50 text-indigo-700 font-semibold" 
                                          : "text-gray-700 hover:bg-gray-100"
                                      }`}
                                      onClick={() => {
                                        setActiveSessionId(s.id);
                                        setIsChatMenuOpen(false);
                                      }}
                                    >
                                      <span className="truncate flex-1 mr-2">{s.title}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteSession(s.id);
                                          if (activeSessionId === s.id) setIsChatMenuOpen(false);
                                        }}
                                        className="opacity-0 group-hover/item:opacity-100 p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                        title="Delete chat"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                          <h3 className="font-bold text-gray-900 truncate">
                            Ask AI
                          </h3>
                          <button
                            onClick={() => createNewSession()}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="New Chat"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2 truncate">
                        <Notebook className="w-4 h-4 text-amber-500 shrink-0" />{" "}
                        Annotations
                      </h3>
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {annotations.length}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setRightPane(null)}
                  className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg transition-colors shrink-0 ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {rightPane === "ai" && (
                  <>
                    {!user ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 px-4">
                        <Lock className="w-10 h-10 text-indigo-400 mb-4" />
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Login required
                        </p>
                        <p className="text-xs text-gray-500 mb-4 px-2">
                          Log in to chat with the AI, ask questions about this course, and customize the experience.
                        </p>
                        <button onClick={openLoginModal} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                          Log In
                        </button>
                      </div>
                    ) : !activeChatSession || activeChatSession.messages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 px-4">
                        <Sparkles className="w-10 h-10 text-gray-300 mb-4" />
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          Chat with this chapter
                        </p>
                        <p className="text-sm text-gray-500">
                          Select text in the chapter or ask a question below.
                        </p>
                      </div>
                    ) : (
                      <>
                        {activeChatSession.messages.map((msg, i) => (
                          <div
                            key={msg.id || i}
                            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`p-3 rounded-2xl max-w-[90%] text-[13px] leading-relaxed ${
                                msg.role === "user"
                                  ? "bg-indigo-600 text-white rounded-br-sm"
                                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
                              }`}
                            >
                              <div className={msg.role === "user" ? "text-inherit" : "markdown-body text-sm font-sans bg-transparent p-0 leading-relaxed max-w-none text-inherit"}>
                                <Markdown>{msg.text}</Markdown>
                              </div>
                            </div>
                          </div>
                        ))}
                        {isChatLoading && streamingMessageText && (
                          <div className={`flex flex-col items-start`}>
                            <div className={`p-3 rounded-2xl max-w-[90%] text-[13px] leading-relaxed bg-gray-100 text-gray-800 rounded-bl-sm`}>
                              <div className="markdown-body text-sm font-sans bg-transparent p-0 leading-relaxed max-w-none text-inherit">
                                <Markdown>{streamingMessageText}</Markdown>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {isChatLoading && !streamingMessageText && (
                      <div className="flex items-center gap-2 text-indigo-500 text-xs font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is
                        thinking...
                      </div>
                    )}
                  </>
                )}
                {rightPane === "notes" && (
                  <>
                    {annotations.length > 0 && !showNoteInput && (
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setAnnotationsFilter("All")}
                          className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex-1 ${annotationsFilter === "All" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setAnnotationsFilter("Highlight")}
                          className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex-1 ${annotationsFilter === "Highlight" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          Highlight
                        </button>
                        <button
                          onClick={() => setAnnotationsFilter("Note")}
                          className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors flex-1 ${annotationsFilter === "Note" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          Note
                        </button>
                      </div>
                    )}

                    {annotations.length === 0 && !showNoteInput ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 px-4">
                        {!isCreator ? (
                           <>
                              <Lock className="w-10 h-10 text-amber-500 mb-4 opacity-70" />
                              <p className="text-sm font-medium text-gray-900 mb-2">
                                Creator Only
                              </p>
                              <p className="text-xs text-gray-500 mb-4 px-2">
                                Only the creator of this course can annotate and highlight text.
                              </p>
                              {!user && (
                                <button onClick={openLoginModal} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm mt-2">
                                  Log In
                                </button>
                              )}
                           </>
                        ) : (
                          <>
                            <Notebook className="w-10 h-10 text-amber-500 mb-4 xl:opacity-100 opacity-60" />
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              Your Annotations
                            </p>
                            <p className="text-sm text-gray-500">
                              Select text to add an annotation, or write general
                              notes.
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {annotations
                          .filter((a) =>
                            annotationsFilter === "All"
                              ? true
                              : annotationsFilter === "Highlight"
                                ? a.type === "highlight"
                                : a.type === "note",
                          )
                          .map((note) => {
                            const isEditing =
                              activeAnnotationId === note.id && showNoteInput;
                            return (
                              <div
                                key={note.id}
                                className={`bg-white rounded-xl p-5 border transition-all cursor-pointer group shadow-sm ${activeAnnotationId === note.id ? "border-indigo-400 ring-1 ring-indigo-400" : "border-gray-200 hover:border-gray-300"}`}
                                onClick={() => {
                                  if (!isEditing) {
                                    setActiveAnnotationId(note.id);
                                    const mark = document.getElementById(
                                      `mark-${note.id}`,
                                    );
                                    if (mark) {
                                      mark.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                      });
                                    }
                                    setSelectedHighlightText(note.text || "");
                                    setNoteInput(note.note || "");
                                    setShowNoteInput(true);
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-3 h-3 rounded-sm ${note.color === "yellow" ? "bg-yellow-300" : note.color === "green" ? "bg-green-300" : note.color === "blue" ? "bg-blue-300" : note.color === "pink" ? "bg-rose-300" : "bg-gray-300"}`}
                                    ></div>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                      {note.type}
                                    </span>
                                    {note.chapterTitle && (
                                      <span className="text-[11px] text-gray-400 ml-1 truncate max-w-[100px]">
                                        · Ch.{" "}
                                        {note.chapterTitle.replace(
                                          "chapter-",
                                          "",
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  {!isEditing && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeAnnotation(note);
                                      }}
                                      className={`text-gray-400 hover:text-rose-500 transition-opacity p-1 ${activeAnnotationId === note.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                {note.text && (
                                  <div className="text-sm font-medium text-gray-800 italic leading-relaxed mb-3">
                                    "{note.text}"
                                  </div>
                                )}

                                {isEditing ? (
                                  <div
                                    className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex gap-2 mb-3">
                                      {["yellow", "green", "blue", "pink"].map(
                                        (c) => (
                                          <button
                                            key={c}
                                            onClick={() =>
                                              setAnnotations((prev) =>
                                                prev.map((a) =>
                                                  a.id === note.id
                                                    ? { ...a, color: c }
                                                    : a,
                                                ),
                                              )
                                            }
                                            className={`w-6 h-6 rounded-full border-2 transition-all ${note.color === c ? "border-gray-900 scale-110" : "border-transparent hover:scale-105"} ${c === "yellow" ? "bg-yellow-300" : c === "green" ? "bg-green-300" : c === "blue" ? "bg-blue-300" : "bg-rose-300"}`}
                                          />
                                        ),
                                      )}
                                    </div>
                                    <textarea
                                      autoFocus
                                      value={noteInput}
                                      onChange={(e) =>
                                        setNoteInput(e.target.value)
                                      }
                                      placeholder="Add your note..."
                                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-3 min-h-[80px]"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={saveNote}
                                        disabled={
                                          !noteInput.trim() &&
                                          !activeAnnotationId
                                        }
                                        className="flex-1 px-4 py-2 bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setShowNoteInput(false);
                                          setActiveAnnotationId(null);
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                                      >
                                        Close
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {note.note && (
                                      <div className="bg-gray-50 rounded-lg p-3 mb-2 flex items-start gap-2">
                                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                                        <p className="text-[13px] text-gray-700 font-medium leading-relaxed">
                                          {note.note}
                                        </p>
                                      </div>
                                    )}
                                    <div className="text-[11px] text-gray-400 mt-2">
                                      {new Date(
                                        note.createdAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {showNoteInput && !activeAnnotationId && (
                      <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 shadow-xl mt-4 z-10 sticky bottom-4 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                            New Note
                          </span>
                          <button
                            onClick={() => {
                              setShowNoteInput(false);
                              setSelectedHighlightText("");
                              setNoteInput("");
                              setActiveAnnotationId(null);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <textarea
                          autoFocus
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="Add your note..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-3 min-h-[80px]"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={saveNote}
                            disabled={!noteInput.trim()}
                            className="px-5 py-2 bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm w-full"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
                {rightPane === "ai" && user && (
                  <div className="flex flex-col gap-2">
                    {chatSelectionContext && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 relative animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-start gap-2 pr-6">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-indigo-900 leading-relaxed line-clamp-3">
                            "{chatSelectionContext}"
                          </p>
                        </div>
                        <button
                          onClick={() => setChatSelectionContext(null)}
                          className="absolute top-2 right-2 p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <form className="relative group" onSubmit={handleSendChat}>
                      <textarea
                        rows={1}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChat();
                          }
                        }}
                        disabled={isChatLoading}
                        placeholder="Ask anything..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 resize-none min-h-[46px] max-h-32 custom-scrollbar"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isChatLoading}
                        className="absolute right-1.5 bottom-1.5 p-2 bg-indigo-600 disabled:opacity-50 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center group-hover:scale-105 active:scale-95"
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                )}
                {rightPane === "notes" && !showNoteInput && isCreator && (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Note
                  </button>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {isSelectionBoxVisible && selectionBox.text && !isEditMode && (
        <div
          className="fixed z-[100] bg-gray-900 border border-gray-700 text-white shadow-xl rounded-lg py-1.5 px-2 flex items-center gap-1 -translate-x-1/2 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[6px] before:border-transparent before:border-t-gray-900"
          style={{ top: selectionBox.top, left: selectionBox.left }}
        >
          <button
            className="px-2 py-1.5 hover:bg-gray-800 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
            onClick={() => {
              if (!user) {
                setRightPane("ai");
                setIsSelectionBoxVisible(false);
              } else askAboutSelection(selectionBox.text);
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Ask AI
          </button>
          {isCreator && (
            <>
              <div className="w-[1px] h-5 bg-gray-700 mx-0.5"></div>
              <button
                className="px-2 py-1.5 hover:bg-gray-800 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                onClick={() => startNote(selectionBox.text, selectionBox.blockIdx, selectionBox.occurrence)}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" /> Note
              </button>
              <div className="w-[1px] h-5 bg-gray-700 mx-0.5"></div>
              <button
                className="px-2 py-1.5 hover:bg-gray-800 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
                onClick={() => startHighlight(selectionBox.text, selectionBox.blockIdx, selectionBox.occurrence)}
              >
                <Highlighter className="w-3.5 h-3.5 text-yellow-400" /> Highlight
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
