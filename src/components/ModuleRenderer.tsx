import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { CheckCircle2, XCircle, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ModuleData {
  title: string;
  outline: { id: string; title: string; }[];
  sections: Section[];
  html?: string;
}

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export type Block = 
  | { type: 'text'; content: string }
  | { type: 'mcq'; question: string; options: string[]; correctAnswerIndex: number; explanation: string }
  | { type: 'flashcard'; front: string; back: string }
  | { type: 'key_takeaways'; items: string[] }
;

function MCQBlock({ block }: { block: any }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selected === block.correctAnswerIndex;
  
  const options = block.options && block.options.length > 0 ? block.options : [];

  return (
    <div className="bg-white border text-left border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm my-8 w-full group transition-all hover:shadow-md">
      <div className="mb-6 prose prose-indigo max-w-none prose-p:font-medium prose-p:text-lg prose-p:text-gray-900 prose-headings:text-gray-900">
        <Markdown>{block.question || 'No question provided.'}</Markdown>
      </div>
      <div className="space-y-3">
        {options.map((opt: string, idx: number) => {
          const isSelected = selected === idx;
          const isActuallyCorrect = idx === block.correctAnswerIndex;
          
          let btnClass = "w-full text-left px-5 py-4 rounded-xl border text-base transition-all flex items-center justify-between ";
          
          if (!submitted) {
            btnClass += isSelected 
              ? "border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-600 shadow-sm" 
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium";
          } else {
            if (isActuallyCorrect) {
              btnClass += "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500 shadow-sm font-medium";
            } else if (isSelected && !isActuallyCorrect) {
              btnClass += "border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-500 shadow-sm font-medium";
            } else {
              btnClass += "border-gray-200 bg-gray-50 text-gray-500 opacity-60";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => {
                if (!submitted) setSelected(idx);
              }}
              disabled={submitted}
              className={btnClass}
            >
              <div className="flex items-center gap-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                  ${!submitted && isSelected ? 'bg-indigo-600 text-white' : ''}
                  ${!submitted && !isSelected ? 'bg-gray-100 text-gray-500' : ''}
                  ${submitted && isActuallyCorrect ? 'bg-emerald-500 text-white' : ''}
                  ${submitted && isSelected && !isActuallyCorrect ? 'bg-rose-500 text-white' : ''}
                  ${submitted && !isSelected && !isActuallyCorrect ? 'bg-gray-100 text-gray-400' : ''}
                `}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <div className="markdown-body prose prose-sm max-w-none">
                  <Markdown>{opt}</Markdown>
                </div>
              </div>
              
              <div className="flex-shrink-0 ml-4">
                {submitted && isActuallyCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                {submitted && isSelected && !isActuallyCorrect && <XCircle className="w-6 h-6 text-rose-500" />}
                {!submitted && isSelected && <Check className="w-6 h-6 text-indigo-600" />}
              </div>
            </button>
          );
        })}
      </div>
      
      {!submitted && selected !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex justify-end"
        >
          <button 
            onClick={() => setSubmitted(true)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 text-white font-medium rounded-xl transition-all shadow-sm"
          >
            Check Answer
          </button>
        </motion.div>
      )}

      {submitted && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-8 p-6 rounded-2xl text-base ${isCorrect ? 'bg-emerald-50 text-emerald-950 border border-emerald-200' : 'bg-rose-50 text-rose-950 border border-rose-200'}`}
        >
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg mb-2">{isCorrect ? 'Excellent!' : 'Not quite right.'}</h4>
              <div className="prose prose-sm max-w-none opacity-90">
                <Markdown>{block.explanation || (isCorrect ? 'Great job getting the right answer.' : 'Review the concepts and try again.')}</Markdown>
              </div>
              
              {!isCorrect && (
                <button 
                  onClick={() => { setSelected(null); setSubmitted(false); }}
                  className="mt-6 px-5 py-2 bg-white border border-rose-200 rounded-xl text-sm font-semibold hover:bg-rose-100 hover:text-rose-900 transition-colors shadow-sm text-rose-700"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function FlashcardBlock({ block }: { block: any }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="my-8">
      <div 
        className="relative w-full h-[320px] perspective-1000 cursor-pointer group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          className="w-full h-full relative preserve-3d"
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-gray-100 shadow-sm hover:shadow-md rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center text-center transition-all">
             <span className="absolute top-6 left-6 text-xs font-bold tracking-widest text-indigo-400/70 uppercase">Flashcard</span>
             <div className="prose prose-indigo max-w-none">
               <h3 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
                 {block.front || block.question || block.title || 'Tap to flip'}
               </h3>
             </div>
             <div className="absolute bottom-6 right-6 flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
               Click to flip <ChevronRight className="w-3 h-3" />
             </div>
          </div>

          {/* Back */}
          <div 
            className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-md rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center text-center overflow-y-auto"
            style={{ transform: "rotateY(180deg)" }}
          >
             <span className="absolute top-6 left-6 text-xs font-bold tracking-widest text-indigo-200/70 uppercase">Answer</span>
             <div className="prose prose-invert max-w-none prose-p:text-lg md:prose-p:text-xl prose-p:leading-relaxed prose-p:font-medium">
               <Markdown>{block.back || block.answer || block.explanation || block.content || 'No text provided'}</Markdown>
             </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function TextBlock({ block }: { block: any }) {
  return (
    <div className="my-4 text-gray-700 leading-relaxed max-w-none markdown-body prose prose-indigo">
      <Markdown>{block.content}</Markdown>
    </div>
  );
}

function KeyTakeawaysBlock({ block }: { block: any }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 my-6 shadow-sm">
      <h4 className="text-amber-800 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-xs">
        <ChevronRight className="w-4 h-4" /> Key Takeaways
      </h4>
      <ul className="space-y-2">
        {block.items?.map((item: string, idx: number) => (
          <li key={idx} className="flex items-start gap-3 text-amber-900 text-sm">
            <span className="bg-amber-200 text-amber-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
              {idx + 1}
            </span>
            <span className="pt-[1px] leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ModuleRenderer({ data }: { data: ModuleData }) {
  if (!data?.sections) return <div className="p-8 text-center text-gray-500">Invalid module data.</div>;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <header className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6">
          {data.title}
        </h1>
        {data.outline && data.outline.length > 0 && (
          <div className="inline-block text-left bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm min-w-[300px]">
             <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 font-mono">Contents</h4>
             <ul className="space-y-2">
               {data.outline?.map((item, idx) => (
                 <li key={idx}>
                   <a href={`#${item.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline text-sm flex items-center gap-2">
                     <span className="text-gray-400 font-mono text-xs">{idx + 1}.</span> {item.title}
                   </a>
                 </li>
               ))}
             </ul>
          </div>
        )}
      </header>

      <div className="space-y-16">
        {data.sections?.map((section, sIdx) => (
          <section key={sIdx} id={section.id} className="scroll-mt-24">
            {section.title && (
              <h2 className="text-3xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-100 font-sans tracking-tight">
                {section.title}
              </h2>
            )}
            
            <div className="flex flex-col gap-2">
              {section.blocks?.map((block: any, bIdx: number) => {
                switch (block.type) {
                  case 'text':
                    return <TextBlock key={bIdx} block={block} />;
                  case 'mcq':
                    return <MCQBlock key={bIdx} block={block} />;
                  case 'flashcard':
                    return <FlashcardBlock key={bIdx} block={block} />;
                  case 'key_takeaways':
                    return <KeyTakeawaysBlock key={bIdx} block={block} />;
                  default:
                    return <div key={bIdx} className="text-red-500">Unknown block type: {block?.type}</div>;
                }
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
