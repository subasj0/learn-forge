import * as React from "react";
import * as LucideIcons from "lucide-react";
import * as Motion from "motion/react";
import * as Recharts from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CHAPTER_COMPONENT_NAMES } from "./contracts";
import {
  ChapterHero,
  CodeBlock,
  CopyNote,
  DataTable,
  DEFAULT_CHAPTER_THEME,
  KeyTakeaways,
  ProcessFlow,
  Quizz,
  Quote,
  Section,
  SubSection,
  Summary,
  Timeline,
} from "./index";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const chapterComponentScope = {
  ChapterHero,
  Section,
  SubSection,
  Summary,
  KeyTakeaways,
  Quizz,
  CodeBlock,
  DataTable,
  Quote,
  Timeline,
  ProcessFlow,
  CopyNote,
} as const;

for (const name of CHAPTER_COMPONENT_NAMES) {
  if (!(name in chapterComponentScope)) {
    throw new Error(`Missing chapter component in runner scope: ${name}`);
  }
}

export function buildChapterRunnerScope() {
  return {
    React,
    ...React,
    ...LucideIcons,
    ...Motion,
    ...Recharts,
    ...chapterComponentScope,
    chapterTheme: DEFAULT_CHAPTER_THEME,
    cn,
    motion: Motion.motion,
    AnimatePresence: Motion.AnimatePresence,
  };
}

export function prepareChapterCode(code: string) {
  const codeMatch = code.match(/```(?:typescript|tsx|javascript|jsx)?\n([\s\S]*?)(?:```|$)/);
  const cleaned = codeMatch ? codeMatch[1].trim() : code.replace(/```(?:typescript|tsx|javascript|jsx)?/g, "").replace(/```/g, "").trim();

  return cleaned
    .replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, "")
    .replace(/^import\s+['"].*?['"];?\s*$/gm, "")
    .trim();
}

export function hasChapterDefaultExport(code: string) {
  return prepareChapterCode(code).toLowerCase().includes("export default");
}
