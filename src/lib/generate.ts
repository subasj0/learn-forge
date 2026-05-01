import { GoogleGenAI, Type } from '@google/genai';
import { db } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { jsonrepair } from 'jsonrepair';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const learningModuleSchema = {
  type: Type.OBJECT,
  properties: {
     title: { type: Type.STRING, description: "A catchy 4-5 word title for the module" },
     outline: {
       type: Type.ARRAY,
       description: "Table of contents",
       items: {
         type: Type.OBJECT,
         properties: {
           id: { type: Type.STRING, description: "Unique URL-safe ID for the section" },
           title: { type: Type.STRING, description: "Title of the section" }
         },
         required: ["id", "title"]
       }
     },
     sections: {
       type: Type.ARRAY,
       items: {
         type: Type.OBJECT,
         properties: {
           id: { type: Type.STRING, description: "Must match an ID from the outline" },
           title: { type: Type.STRING, description: "Title of the section" },
           blocks: {
             type: Type.ARRAY,
             items: {
               // We add answer and question as fallbacks
               type: Type.OBJECT,
               properties: {
                 type: { type: Type.STRING, description: "One of: 'text', 'mcq', 'flashcard', 'key_takeaways'" },
                 content: { type: Type.STRING, description: "Markdown text for 'text' block" },
                 question: { type: Type.STRING, description: "Question for 'mcq' block, or front text for 'flashcard'" },
                 options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of 3-4 string options for 'mcq' block" },
                 correctAnswerIndex: { type: Type.INTEGER, description: "Index (0-based) of the correct option for 'mcq'" },
                 explanation: { type: Type.STRING, description: "Explanation of the correct answer for 'mcq'" },
                 front: { type: Type.STRING, description: "Front text for 'flashcard'" },
                 back: { type: Type.STRING, description: "Back text (answer) for 'flashcard'" },
                 answer: { type: Type.STRING, description: "Answer text for 'flashcard' (alternative to back)" },
                 items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of string bullet points for 'key_takeaways'" }
               },
               required: ["type"]
             }
           }
         },
         required: ["id", "title", "blocks"]
       }
     }
  },
  required: ["title", "outline", "sections"]
};

const getSystemPrompt = (type?: string) => {
  const basePrompt = `You are an expert learning experience generator.
Your task is to transform raw learning content (text, notes, files) OR a requested topic into a structured learning module JSON format.
If the provided content is short (like a topic request), use your internal knowledge to teach that topic.
First, logically plan the table of contents (outline) of the module.
Then, populate the sections with content blocks.

Available block types and EXACT allowed properties for each:
1. 'text' -> "type": "text", "content": "<markdown text>"
2. 'mcq' -> "type": "mcq", "question": "<question>", "options": ["Actual option 1", "Actual option 2", "Actual option 3"], "correctAnswerIndex": 0, "explanation": "<reason>"
3. 'flashcard' -> "type": "flashcard", "front": "<front text>", "back": "<back text>"
4. 'key_takeaways' -> "type": "key_takeaways", "items": ["point 1", "point 2"]

Important rules:
- Ensure 'id' for sections matches exactly with 'id' in outline.
- Keep the content concise and focused.
- Output ONLY valid JSON matching the schema, with no additional markdown formatting or text.
- Do NOT add any extra properties to blocks that are not defined above.
`;

  switch(type) {
    case 'quick':
      return basePrompt + `
Specific Requirements for "Quick Review":
- Extract the core concepts and summarize them concisely.
- Use 'key_takeaways' frequently.
- Do NOT include lengthy explanations.
`;
    case 'quiz':
      return basePrompt + `
Specific Requirements for "Quiz":
- Generate a rigorous Quiz focusing on testing knowledge.
- The module should consist entirely of 'mcq' blocks.
- Include AT LEAST 5 Multiple Choice Questions.
- Each MCQ must have an explanation for the correct answer.
`;
    case 'flashcards':
      return basePrompt + `
Specific Requirements for "Flashcards":
- Create a set of flashcards.
- The module should mainly consist of 'flashcard' blocks.
- Generate at least 5-10 flashcards from the provided content.
`;
    case 'guided':
    default:
      return basePrompt + `
Specific Requirements for "Guided Lesson":
- Break content into logical sections with clear headings.
- Present concepts progressively using 'text' blocks.
- Intersperse 'mcq' or 'flashcard' blocks occasionally to test understanding.
`;
  }
};

