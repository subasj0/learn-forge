import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, AlertCircle, Edit2, Share, Save, X, Send, Loader2 } from 'lucide-react';
import { editLearningModule } from '../lib/generate';
import { ModuleRenderer, ModuleData } from '../components/ModuleRenderer';

export default function Viewer() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    const docRef = doc(db, 'modules', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.userId !== user.uid) {
          setError('Unauthorized access.');
        } else if (data.status !== 'ready') {
          // If status is 'failed', show an error
          if (data.status === 'failed') {
            setError('Module generation failed. Please try again.');
            setIsGenerating(false);
          } else if (data.status === 'editing' || data.status === 'processing') {
             setIsGenerating(true);
          }
        } else {
          setModuleData({
            ...(data.generatedData || {}),
            html: data.generatedHtml,
            title: data.generatedData?.title || data.title || 'Untitled Module'
          });
          setIsGenerating(false);
          setIsEditMode(false); // Close edit mode when done
        }
      } else {
        setError('Module not found.');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Failed to load module.');
      setLoading(false);
    });

    return unsubscribe;
  }, [id, user]);

  const handleEditSubmit = async () => {
    if (!editPrompt.trim() || !id || !moduleData) return;
    
    setIsGenerating(true);
    const promptToSend = editPrompt;
    setSubmittedPrompt(promptToSend);
    setEditPrompt('');
    
    // Call the AI generator in the background
    void editLearningModule(id, moduleData, promptToSend);
  };

  if (loading) {
    return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-gray-500">Loading module...</div>;
  }

  if (error || !moduleData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Error</h2>
        <p className="text-gray-500 mt-2 mb-8">{error}</p>
        <Link to="/home" className="text-indigo-600 hover:text-indigo-800 font-medium">
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#F9FAFB] overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm relative z-20">
         <div className="flex-1 flex items-center">
             <Link to="/home" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back
             </Link>
         </div>
         <div className="flex-1 flex items-center justify-center">
            <h1 className="text-sm font-bold text-gray-900 truncate px-4">{moduleData.title || 'Untitled Module'}</h1>
         </div>
         <div className="flex-1 flex items-center justify-end gap-3">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
              <Share className="w-3.5 h-3.5" /> Share
            </button>
            {!moduleData.html && !isEditMode && (
              <button onClick={() => setIsEditMode(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-sm">
                <Edit2 className="w-3.5 h-3.5" /> AI Edit
              </button>
            )}
            {!moduleData.html && isEditMode && (
              <button onClick={() => setIsEditMode(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                <X className="w-3.5 h-3.5" /> Close Editor
              </button>
            )}
         </div>
      </header>

      <div className="flex-1 w-full bg-white relative flex overflow-y-auto">
        {isGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/75 backdrop-blur-md transition-all duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center max-w-sm text-center ring-1 ring-gray-100">
               <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                 <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
               </div>
               <h3 className="text-lg font-bold text-gray-900">Applying AI Edits</h3>
               <p className="text-sm text-gray-500 mt-2">
                 Your changes are currently being processed. This can take a moment, please do not close the window...
               </p>
            </div>
          </div>
        )}
        
        <div className="w-full relative pb-24 h-full">
          {moduleData.html ? (
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <script src="https://cdn.tailwindcss.com"></script>
                  <style>
                    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 2rem; color: #111827; line-height: 1.6; background: white; }
                    h1, h2, h3 { font-weight: 700; color: #111827; margin-top: 1.5rem; margin-bottom: 0.75rem; letter-spacing: -0.025em; }
                    h1 { font-size: 2.25rem; }
                    h2 { font-size: 1.5rem; }
                    p { margin-bottom: 1rem; color: #374151; }
                  </style>
                </head>
                <body>
                  ${moduleData.html}
                </body>
                </html>
              `}
              title="Module Viewer"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-top-navigation allow-same-origin"
            />
          ) : (
            <ModuleRenderer data={moduleData} />
          )}
        </div>

        {(isEditMode || isGenerating) && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-gray-200 rounded-2xl p-2 flex items-center gap-2 z-20">
            {isGenerating ? (
              <div className="flex-1 flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">Applying AI edits...</span>
                    <span className="text-xs text-gray-500 truncate max-w-md">
                      "{submittedPrompt || 'Processing changes...'}"
                    </span>
                  </div>
                </div>
                <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full animate-pulse">
                  Working
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="How should I change this module? e.g. Add a quiz section"
                  className="flex-1 bg-transparent px-4 py-2 outline-none text-sm text-gray-900 placeholder:text-gray-400 disabled:opacity-50"
                  disabled={isGenerating}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editPrompt.trim() && !isGenerating) {
                      handleEditSubmit();
                    }
                  }}
                />
                <button
                  disabled={!editPrompt.trim() || isGenerating}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
                  onClick={handleEditSubmit}
                >
                  <Send className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

