import { GoogleGenAI, Type, Schema } from '@google/genai';
import { db, auth } from '../firebase';
import { doc, updateDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { jsonrepair } from 'jsonrepair';
import { checkBudget, recordUsage, BudgetExceededError } from './usageTracker';
import { uploadContent, uploadBinary } from '../storage';

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

export async function generateCourseOutline(courseId: string, topic: string, files?: {name: string, text: string}[], moduleType?: string, personalization?: any) {
  try {
    const userId = auth.currentUser?.uid;
    if (userId) {
      await checkBudget(userId);
    }
    
    let styleGuide = '';
    if (personalization) {
      styleGuide += `\nTarget Audience Complexity: ${personalization.complexity}`;
      if (personalization.intent) styleGuide += `\nLearning Goal: ${personalization.intent}`;
      if (personalization.interests) styleGuide += `\nEngage the user by connecting topics to these interests: ${personalization.interests}`;
    }

    const typeGuidance = moduleType === 'quick' ? 'Focus purely on exploring this new topic efficiently. Do not include heavy quiz sections, keep it exploratory and fast-paced.' 
      : moduleType === 'quiz' ? 'The primary focus is testing the user. Ensure the outline relies heavily on quizzes and knowledge checks.'
      : moduleType === 'flashcards' ? 'The primary focus is memorization. Keep the content bite-sized and perfect for flashcards.'
      : 'This is a guided lesson. Include a well-rounded mix of theory, practical examples, and interactive quizzes/exercises at the end of sections.';

    const textPrompt = `You are an expert curriculum designer.
Generate a comprehensive course outline.
${topic ? `Topic to guide the outline: "${topic}"` : 'Use the attached files to determine the topic and content of the course.'}
${styleGuide}
Course Type Guidance: ${typeGuidance}

If you are provided with attached documents/files, make sure the outline heavily reflects and covers the content of those files.
Structure the course into logical Parts, and within each Part, create several Chapters.
For each chapter, provide a detailed 'guidance' string that outlines exactly what the chapter should cover, key concepts, and any specific exercises or analogies to include based on the Course Type Guidance and style guide. This guidance will be used by another AI to write the actual chapter content.
Do not make it too long; a total of 2-3 Parts and 3-4 Chapters per part is ideal.
Return ONLY valid JSON data according to the schema.`;

    const parts: any[] = [{ text: textPrompt }];
    if (files && files.length > 0) {
      files.forEach((f) => {
        if (f.text) {
          parts.push({ text: `\n--- File: ${f.name} ---\n${f.text}\n--- End of File ---\n` });
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: outlineSchema,
        maxOutputTokens: 10000
      }
    });

    if (userId && response.usageMetadata) {
      await recordUsage(userId, 'gemini-3-flash-preview', response.usageMetadata.promptTokenCount, response.usageMetadata.candidatesTokenCount);
    }

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

    // Helper to resize base64 images to stay within Firestore limits
    const resizeBase64Image = (base64Str: string, maxWidth = 800): Promise<string> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined') {
          resolve(base64Str);
          return;
        }
        const img = new window.Image();
        img.src = base64Str;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = maxWidth / img.width;
          if (scale >= 1) {
            resolve(base64Str);
            return;
          }
          canvas.width = maxWidth;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.6)); // compressed jpeg
        };
        img.onerror = () => resolve(base64Str);
      });
    };

    // Background Image Generation task
    (async () => {
      try {
        if (outlineData.title) {
          const imageResp = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [{ text: `A beautiful, cinematic, and professional cover photo for an educational course titled "${outlineData.title}". ${topic ? `Theme: ${topic}` : ''}. High quality, elegant styling, no text or words in the image.` }]
            },
            config: {
              imageConfig: { aspectRatio: '16:9' }
            }
          });
          
          if (imageResp.candidates?.[0]?.content?.parts) {
            if (userId) {
              await recordUsage(userId, 'gemini-2.5-flash-image', 0, 1, true);
            }
            for (const part of imageResp.candidates[0].content.parts) {
              if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/jpeg';
                const rawBase64 = `data:${mimeType};base64,${part.inlineData.data}`;
                const resizedImage = await resizeBase64Image(rawBase64, 1024);
                
                // Convert base64 to Blob for storage
                const base64Data = resizedImage.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });
                
                const storagePath = `courses/${courseId}/cover.jpg`;
                const storageUrl = await uploadBinary(storagePath, blob, 'image/jpeg');
                
                await updateDoc(courseRef, { coverImageUrl: storageUrl });
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
      description: "A sequential list of content blocks that form the chapter. A healthy variety of block types prevents repetitive walls of text.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { 
            type: Type.STRING, 
            description: "MUST be one of: 'heading', 'subheading', 'text', 'image_placeholder', 'callout', 'try_it'." 
          },
          content: { 
            type: Type.STRING, 
            description: "The main body of the block. For 'text' use markdown format. For 'image_placeholder' describe the visual. For 'try_it' provide the exercise instructions. For 'callout' provide the notice message." 
          },
          title: { 
            type: Type.STRING, 
            description: "Used ONLY when type is 'try_it' as the title of the exercise." 
          },
          calloutType: { 
            type: Type.STRING, 
            description: "Used ONLY when type is 'callout'. A short label like 'Tip', 'Note', 'Warning', or 'Did You Know'." 
          }
        },
        required: ["type", "content"]
      }
    }
  },
  required: ["mainContent"]
};

