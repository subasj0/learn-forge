import { GoogleGenAI } from '@google/genai';
import { db, auth } from '../firebase';
import { doc, updateDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { checkBudget, recordUsage } from './usageTracker';
import { uploadContent } from '../storage';
import courseGuidelines from './prompts/interactive_course_guidelines.md?raw';

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });


// Load skills dynamically using Vite's glob import
// This will include all .md files in the skills directory
const skillFiles = import.meta.glob('./skills/*.md', { query: '?raw', eager: true });

function getSkillsContext() {
  let context = "Available Skills and Guidelines:\n\n";
  for (const path in skillFiles) {
    const fileName = path.split('/').pop();
    const content = (skillFiles[path] as any).default || skillFiles[path];
    context += `--- Skill: ${fileName} ---\n${content}\n\n`;
  }
  return context;
}

export async function generateInteractiveChapter(
  courseId: string, 
  chapterInfo: { id: string; title: string; partTitle: string; guidance?: string }, 
  courseContextInfo: string, 
  orderIndex: number, 
  userId: string, 
  files?: {name: string, text: string}[], 
  personalization?: any, 
  onProgress?: (partial: any) => void
) {
  try {
    if (userId) {
      await checkBudget(userId);
    }

    const skillsContext = getSkillsContext();

    let styleGuide = '';
    
    // Auto-detect theme based on course context or personalization
    const courseLower = (courseContextInfo + " " + chapterInfo.title).toLowerCase();
    let recommendedTheme = "Deep Academic"; // Default
    
    if (courseLower.includes("tech") || courseLower.includes("coding") || courseLower.includes("quantum") || courseLower.includes("space")) {
      recommendedTheme = "Tech/Sci-Fi";
    } else if (courseLower.includes("bio") || courseLower.includes("botany") || courseLower.includes("nature") || courseLower.includes("garden")) {
      recommendedTheme = "Nature/Organic";
    }

    if (personalization) {
      styleGuide += `\n### Personalization Constraints:\n`;
      styleGuide += `- **Theme Recommendation**: Use the **${recommendedTheme}** style defined in guidelines.`;
      styleGuide += `\n- **Target Audience**: ${personalization.depth === 'introductory' ? 'Beginner' : personalization.depth === 'advanced' ? 'Advanced' : personalization.complexity || 'Intermediate'} (Adjust tone and depth accordingly)`;
      styleGuide += `\n- **Tone**: ${personalization.tone || 'Balanced'}`;
      styleGuide += `\n- **Preferred Interactivity**: ${personalization.interactivity === 'high' ? 'Extremely Interactive (multiple widgets per section)' : 'Balanced (1 robust widget per section)'}`;
      if (personalization.intent) styleGuide += `\n- **Specific Learning Goal**: ${personalization.intent}`;
      if (personalization.focus) styleGuide += `\n- **Specific Focus**: ${personalization.focus}`;
      if (personalization.customGuidance) styleGuide += `\n- **Chapter-Specific Custom Instructions**: ${personalization.customGuidance}`;
      if (personalization.interests) {
        styleGuide += `\n- **Personalized Context**: Integrate examples related to **${personalization.interests}** throughout the chapter.`;
      }
      
      if (personalization.learningStyle === 'visual') {
        styleGuide += `\n- **Learning style: Visual**: Prioritize Recharts and SVG diagrams over heavy text.`;
      } else if (personalization.learningStyle === 'hands-on' || personalization.learningStyle === 'kinesthetic') {
        styleGuide += `\n- **Learning style: Hands-on**: Prioritize complex interactive simulations and "The Explorer" / "The Step-by-Step Lab" archetypes.`;
      }
    } else {
      styleGuide += `\n- **Theme Recommendation**: Use the **${recommendedTheme}** style.`;
    }

    const textPrompt = `You are a world-class React developer and educational designer.
Your mission is to generate a single-file React component (TypeScript) that represents an interactive, premium educational chapter.

### Core Directive:
Create a "Modern Academic" experience. The chapter must feel like a high-end digital publication, combining sharp, accurate narrative with sophisticated interactive modules.

### Structural Requirements:
1. **Sectioned Layout**: Break content into logical sections (Context -> Demonstration -> Synthesis -> Check).
2. **Typography**: Use 'font-serif' for narrative text and 'font-sans' for UI/Headers. Never use placeholders. Avoid standard boring colors; use specialized hex codes if needed to match the theme.
3. **Interactive Logic**: 
   - Mandatory: Use 'quizzes-and-logic' patterns for exercises.
   - Every widget must have internal state and provide immediate, satisfying feedback via animations.
   - Use 'motion-animations' (staggered entries, tactile gestures) and 'recharts-data-viz' for exploration.
4. **Resilience**: Ensure high contrast for accessibility. Never use low-contrast text.

### Technical Constraints:
- Default export ONLY.
- Tailwind CSS ONLY for styling.
- Lucide-react for icons.
- motion/react for animations.
- recharts for charts.
- The 'cn' function is GLOBAL. Do not define or import it.
- NO external imports other than: 'react', 'lucide-react', 'motion/react', 'recharts'.

### Current Topic Context:
- Course: ${courseContextInfo}
- Part: ${chapterInfo.partTitle}
- Chapter: ${chapterInfo.title}
${chapterInfo.guidance ? `- Objectives:\n${chapterInfo.guidance}\n` : ''}

${styleGuide}

### Applied Skill Guidelines:
${courseGuidelines}
${skillsContext}

Output ONLY the raw component code in a typescript block. Ensure the component is robust and does not crash.`;

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
        maxOutputTokens: 15000,
        temperature: 0.7
      }
    });

    let fullCode = "";
    let usageMetadata = null;
    
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullCode += chunk.text;
      }
      if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
      
      if (onProgress) {
        onProgress({ 
          componentCode: fullCode, 
          isStreaming: true,
          moduleType: 'interactive',
          chapterId: chapterInfo.id,
          id: chapterInfo.id
        });
      }
    }

    if (userId && usageMetadata) {
      await recordUsage(userId, 'gemini-3-flash-preview', usageMetadata.promptTokenCount, usageMetadata.candidatesTokenCount);
    }

    // Extract code from block
    const codeMatch = fullCode.match(/```(?:typescript|tsx|javascript|jsx)?\n([\s\S]*?)```/) || fullCode.match(/```([\s\S]*?)```/);
    const cleanedCode = codeMatch ? codeMatch[1].trim() : fullCode.trim();

    // Save chapter as a new version
    const versionId = `${chapterInfo.id}_${Date.now()}`;
    const storagePath = `courses/${courseId}/chapters/${versionId}.json`;
    const chapterJson = JSON.stringify({ componentCode: cleanedCode, moduleType: 'interactive' });
    const contentUrl = await uploadContent(storagePath, chapterJson, 'application/json');

    const chapterRef = doc(collection(db, 'courses', courseId, 'chapters'), versionId);
    await setDoc(chapterRef, {
      id: versionId,
      courseId,
      userId,
      chapterId: chapterInfo.id,
      contentUrl,
      moduleType: 'interactive',
      order: orderIndex,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'done'
    });

    if (onProgress) {
      onProgress({ 
        componentCode: cleanedCode, 
        isStreaming: false,
        moduleType: 'interactive',
        chapterId: chapterInfo.id,
        id: chapterInfo.id
      });
    }

    return cleanedCode;
  } catch (error) {
    console.error("Interactive chapter generation failed:", error);
    throw error;
  }
}
