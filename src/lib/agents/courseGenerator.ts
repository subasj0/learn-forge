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
  guidance?: string;
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
                title: { type: Type.STRING },
                guidance: { type: Type.STRING, description: "A highly detailed summary or set of instructions on what this chapter should cover, which will be passed to the next agent." }
              },
              required: ["id", "title", "guidance"]
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
For each chapter, provide a detailed 'guidance' string that outlines exactly what the chapter should cover, key concepts, and any specific exercises or analogies to include. This guidance will be used by another AI to write the actual chapter content.
Do not make it too long; a total of 2-3 Parts and 3-4 Chapters per part is ideal.
Return ONLY valid JSON data according to the schema.`;

    const parts: any[] = [{ text: textPrompt }];
    if (files && files.length > 0) {
      parts.push(...files);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    // Background Image Generation task
    (async () => {
      try {
        if (outlineData.title) {
          const imageResp = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [{ text: `A beautiful, cinematic, and professional cover photo for an educational course titled "${outlineData.title}". ${topic ? `Theme: ${topic}` : ''}. High quality, elegant styling, 4k resolution, no text or words in the image.` }]
            },
            config: {
              imageConfig: { aspectRatio: '16:9' }
            }
          });
          
          if (imageResp.candidates?.[0]?.content?.parts) {
            for (const part of imageResp.candidates[0].content.parts) {
              if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/jpeg';
                const coverImageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                await updateDoc(courseRef, { coverImageUrl });
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error('Cover image generation failed in background:', e);
      }
    })();

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
      description: "An array of content blocks that make up the chapter. The sequence of these blocks defines the reading flow. Avoid repetitive sequences.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { 
            type: Type.STRING, 
            description: "The type of content block. MUST be one of: 'heading', 'text', 'image_placeholder', 'callout', 'quiz', 'flashcard', 'try_it'." 
          },
          content: { 
            type: Type.STRING, 
            description: "Used for: 'text' (markdown format), 'image_placeholder' (describe the image to be generated), 'flashcard' (the front/question text), 'try_it' (the task instructions), 'callout' (the message body). For other types, this may be left empty." 
          },
          title: { 
            type: Type.STRING, 
            description: "Used for: 'try_it' (exercise title) or 'quiz' (optional context title)." 
          },
          calloutType: { 
            type: Type.STRING, 
            description: "Used ONLY when type is 'callout'. Choose a label like 'Tip', 'Note', 'Warning', 'Think About It', etc." 
          },
          question: { 
            type: Type.STRING, 
            description: "Used ONLY when type is 'quiz'. The question being asked." 
          },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "Used ONLY when type is 'quiz'. An array of string answer options (e.g. 3-4 strings). MUST be an array of plain strings, not objects." 
          },
          correctOptionIndex: { 
            type: Type.INTEGER, 
            description: "Used ONLY when type is 'quiz'. The integer index (0-based) of the correct answer in the 'options' array." 
          },
          explanation: { 
            type: Type.STRING, 
            description: "Used ONLY when type is 'quiz'. Explains why the correct answer is right." 
          },
          backContent: { 
            type: Type.STRING, 
            description: "Used ONLY when type is 'flashcard'. The back/answer text of the flashcard." 
          }
        },
        required: ["type"]
      }
    }
  },
  required: ["mainContent"]
};

export async function generateChapterContent(courseId: string, chapterInfo: { id: string; title: string; partTitle: string; guidance?: string }, courseContextInfo: string, orderIndex: number, userId: string, files?: any[]) {

  try {
    const textPrompt = `You are a world-class course creator crafting an interactive chapter for an online course.
You must construct the chapter by organizing various sequential content blocks.
To combat repetitive text loops, use a diverse mix of 'types'. Do not output long walls of text. Be highly engaging and concise.

Course overall context: ${courseContextInfo}
Current Part: ${chapterInfo.partTitle}
Current Chapter: ${chapterInfo.title}
${chapterInfo.guidance ? `\nChapter Guidance / Instructions:\n${chapterInfo.guidance}\n` : ''}

Available Block Types & How to Use Them:
1. 'heading': Use to structure the document into sections. (content: text to display)
2. 'text': Use for paragraphs of main content. Provide standard markdown formatting. Limit paragraph length. (content: markdown)
3. 'image_placeholder': Describe a visual concept heavily detailed so an image generator can create it. (content: description)
4. 'callout': Draw attention to a specific point. (calloutType: e.g. 'Tip' or 'Warning', content: the message)
5. 'quiz': A multiple choice question to test understanding. MUST match this exact format: {"type":"quiz","question":"...","options":["Option 1","Option 2","Option 3"],"correctOptionIndex":0,"explanation":"..."}
6. 'flashcard': Introduce a concept on front, explain on back. (content: front text, backContent: back text)
7. 'try_it': A practical exercise for the user. (title: exercise name, content: task instructions)

Guidelines:
- Start with a 'heading' block.
- Provide the core educational content using 'text' blocks.
- Break up text using 'callout', 'image_placeholder', and 'flashcard'.
- Use 'try_it' to make the user practice.
- Embed 'quiz' questions to validate knowledge.
- If you are provided with attached documents/files, make sure you extract the relevant content for this chapter from those files rather than making it up.

Only return valid JSON matching the schema. NEVER repeat the exact same paragraph or section over and over.`;

    const parts: any[] = [{ text: textPrompt }];
    if (files && files.length > 0) {
      parts.push(...files);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

export async function chatWithChapter(chapterText: string, message: string, history: any[] = []): Promise<string> {
  try {
     const systemPrompt = `You are a helpful and educational AI assistant accompanying an interactive online course.
Relevant chapter content context:
---
${chapterText.substring(0, 40000)}
---
Answer the user's question, summarize, or modify the text as requested. Use standard markdown formatting. Provide concise and helpful answers.`;

     const contents = [...history, { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request:\n${message}` }]}];

     const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents,
     });
     return response.text || "No response generated.";
  } catch (error) {
     console.error("Chat generation failed:", error);
     throw error;
  }
}