export async function generateChapterContent(courseId: string, chapterInfo: { id: string; title: string; partTitle: string; guidance?: string }, courseContextInfo: string, orderIndex: number, userId: string, files?: {name: string, text: string}[], moduleType?: string, personalization?: any, onProgress?: (partial: any) => void) {

  try {
    if (userId) {
      await checkBudget(userId);
    }
    let styleGuide = '';
    if (personalization) {
      styleGuide += `\n- Target Audience Complexity: ${personalization.depth === 'introductory' ? 'Beginner' : personalization.depth === 'advanced' ? 'Advanced' : personalization.complexity || 'Intermediate'}`;
      styleGuide += `\n- Tone: ${personalization.tone || 'Balanced'}`;
      styleGuide += `\n- Interactivity Level: ${personalization.interactivity === 'high' ? 'High (include extra exercises and callouts)' : personalization.interactivity === 'minimal' ? 'Minimal (focus primarily on reading)' : 'Medium'}`;
      if (personalization.intent) styleGuide += `\n- Learning Goal: ${personalization.intent}`;
      if (personalization.focus) styleGuide += `\n- Specific Focus Area: ${personalization.focus}`;
      if (personalization.customGuidance) styleGuide += `\n- Custom Guidance: ${personalization.customGuidance}`;
      if (personalization.interests) styleGuide += `\n- Contextualize examples around these interests: ${personalization.interests}`;
    }

    const typeGuidance = moduleType === 'quick' ? 'Keep it highly concise and fast-paced.'
      : moduleType === 'quiz' ? 'Heavily emphasize interactive knowledge checks and reflection questions using the "try_it" block.'
      : moduleType === 'flashcards' ? 'Deliver information in bite-sized, independent concepts perfect for memorization.'
      : 'Provide a balanced mix of educational theory, practical examples, and short exercises.';

    const textPrompt = `You are an expert educational course designer crafting a chapter for a digital learning platform.
Your task is to generate the chapter using a sequence of layout blocks to create an engaging reading experience.

Context:
- Course Overview: ${courseContextInfo}
- Part: ${chapterInfo.partTitle}
- Chapter: ${chapterInfo.title}
${chapterInfo.guidance ? `- Chapter Objectives:\n${chapterInfo.guidance}\n` : ''}

Design Guidelines:${styleGuide}
- Overall Tone: ${typeGuidance}

Available Layout Blocks:
1. "heading": A main section title. (content: the title text)
2. "subheading": A secondary title to break up sections. (content: the subtitle text)
3. "text": Standard learning content. Use markdown for lists, bolding, and formatting. (content: markdown format)
4. "image_placeholder": Describe a specific, rich visual (chart, illustration, diagram). Our image AI will paint it. (content: description)
5. "callout": A highlighted box for important tips or warnings. (calloutType: e.g., 'Tip', content: the message)
6. "try_it": A practical reflection challenge or short exercise for the user. (title: exercise name, content: instructions)

Instructions:
- Sequence these blocks logically. Do not output one massive text block.
- Start directly with the content. Avoid repetitive introductory phrases.
- If referencing files, extract the relevant content directly.
- Ensure the output strictly follows the JSON schema.`;

    const parts: any[] = [{ text: textPrompt }];
    if (files && files.length > 0) {
      files.forEach((f) => {
        if (f.text) {
          parts.push({ text: `\n--- File: ${f.name} ---\n${f.text}\n--- End of File ---\n` });
        }
      });
    }

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: chapterSchema,
        maxOutputTokens: 10000
      }
    });

    let jsonText = "";
    let usageMetadata = null;
    let tick = 0;
    
    for await (const chunk of responseStream) {
      if (chunk.text) {
        jsonText += chunk.text;
      }
      if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
      
      if (onProgress) {
        try {
          let toRepair = jsonText;
          const match = jsonText.match(/\{[\s\S]*/);
          if (match) {
              toRepair = match[0];
              const repaired = jsonrepair(toRepair);
              const partialData = JSON.parse(repaired);
              onProgress({
                ...partialData,
                chapterId: chapterInfo.id,
                id: chapterInfo.id,
                isStreaming: true
              });
          }
        } catch(e) {
          // Silently ignore parse errors during streaming
        }
      }
    }

    if (userId && usageMetadata) {
      await recordUsage(userId, 'gemini-3-flash-preview', usageMetadata.promptTokenCount, usageMetadata.candidatesTokenCount);
    }

    let finalJsonText = jsonText || "{}";
    const match = finalJsonText.match(/\{[\s\S]*\}/);
    if (match) {
      finalJsonText = match[0];
    }
    
    let chapterData;
    try {
      chapterData = JSON.parse(finalJsonText);
    } catch (parseError) {
      console.warn("Standard JSON parse failed, attempting jsonrepair...", parseError);
      try {
        chapterData = JSON.parse(jsonrepair(finalJsonText));
      } catch (repairError) {
        throw new Error(`Chapter generation failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }

    // Save chapter as a new version
    const versionId = `${chapterInfo.id}_${Date.now()}`;
    const storagePath = `courses/${courseId}/chapters/${versionId}.json`;
    const contentUrl = await uploadContent(storagePath, JSON.stringify(chapterData));

    const chapterRef = doc(collection(db, 'courses', courseId, 'chapters'), versionId);
    await setDoc(chapterRef, {
      id: versionId,
      courseId,
      userId,
      chapterId: chapterInfo.id,
      contentUrl,
      order: orderIndex,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'done'
    });

    return chapterData;
  } catch (error) {
    console.error("Chapter generation failed:", error);
    throw error;
  }
}

export async function generateChatTitle(message: string): Promise<string> {
  try {
    const userId = auth.currentUser?.uid;
    if (userId) {
       await checkBudget(userId);
    }
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a very short title (4-5 words max) for a chat that starts with this message:\n"${message}"\n\nOutput only the title, no quotes or additional text.`
    });
    return response.text?.trim() || "New Chat";
  } catch (error) {
    console.error("Title generation failed:", error);
    return "New Chat";
  }
}