export interface FileData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export const generateLearningModule = async (moduleId: string, rawContent: string, userId: string, files?: FileData[], moduleType?: string) => {
  try {
    const promptText = getSystemPrompt(moduleType) + (rawContent.trim() ? "\n\nRaw content to transform:\n" + rawContent : "");
    const parts: any[] = [{ text: promptText }];
    if (files && files.length > 0) {
      parts.push(...files);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: learningModuleSchema
      }
    });

    let generatedData = null;
    let generatedTitle = "Generated Module";
    try {
      let jsonText = response.text || "{}";
      
      console.log("Raw Response received:", jsonText.substring(0, 500) + (jsonText.length > 500 ? "..." : ""));
      
      // Much more robust JSON extraction
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        jsonText = match[0];
      }
      
      try {
        generatedData = JSON.parse(jsonText);
      } catch (parseError) {
        console.warn("Standard JSON parse failed, attempting jsonrepair...", parseError);
        generatedData = JSON.parse(jsonrepair(jsonText));
      }
      generatedTitle = generatedData.title || generatedTitle;
    } catch(e) {
      console.warn("Failed to parse JSON response", e);
      throw new Error(`Failed to parse generated learning module into valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Update the document to ready
    const moduleRef = doc(db, 'modules', moduleId);
    await updateDoc(moduleRef, {
      status: 'ready',
      title: generatedTitle,
      generatedData: generatedData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Generation failed:", error);
    // Update to failed
    const moduleRef = doc(db, 'modules', moduleId);
    await updateDoc(moduleRef, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      updatedAt: serverTimestamp()
    });
  }
};

const EDIT_SYSTEM_PROMPT = `You are an expert learning experience editor.
You are given the JSON structure of an existing learning module, and a user request for changes.
Your task is to modify the provided JSON to fulfill the user's request.
Return the entire, complete JSON for the module with your updates applied. Ensure the structure strictly matches the previous schema.
Do not wrap your response in markdown code blocks, just return JSON.
`;

export const editLearningModule = async (moduleId: string, currentData: any, userPrompt: string) => {
  try {
    const moduleRef = doc(db, 'modules', moduleId);
    await updateDoc(moduleRef, {
      status: 'editing',
      updatedAt: serverTimestamp()
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: EDIT_SYSTEM_PROMPT + "\n\nExisting JSON Data:\n" + JSON.stringify(currentData, null, 2) + "\n\nUser Request:\n" + userPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: learningModuleSchema
      }
    });

    let generatedData = null;
    try {
      let jsonText = response.text || "{}";
      console.log("Raw Edit Response received:", jsonText.substring(0, 500) + (jsonText.length > 500 ? "..." : ""));
      
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        jsonText = match[0];
      }
      
      try {
        generatedData = JSON.parse(jsonText);
      } catch (parseError) {
        console.warn("Standard JSON parse failed, attempting jsonrepair...", parseError);
        generatedData = JSON.parse(jsonrepair(jsonText));
      }
    } catch(e) {
      console.warn("Failed to parse JSON response for edit", e);
      throw new Error(`Failed to parse the edited learning module into valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (generatedData) {
      const moduleRef = doc(db, 'modules', moduleId);
      await updateDoc(moduleRef, {
        status: 'ready',
        generatedData: generatedData,
        title: generatedData.title || currentData.title,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Edit failed:", error);
    const moduleRef = doc(db, 'modules', moduleId);
    // If edit fails, revert to ready so they don't lose the document
    await updateDoc(moduleRef, {
      status: 'ready',
      errorMessage: error instanceof Error ? error.message : String(error),
      updatedAt: serverTimestamp()
    });
  }
};
