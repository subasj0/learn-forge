import { GoogleGenAI, Type, Schema } from '@google/genai';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { jsonrepair } from 'jsonrepair';

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY }); // fallback

// Types
export interface CourseOutlinePart {
  id: string;
  title: string;
  chapters: CourseOutlineChapter[];
}

export interface CourseOutlineChapter {
  id: string;
  title: string;
}

const outlineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A catchy title for the entire course" },
    parts: {
      type: Type.ARRAY,
      description: "Major sections or parts of the course",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique url-safe chapter id, e.g. 'what-is-design-thinking'" },
                title: { type: Type.STRING }
              },
              required: ["id", "title"]
            }
          }
        },
        required: ["id", "title", "chapters"]
      }
    }
  },
  required: ["title", "parts"]
};

export async function generateCourseOutline(courseId: string, topic: string, files?: any[]) {
  try {
    const textPrompt = `You are an expert curriculum designer.
Generate a comprehensive course outline.
${topic ? `Topic to guide the outline: "${topic}"` : 'Use the attached files to determine the topic and content of the course.'}
If you are provided with attached documents/files, make sure the outline heavily reflects and covers the content of those files.
Structure the course into logical Parts, and within each Part, create several Chapters.
Do not make it too long; a total of 2-3 Parts and 3-4 Chapters per part is ideal.
Return ONLY valid JSON data according to the schema.`;

    const parts: any[] = [{ text: textPrompt }];
    if (files && files.length > 0) {
      parts.push(...files);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: outlineSchema
      }
    });

    let jsonText = response.text || "{}";
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      jsonText = match[0];
    }
    
    let outlineData;
    try {
      outlineData = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn("Standard JSON parse failed, attempting jsonrepair...", parseError);
      try {
        outlineData = JSON.parse(jsonrepair(jsonText));
      } catch (repairError) {
        throw new Error(`Failed to parse generated course outline JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
    
    if (outlineData.parts) {
      outlineData.parts.forEach((part: any, pIdx: number) => {
        if (part.chapters) {
          part.chapters.forEach((chap: any, cIdx: number) => {
             chap.id = (chap.id || `chap-${pIdx}-${cIdx}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);
          });
        }
      });
    }

    // Update the course with the new outline
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      title: outlineData.title,
      outline: outlineData.parts,
      status: 'ready',
      updatedAt: serverTimestamp()
    });

    return outlineData;
  } catch (error) {
    console.error("Outline generation failed:", error);
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      updatedAt: serverTimestamp()
    });
    throw error;
  }
}

// Chapter generation
const chapterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mainContent: {
      type: Type.ARRAY,
      description: "Blocks of main content for the center column",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "'heading', 'text', 'image_placeholder', 'callout'" },
          content: { type: Type.STRING, description: "Text or markdown content. For images, a description." },
          calloutType: { type: Type.STRING, description: "'Think About It', 'Tip', etc. (if type is callout)" }
        },
        required: ["type", "content"]
      }
    },
    sidebarContent: {
      type: Type.ARRAY,
      description: "Interactive blocks for the right sidebar (e.g. Try it yourself, Quiz, Key Takeaways)",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "'try_it', 'quiz', 'takeaway'" },
          title: { type: Type.STRING, description: "Block title" },
          content: { type: Type.STRING, description: "Description or text" },
          // For Quiz
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctOptionIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING }
        },
        required: ["type", "title"]
      }
    }
  },
  required: ["mainContent", "sidebarContent"]
};

export async function generateChapterContent(courseId: string, chapterInfo: { id: string; title: string; partTitle: string }, courseContextInfo: string, orderIndex: number, userId: string, files?: any[]) {
  try {
    const textPrompt = `You are generating a specific chapter for an interactive online course.
Course overall context: ${courseContextInfo}
Current Part: ${chapterInfo.partTitle}
Current Chapter: ${chapterInfo.title}

Generate the detailed content for this chapter. If you are provided with attached documents/files, make sure you extract the relevant content for this chapter from those files rather than making it up.
Structure:
- 'mainContent': Rich educational text, headings, placeholders for diagrams, and callouts (e.g., 'Think About It'). If information is missing from the document, fill in educational blanks naturally.
- 'sidebarContent': Interactive elements that sit alongside the text. Include AT LEAST one 'try_it' exercise, one 'quiz' (multiple choice), and one 'takeaway' summary block.

Make the educational content engaging, concise, and structured. Only return valid JSON matching the schema.`;

    const parts: any[] = [{ text: textPrompt }];
    if (files && files.length > 0) {
      parts.push(...files);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: chapterSchema
      }
    });

    let jsonText = response.text || "{}";
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      jsonText = match[0];
    }
    
    let chapterData;
    try {
      chapterData = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn("Standard JSON parse failed, attempting jsonrepair...", parseError);
      try {
        chapterData = JSON.parse(jsonrepair(jsonText));
      } catch (repairError) {
        throw new Error(`Chapter generation failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }

    // Save chapter
    const chapterRef = doc(collection(db, 'courses', courseId, 'chapters'), chapterInfo.id);
    await setDoc(chapterRef, {
      courseId,
      userId,
      chapterId: chapterInfo.id,
      ...chapterData,
      order: orderIndex,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return chapterData;
  } catch (error) {
    console.error("Chapter generation failed:", error);
    throw error;
  }
}