export async function chatWithChapterStream(
  chapterText: string, 
  message: string, 
  history: any[] = [], 
  onChunk: (text: string) => void
): Promise<string> {
  try {
     const userId = auth.currentUser?.uid;
     if (userId) {
       await checkBudget(userId);
     }

     const systemPrompt = `You are a helpful and educational AI assistant accompanying an interactive online course.
Relevant chapter content context:
---
${chapterText.substring(0, 40000)}
---
Answer the user's question, summarize, or modify the text as requested. Use standard markdown formatting. Provide concise and helpful answers.`;

     const contents = [...history, { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request:\n${message}` }]}];

     const responseStream = await ai.models.generateContentStream({
       model: "gemini-3-flash-preview",
       contents,
       config: {
         maxOutputTokens: 10000
       }
     });

     let fullText = "";
     let usageMetadata = null;

     for await (const chunk of responseStream) {
       if (chunk.text) {
         fullText += chunk.text;
         onChunk(fullText);
       }
       if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
     }

     if (userId && usageMetadata) {
       await recordUsage(userId, 'gemini-3-flash-preview', usageMetadata.promptTokenCount, usageMetadata.candidatesTokenCount);
     }

     return fullText || "No response generated.";
  } catch (error) {
     console.error("Chat generation failed:", error);
     throw error;
  }
}

export async function chatWithChapter(chapterText: string, message: string, history: any[] = []): Promise<string> {
  try {
     const userId = auth.currentUser?.uid;
     if (userId) {
       await checkBudget(userId);
     }

     const systemPrompt = `You are a helpful and educational AI assistant accompanying an interactive online course.
Relevant chapter content context:
---
${chapterText.substring(0, 40000)}
---
Answer the user's question, summarize, or modify the text as requested. Use standard markdown formatting. Provide concise and helpful answers.`;

     const contents = [...history, { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request:\n${message}` }]}];

     const response = await ai.models.generateContent({
       model: "gemini-3-flash-preview",
       contents,
       config: {
         maxOutputTokens: 10000
       }
     });

     if (userId && response.usageMetadata) {
       await recordUsage(userId, 'gemini-3-flash-preview', response.usageMetadata.promptTokenCount, response.usageMetadata.candidatesTokenCount);
     }

     return response.text || "No response generated.";
  } catch (error) {
     console.error("Chat generation failed:", error);
     throw error;
  }
}
