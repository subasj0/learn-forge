import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc, 
  serverTimestamp, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { chatWithChapterStream, generateChatTitle } from '../lib/agents/courseGenerator';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: any;
}

export interface ChatSession {
  id: string;
  title: string;
  courseId: string;
  chapterId: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  messages?: ChatMessage[];
}

export function useAIChat(courseId: string | undefined, chapterId: string | null, chapterTextContext: string, userId: string | undefined) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingMessageText, setStreamingMessageText] = useState<string>('');

  // Load Sessions
  useEffect(() => {
    if (!courseId || !chapterId || !userId || userId === 'anonymous') {
      setSessions([]);
      setActiveSessionId(null);
      setSessionsLoaded(true);
      return;
    }

    const q = query(
      collection(db, 'chatSessions'),
      where('courseId', '==', courseId),
      where('chapterId', '==', chapterId),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatSession[];
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
      setSessionsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chatSessions');
      setSessionsLoaded(true);
    });

    return () => unsubscribe();
  }, [courseId, chapterId, userId]);

  // Load Messages for Active Session
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      return;
    }

    const sessionMetadata = sessions.find(s => s.id === activeSessionId);
    if (!sessionMetadata) return;

    const q = query(
      collection(db, 'chatSessions', activeSessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[];
      setActiveSession({ ...sessionMetadata, messages });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chatSessions/${activeSessionId}/messages`);
    });

    return () => unsubscribe();
  }, [activeSessionId, sessions]);

  const createNewSession = async (initialMessage?: string) => {
    if (!courseId || !chapterId || !userId || userId === 'anonymous') return null;
    
    const docRef = await addDoc(collection(db, 'chatSessions'), {
      courseId,
      chapterId,
      userId,
      title: initialMessage ? initialMessage.substring(0, 30) + '...' : 'New Chat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    setActiveSessionId(docRef.id);
    return docRef.id;
  };

  const deleteSession = async (sessionId: string) => {
    try {
      // First delete all messages
      const msgs = await getDocs(collection(db, 'chatSessions', sessionId, 'messages'));
      const batch: Promise<void>[] = [];
      msgs.forEach(m => batch.push(deleteDoc(doc(db, 'chatSessions', sessionId, 'messages', m.id))));
      await Promise.all(batch);
      
      // Then delete session
      await deleteDoc(doc(db, 'chatSessions', sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    } catch (e) {
      console.error("Error deleting session", e);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !courseId || !chapterId || !userId || userId === 'anonymous') return;
    
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = await createNewSession(text);
    }
    
    if (!currentSessionId) return;

    setIsLoading(true);
    const sessionRef = doc(db, 'chatSessions', currentSessionId);
    const messagesRef = collection(db, 'chatSessions', currentSessionId, 'messages');
    
    try {
      // Add user message
      await addDoc(messagesRef, {
        role: 'user',
        text,
        timestamp: serverTimestamp()
      });
      
      await updateDoc(sessionRef, { updatedAt: serverTimestamp() });

      // Generate history for AI
      const history = (activeSession?.messages || []).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const modelMsgId = 'streaming-' + Date.now();
      setStreamingMessageId(modelMsgId);
      setStreamingMessageText('');
      
      const resText = await chatWithChapterStream(chapterTextContext, text, history, (chunkText) => {
        setStreamingMessageText(chunkText);
      });
      
      // Add model message
      await addDoc(messagesRef, {
        role: 'model',
        text: resText,
        timestamp: serverTimestamp()
      });
      
      setStreamingMessageId(null);
      setStreamingMessageText('');

      // Auto title if first message
      if (!activeSession?.messages || activeSession.messages.length <= 1) {
        generateChatTitle(text).then(title => {
          updateDoc(sessionRef, { title });
        });
      }

    } catch (e: any) {
      console.error("Chat error", e);
      let errorText = 'Sorry, I encountered an error answering your question.';
      if (e.name === 'BudgetExceededError') {
        errorText = e.message;
        alert(e.message);
      }
      await addDoc(messagesRef, {
        role: 'model',
        text: errorText,
        timestamp: serverTimestamp()
      });
      setStreamingMessageId(null);
      setStreamingMessageText('');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    isLoading,
    sessionsLoaded,
    streamingMessageId,
    streamingMessageText,
    createNewSession,
    deleteSession,
    sendMessage
  };
}
