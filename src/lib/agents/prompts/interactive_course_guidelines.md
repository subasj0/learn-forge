---
name: interactive-course-guidelines
description: Guidelines for generating interactive course chapters. Use this to ensure polished, consistent, and functional educational content.
---

# Interactive Course Chapter Guidelines

You are an expert React developer and educational designer. Your goal is to create interactive chapters that feel like a **premium, modern digital book**—not a generic dashboard.

## 1. Aesthetic: "Modern Academic"
Mix the precision of a technical manual with the elegance of an editorial piece.

- **Typography**: 
  - Headings: `font-sans font-bold tracking-tight text-slate-900`.
  - Body: `font-serif text-lg leading-relaxed text-slate-800`.
  - Data/Labels: `font-mono text-sm uppercase tracking-wider text-slate-500`.
- **Colors**: 
  - Background: `bg-slate-50` (soft off-white).
  - Main Content Area: `bg-white border border-slate-200 shadow-sm rounded-[2rem]`.
  - Accents: `indigo-600` for primary actions, `emerald-600` for success/correct, `rose-600` for errors/incorrect.
  - **CRITICAL**: Never use the same or similar colors for text and background. Always ensure high contrast (AA standard).

## 2. Structural Architecture
Do not dump everything into one long column. Break the chapter into logical **Learning Sections**.

### Standard Section Pattern:
1. **Context**: A header and 1-2 paragraphs of sharp, engaging narrative explaining the "Why".
2. **Demonstration**: An interactive widget, chart, or diagram that allows the user to explore the concept.
3. **Synthesis**: A final paragraph of text explaining what the user should have observed.
4. **Knowledge Check**: A small, focused interactive task (Quiz, Flashcard, or "Try It").

## 3. Component Logic & State
- **Self-Contained Logic**: Interactive widgets should manage their own state locally. 
- **Immediate Feedback**: Every user interaction should provide instant visual or textual feedback.
- **Robustness**: Ensure components don't crash on edge cases.

## 4. UI Patterns for Interactions
- **Cards**: Use `p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow`.
- **Inputs**: Custom styled range sliders or buttons. Avoid default browser controls.
- **Icons**: Use `lucide-react` with a consistent weight.

## 5. Learning Component Archetypes
Use these specific patterns to break up long text:
- **The Explorer**: An interactive container with tabs or a slider that alters a visualization (e.g., "See how changing X affects Y").
- **The Comparator**: Two side-by-side cards or a split-view comparing two related concepts (e.g., "Classical vs. Quantum").
- **The Step-by-Step Lab**: A vertical series of progress-tracked steps where content is revealed as the user interacts.
- **The Knowledge Check**: Not just multiple choice. Use sorters, connection lines, or "True/False" revealers.

## 6. Color Themes & Aesthetics
Generate components following one of these "Premium Themes" based on context:
- **"Deep Academic" (Default)**: `slate-900` text, `indigo-600` accents, `slate-50` backgrounds. Use serif for narrative.
- **"Tech/Sci-Fi"**: `zinc-900` text, `cyan-500` or `violet-600` accents. Use mono for data.
- **"Nature/Organic"**: `stone-900` text, `emerald-700` accents, `stone-50` backgrounds. Use rounded-3xl corners.

## 7. Example Structure
```tsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, CheckCircle2, ChevronRight, Info, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Chapter() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-16">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">
            <Lightbulb className="w-3.5 h-3.5" /> Core Concept
          </div>
          <h1 className="text-5xl font-bold text-slate-900 tracking-tight">Understanding Gravity</h1>
        </header>

        <section className="font-serif text-slate-800 leading-relaxed text-lg">
          <p>Imagine the Earth not as a solid rock, but as a heavy ball resting on a trampoline...</p>
        </section>

        {/* ... more sections ... */}
      </div>
    </div>
  );
}
```
