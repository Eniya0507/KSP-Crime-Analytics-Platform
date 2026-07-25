import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../types';
import { answer, formatChatMessage, detectLang } from '../ai/chat';
import { useI18nStore } from '../i18n';
import { executeFunction, getCatalystConfig } from '../lib/catalyst';
import { useAuthStore } from './auth';

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  /** Messages in the CURRENT active conversation */
  messages: ChatMessage[];
  /** Current conversation id (null = unsaved new chat) */
  activeId: string | null;
  lang: 'en' | 'kn';
  loading: boolean;
  voiceEnabled: boolean;
  /** All saved conversation sessions */
  sessions: ConversationSession[];

  send: (text: string) => void;
  setLang: (l: 'en' | 'kn') => void;
  /** Start a brand-new blank conversation (saves current if non-empty) */
  newChat: () => void;
  /** Clear the current conversation (saves it to history first) */
  clear: () => void;
  /** Load a past session as the active conversation */
  loadSession: (id: string) => void;
  /** Delete a session by id */
  deleteSession: (id: string) => void;
  /** Rename a session */
  renameSession: (id: string, title: string) => void;
  toggleVoice: () => void;

  // Legacy alias kept so old code referencing `history` still compiles
  history: { title: string; messages: ChatMessage[]; ts: string }[];
  _autoSaveActive: () => void;
}

function generateId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  return first ? first.content.slice(0, 48) : 'Conversation';
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      activeId: null,
      lang: 'en',
      loading: false,
      voiceEnabled: false,
      sessions: [],

      // Legacy alias
      get history() {
        return get().sessions.map((s) => ({ title: s.title, messages: s.messages, ts: s.createdAt }));
      },

      send: async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const lang = useI18nStore.getState().lang === 'kn' || detectLang(trimmed) === 'kn' ? 'kn' : 'en';
        const userMsg = formatChatMessage('user', trimmed, lang);
        set((s) => ({ messages: [...s.messages, userMsg], loading: true }));

        try {
          const config = getCatalystConfig();
          if (config.projectId && config.token) {
            const user = useAuthStore.getState().user;
            const res = await executeFunction<any>('ksp-ai-query', {
              query: trimmed,
              lang,
              history: get().messages,
              userId: user?.id || 'anonymous',
              userName: user?.name || 'Anonymous',
            });
            if (res && res.content) {
              const aMsg = formatChatMessage('assistant', res.content, lang, res.sources || [], res.confidence || 0.8);
              set((s) => ({ messages: [...s.messages, aMsg], loading: false }));
              get()._autoSaveActive();
              return;
            }
          }
        } catch (err) {
          console.warn('[KSP] Catalyst AI function failed, using local RAG:', err);
        }

        try {
          const res = await answer(trimmed, lang, get().messages);
          const aMsg = formatChatMessage('assistant', res.content, lang, res.sources, res.confidence);
          set((s) => ({ messages: [...s.messages, aMsg], loading: false }));
          get()._autoSaveActive();
        } catch (err) {
          console.error(err);
          set({ loading: false });
        }
      },

      /** Internal: auto-save/update the active session after each message */
      _autoSaveActive: () => {
        const { messages, activeId, sessions } = get();
        if (messages.length === 0) return;
        const now = new Date().toISOString();
        if (activeId) {
          // Update existing session
          set({
            sessions: sessions.map((s) =>
              s.id === activeId
                ? { ...s, messages, title: makeTitle(messages), updatedAt: now }
                : s,
            ),
          });
        } else {
          // Create new session
          const id = generateId();
          const session: ConversationSession = {
            id,
            title: makeTitle(messages),
            messages,
            createdAt: now,
            updatedAt: now,
          };
          set({ activeId: id, sessions: [session, ...sessions].slice(0, 50) });
        }
      },

      setLang: (l) => set({ lang: l }),

      newChat: () => {
        const { messages, activeId, sessions } = get();
        if (messages.length > 0 && !activeId) {
          // save unsaved current conversation first
          const now = new Date().toISOString();
          const id = generateId();
          const session: ConversationSession = {
            id,
            title: makeTitle(messages),
            messages,
            createdAt: now,
            updatedAt: now,
          };
          set({ sessions: [session, ...sessions].slice(0, 50) });
        }
        set({ messages: [], activeId: null, loading: false });
      },

      clear: () => {
        const { messages, activeId, sessions } = get();
        if (messages.length > 0 && !activeId) {
          // Save to history before clearing
          const now = new Date().toISOString();
          const id = generateId();
          const session: ConversationSession = {
            id,
            title: makeTitle(messages),
            messages,
            createdAt: now,
            updatedAt: now,
          };
          set({ sessions: [session, ...sessions].slice(0, 50), messages: [], activeId: null, loading: false });
        } else {
          set({ messages: [], activeId: null, loading: false });
        }
      },

      loadSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;
        set({ messages: session.messages, activeId: id, loading: false });
      },

      deleteSession: (id) => {
        const { activeId } = get();
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== id),
          ...(activeId === id ? { messages: [], activeId: null } : {}),
        }));
      },

      renameSession: (id, title) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, title } : sess)),
        }));
      },

      toggleVoice: () => set((s) => ({ voiceEnabled: !s.voiceEnabled })),
    }),
    {
      name: 'ksp-chat',
      // Exclude internal helper from persistence
      partialize: (state) => ({
        messages: state.messages,
        activeId: state.activeId,
        lang: state.lang,
        voiceEnabled: state.voiceEnabled,
        sessions: state.sessions,
      }),
    },
  ),
);
