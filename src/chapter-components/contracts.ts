export const CHAPTER_COMPONENT_NAMES = [
  "ChapterHero",
  "Section",
  "SubSection",
  "Summary",
  "KeyTakeaways",
  "Quizz",
  "CodeBlock",
  "DataTable",
  "Quote",
  "Timeline",
  "ProcessFlow",
  "CopyNote",
] as const;

export type ChapterComponentName = (typeof CHAPTER_COMPONENT_NAMES)[number];

export const CHAPTER_RUNTIME_GLOBALS = [
  "React",
  "useState",
  "useMemo",
  "useEffect",
  "useCallback",
  "useRef",
  "cn",
  "chapterTheme",
  "motion",
  "AnimatePresence",
  ...CHAPTER_COMPONENT_NAMES,
] as const;
