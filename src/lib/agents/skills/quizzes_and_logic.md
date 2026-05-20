---
name: quizzes-and-logic
description: Standards for creating interactive quizzes, knowledge checks, and state-driven educational widgets. Use this to ensure functional, bug-free interactive components.
---

# Quizzes and Interactive Logic Standards

When building interactive components (quizzes, simulations, flashcards), follow these rigorous logic and UI patterns.

## 1. Professional Quiz Pattern
Do not just provide a list of buttons. A professional quiz requires:
- **Active State**: Tracking the user's current selection.
- **Submission State**: Preventing multiple answers after "Submit".
- **Feedback State**: Showing "Correct" or "Incorrect" along with an explanation.

### Implementation Example:
```tsx
const [selected, setSelected] = useState<number | null>(null);
const [isSubmitted, setIsSubmitted] = useState(false);

const options = [
  { text: "Choice A", correct: true, explanation: "Excellent! Because..." },
  { text: "Choice B", correct: false, explanation: "Not quite. While B is interesting..." }
];

const handleCheck = () => {
  if (selected !== null) setIsSubmitted(true);
};

return (
  <div className="p-8 bg-white border border-slate-200 rounded-3xl space-y-6">
    <h4 className="text-xl font-bold text-slate-900">Knowledge Check: Topic Name</h4>
    <div className="space-y-3">
      {options.map((opt, i) => (
        <button
          key={i}
          disabled={isSubmitted}
          onClick={() => setSelected(i)}
          className={cn(
            "w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group",
            selected === i ? "border-indigo-600 bg-indigo-50" : "border-slate-100 hover:border-slate-200 bg-slate-50",
            isSubmitted && opt.correct && "border-emerald-500 bg-emerald-50",
            isSubmitted && selected === i && !opt.correct && "border-rose-500 bg-rose-50"
          )}
        >
          <span className={cn("font-medium", selected === i ? "text-indigo-900" : "text-slate-700")}>
            {opt.text}
          </span>
          {isSubmitted && opt.correct && <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-in zoom-in" />}
          {isSubmitted && selected === i && !opt.correct && <XCircle className="w-5 h-5 text-rose-600 animate-in zoom-in" />}
        </button>
      ))}
    </div>

    {!isSubmitted ? (
      <button 
        onClick={handleCheck}
        disabled={selected === null}
        className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
      >
        Check My Answer
      </button>
    ) : (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "p-6 rounded-2xl",
          options[selected!].correct ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-900"
        )}
      >
        <p className="font-bold flex items-center gap-2 mb-1">
          {options[selected!].correct ? "Spot on!" : "Learning Opportunity!"}
        </p>
        <p className="text-sm italic">{options[selected!].explanation}</p>
      </motion.div>
    )}
  </div>
);
```

## 2. Interactive Simulations (The "Simulator" Pattern)
Use React state to drive multiple related properties.
- **Consolidated State**: If many values interact, use a single state object.
- **Derived Values**: Calculate results in the component body (or `useMemo`) to ensure they stay in sync.
- **Visual Mapping**: Map numerical values to SVG properties (size, rotation, position) or Recharts data.

## 3. Flashcards (The "Reveal" Pattern)
Ensure clear distinction between the "Front" (Question) and "Back" (Answer).
- Use `AnimatePresence` for a "flip" or "fade" effect.
- Include a "Did I know this?" self-assessment button or state toggle.

## 4. Accessibility & UI Polish
- **Focus States**: Ensure buttons have clear focus rings.
- **Contrast**: Never use low-contrast text (e.g., light gray on white).
- **ARIA**: Use appropriate roles for interactive components if possible.
