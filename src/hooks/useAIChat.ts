import { useState, useEffect } from 'react';
import localforage from 'localforage';
import { chatWithChapter } from '../lib/agents/courseGenerator';

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export function useAIChat(courseId: string | undefined, chapterId: string | null, chapterTextContext: string) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      if (!courseId || !chapterId) {
        setSessions([]);
        setActiveSessionId(null);
        setSessionsLoaded(true);
        return;
      }
      const key = `chat_sessions_${courseId}_${chapterId}`;
      const saved = await localforage.getItem<ChatSession[]>(key);
      if (saved && saved.length > 0) {
        setSessions(saved);
        setActiveSessionId(saved[0].id);
      } else {
        setSessions([]);
        setActiveSessionId(null);
      }
      setSessionsLoaded(true);
    }
    setSessionsLoaded(false);
    load();
  }, [courseId, chapterId]);

  const saveSessions = async (courseId: string, chapterId: string, newSessions: ChatSession[]) => {
    setSessions(newSessions);
    const key = `chat_sessions_${courseId}_${chapterId}`;
    await localforage.setItem(key, newSessions);
  };

  const createNewSession = async (initialMessage?: string) => {
    if (!courseId || !chapterId) return null;
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: initialMessage ? initialMessage.substring(0, 30) + '...' : 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // Make sure we have latest state
    const currentSessions = (await localforage.getItem<ChatSession[]>(`chat_sessions_${courseId}_${chapterId}`)) || [];
    const updatedSessions = [newSession, ...currentSessions];
    
    await saveSessions(courseId, chapterId, updatedSessions);
    setActiveSessionId(newSession.id);
    return newSession.id;
  };

  const deleteSession = async (sessionId: string) => {
    if (!courseId || !chapterId) return;
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    await saveSessions(courseId, chapterId, updatedSessions);
    if (activeSessionId === sessionId) {
      setActiveSessionId(updatedSessions[0]?.id || null);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !courseId || !chapterId) return;
    
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = await createNewSession(text);
    }
    
    if (!currentSessionId) return;

    // Use latest state to avoid clobbering
    const currentSessions = (await localforage.getItem<ChatSession[]>(`chat_sessions_${courseId}_${chapterId}`)) || sessions;
    const session = currentSessions.find(s => s.id === currentSessionId);
    if (!session) return;

    setIsLoading(true);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    
    const newTitle = session.messages.length === 0 ? text.substring(0, 30) + '...' : session.title;
    
    let updatedWithUser = currentSessions.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, title: newTitle, messages: [...s.messages, userMsg], updatedAt: Date.now() };
      }
      return s;
    });
    
    await saveSessions(courseId, chapterId, updatedWithUser);
    
    try {
      const history = session.messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));
      
      const resText = await chatWithChapter(chapterTextContext, text, history);
      
      const modelMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: resText,
        timestamp: Date.now(),
      };
      
      // refetch to ensure we don't overwrite if user did something meanwhile
      const freshSessions = (await localforage.getItem<ChatSession[]>(`chat_sessions_${courseId}_${chapterId}`)) || updatedWithUser;
      
      const finalSessions = freshSessions.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, modelMsg], updatedAt: Date.now() };
        }
        return s;
      });
      await saveSessions(courseId, chapterId, finalSessions);
    } catch (e) {
      console.error("Chat error", e);
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: 'Sorry, I encountered an error answering your question.',
        timestamp: Date.now(),
      };
      const freshSessions = (await localforage.getItem<ChatSession[]>(`chat_sessions_${courseId}_${chapterId}`)) || updatedWithUser;
      const finalSessions = freshSessions.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() };
        }
        return s;
      });
      await saveSessions(courseId, chapterId, finalSessions);
    } finally {
      setIsLoading(false);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    isLoading,
    sessionsLoaded,
    createNewSession,
    deleteSession,
    sendMessage
  };
}
