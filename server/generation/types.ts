export interface SourceFile {
  name: string;
  text?: string;
}

export interface CourseOutlineChapter {
  id: string;
  title: string;
  guidance?: string;
}

export interface CourseOutlinePart {
  id: string;
  title: string;
  chapters: CourseOutlineChapter[];
}

export interface CourseOutline {
  title: string;
  parts: CourseOutlinePart[];
}

export interface GenerationConfig {
  guidance?: string;
  tone?: string;
  depth?: string;
  focus?: string;
}

export interface ChapterVersionRef {
  versionId: string;
  storagePath: string;
  contentType: string;
  moduleType: string;
  createdAtMs: number;
  generationConfig: GenerationConfig;
}

