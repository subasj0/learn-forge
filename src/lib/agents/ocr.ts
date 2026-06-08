import * as pdfjsLib from 'pdfjs-dist';
import { auth } from '../firebase';
import { checkBudget, recordUsage } from './usageTracker';


// Use a public CDN for the worker to avoid Vite configuration issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Helper to extract plain text directly from a PDF.
async function extractPdfText(file: File): Promise<{ text: string, numPages: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
    }
    
    return { text: fullText.trim(), numPages };
  } catch (error) {
    console.error("Error reading PDF with pdfjs:", error);
    throw error;
  }
}

// Convert PDF to text using the custom OCR API
async function ocrPdfWithCustomApi(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ocr-pdf', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Cloud Function OCR Error: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`OCR Error: ${data.error}`);
  }
  return data.text || '';
}

export async function extractTextFromFile(file: File): Promise<string> {
  const userId = auth.currentUser?.uid;

  if (userId) {
    await checkBudget(userId);
  }

  const fileType = file.type;

  // Text files natively
  if (fileType.startsWith('text/') || fileType === 'application/json') {
    return await file.text();
  }

  // Use pdfjsLib for PDFs
  if (fileType === 'application/pdf') {
    const { text, numPages } = await extractPdfText(file);
    
    // Direct extraction check vs OCR requirement
    // If average chars per page is less than 50, it's highly likely to be a scanned PDF or contains lots of diagrams
    if (numPages > 0 && text.length > (numPages * 50)) {
       return text;
    } else {
       // Needs OCR. Use the custom cloud function.
       try {
         const ocrResult = await ocrPdfWithCustomApi(file);
         if (userId) {
           await recordUsage(userId, 'ocr-api', 0, numPages || 1);
         }
         return ocrResult;
       } catch (error: any) {
         throw new Error(`Custom OCR failed: ${error.message}`);
       }
    }
  }

  // For images, use the server-side OpenAI OCR route; the custom API handles PDFs.
  if (fileType.startsWith('image/')) {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const token = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/ocr-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ data: base64Data, mimeType: file.type || 'image/jpeg' }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Image OCR failed with ${response.status}`);
    }

    return result.text || "";
  }

  throw new Error(`Unsupported file type: ${fileType}. Please use PDF, Images, or Text files.`);
}
