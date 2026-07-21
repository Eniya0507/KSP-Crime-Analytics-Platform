import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Download, Sparkles, User, Bot,
  Languages, Lightbulb, FileText, Plus, Trash2, Clock, Search,
  MessageSquare, Pencil, Check, X, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useChatStore } from '../store/chat';
import { getSuggestions, detectLang } from '../ai/chat';
import { exportConversationPdf } from '../ai/reports';
import { addAudit, useAuthStore } from '../store/auth';
import { useI18n } from '../i18n';
import { Card } from '../components/ui';

type SpeechRecognitionType = any;
declare global {
  interface Window { SpeechRecognition?: SpeechRecognitionType; webkitSpeechRecognition?: SpeechRecognitionType; }
}

export default function ChatbotPage() {
  const {
    messages, loading, send, clear, newChat, loadSession, deleteSession, renameSession,
    sessions, voiceEnabled, toggleVoice, activeId,
  } = useChatStore();
  const { lang, toggle, t } = useI18n();
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const { user } = useAuthStore();
  const endRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showHistory, setShowHistory] = useState(true);

  const suggestions = getSuggestions(lang);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const q = params.get('q');
    if (q && messages.length === 0) { send(q); setInput(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (messages.length === 0)
      addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: 'Opened AI Assistant', category: 'AI Query', detail: 'Session start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSend = (text?: string) => {
    const val = (text ?? input).trim();
    if (!val || loading) return;
    send(val);
    addAudit({ userId: user?.id ?? '', userName: user?.name ?? '', action: `AI query: ${val.slice(0, 60)}`, category: 'AI Query', detail: `Lang: ${detectLang(val)}` });
    setInput('');
  };

  const handleNewChat = () => { newChat(); setInput(''); };
  const handleClear = () => { clear(); setInput(''); };

  // Voice input
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Try Chrome or Edge.'); return; }
    const recog = new SR();
    recog.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recog.start();
    recogRef.current = recog;
    setListening(true);
  };
  const stopListening = () => { recogRef.current?.stop(); setListening(false); };

  // Voice output
  const speak = (text: string, messageLang: 'en' | 'kn') => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const clean = text.replace(/[*#`_>|-]/g, ' ').replace(/\s+/g, ' ').slice(0, 600);
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = messageLang === 'kn' ? 'kn-IN' : 'en-IN';
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(messageLang === 'kn' ? 'kn' : 'en'));
    if (match) u.voice = match;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const startRename = (id: string, currentTitle: string) => {
    setRenamingId(id); setRenameValue(currentTitle);
  };
  const commitRename = (id: string) => {
    if (renameValue.trim()) renameSession(id, renameValue.trim());
    setRenamingId(null);
  };

  const filteredSessions = sessions.filter((s) =>
    !historySearch || s.title.toLowerCase().includes(historySearch.toLowerCase()),
  );

  const formatSessionDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return t('chat_today');
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t('chat_yesterday');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="flex flex-1 flex-col h-[calc(100vh-5.5rem)] min-h-0">
      {/* Top Header Bar */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="btn-outline p-2 text-steel-300 hover:text-white"
            title={showHistory ? 'Hide Conversations' : 'Show Conversations'}
          >
            {showHistory ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-steel-600 to-steel-800 shadow-glow">
            <Sparkles size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">{t('page_chatbot_title')}</h1>
            <p className="text-[11px] text-steel-300/70">{t('page_chatbot_sub')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleNewChat} className="btn-primary py-1.5 px-3 text-xs shadow-glow">
            <Plus size={14} /> {t('chat_newChat')}
          </button>
          <button onClick={toggle} className="btn-outline py-1.5 px-3 text-xs">
            <Languages size={14} /> {lang === 'en' ? 'EN' : 'ಕನ್ನಡ'}
          </button>
          <button
            onClick={toggleVoice}
            className={`btn-outline py-1.5 px-3 text-xs ${voiceEnabled ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : ''}`}
            title={t('chat_voiceOutput')}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          {messages.length > 0 && (
            <>
              <button onClick={() => exportConversationPdf(messages)} className="btn-outline py-1.5 px-2.5 text-xs" title={t('chat_exportPdf')}>
                <Download size={14} />
              </button>
              <button onClick={handleClear} className="btn-ghost py-1.5 px-2 text-xs text-steel-400 hover:text-rose-400" title={t('chat_clearChat')}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Copilot/ChatGPT Layout: Full Height Grid */}
      <div className="flex flex-1 min-h-0 gap-3 overflow-hidden">
        {/* Sidebar History Panel */}
        {showHistory && (
          <Card className="w-72 shrink-0 flex flex-col h-full overflow-hidden border-white/10" bodyClass="flex flex-1 flex-col p-0 overflow-hidden">
            <div className="border-b border-white/5 p-2.5 bg-ink-950/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-steel-300/80 flex items-center gap-1.5">
                  <Clock size={12} className="text-cyan-400" />
                  {t('chat_history')}
                </span>
                <span className="rounded-full bg-steel-500/20 px-2 py-0.5 text-[10px] text-steel-300 font-mono">
                  {sessions.length}
                </span>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-300/50" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={t('chat_searchHistory')}
                  className="w-full rounded-md border border-white/10 bg-ink-900/80 py-1.5 pl-7 pr-2 text-xs text-steel-100 outline-none placeholder:text-steel-300/40 focus:border-steel-500/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {filteredSessions.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-steel-300/50">{t('chat_noHistory')}</p>
              ) : (
                filteredSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`group relative px-3 py-2.5 transition hover:bg-white/[0.04] ${activeId === sess.id ? 'bg-steel-600/20 border-l-2 border-cyan-400' : ''}`}
                  >
                    {renamingId === sess.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(sess.id); if (e.key === 'Escape') setRenamingId(null); }}
                          className="min-w-0 flex-1 rounded border border-steel-500/40 bg-ink-900/90 px-1.5 py-0.5 text-xs text-white outline-none"
                        />
                        <button onClick={() => commitRename(sess.id)} className="text-emerald-400 p-0.5"><Check size={12} /></button>
                        <button onClick={() => setRenamingId(null)} className="text-steel-400 p-0.5"><X size={12} /></button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1">
                        <button
                          onClick={() => loadSession(sess.id)}
                          className="block flex-1 text-left min-w-0"
                        >
                          <p className="truncate text-xs font-medium text-steel-100 group-hover:text-white">{sess.title}</p>
                          <p className="mt-0.5 text-[10px] text-steel-300/50">
                            {formatSessionDate(sess.updatedAt)} · {sess.messages.length} msgs
                          </p>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button
                            onClick={() => startRename(sess.id, sess.title)}
                            className="rounded p-1 text-steel-400 hover:text-white hover:bg-white/10"
                            title={t('chat_rename')}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => { if (confirm(t('chat_confirmDelete'))) deleteSession(sess.id); }}
                            className="rounded p-1 text-steel-400 hover:text-rose-400 hover:bg-rose-500/10"
                            title={t('chat_deleteConv')}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Main Conversation Stream Viewport */}
        <Card className="flex-1 flex flex-col h-full min-w-0 border-white/10 overflow-hidden" bodyClass="flex flex-1 flex-col p-0 overflow-hidden">
          {activeId && (
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-steel-300/70 bg-ink-950/30 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <MessageSquare size={13} className="text-cyan-400 shrink-0" />
                <span className="truncate font-medium text-white">{sessions.find((s) => s.id === activeId)?.title ?? 'Conversation'}</span>
              </div>
              <span className="text-[10px] text-steel-400">{messages.length} messages</span>
            </div>
          )}

          {/* Scrollable Chat Message Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center my-auto py-8">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-steel-600/30 to-cyan-600/20 shadow-glow">
                  <Bot size={32} className="text-cyan-300" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-white">{t('chat_emptyTitle')}</h2>
                <p className="mt-1 max-w-lg text-xs sm:text-sm text-steel-300/70 leading-relaxed">{t('chat_emptySub')}</p>
                <div className="mt-6 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => onSend(s)}
                      className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left text-xs text-steel-100 transition hover:border-steel-500/40 hover:bg-white/5 shadow-sm"
                    >
                      <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-400" />
                      <span className="leading-snug">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-bold ${m.role === 'user' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-gradient-to-br from-steel-600 to-steel-800 text-white shadow-glow'}`}>
                  {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>
                <div className={`max-w-[85%] sm:max-w-[78%] ${m.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${m.role === 'user' ? 'bg-amber-500/15 text-amber-50 border border-amber-500/20' : 'bg-ink-800/90 text-steel-50 border border-white/5 shadow-md'}`}>
                    <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: mdLite(m.content) }} />
                  </div>
                  <div className={`mt-1 flex items-center gap-2 text-[10px] text-steel-300/60 ${m.role === 'user' ? 'justify-end' : ''}`}>
                    <span>{new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.confidence != null && <span>· {t('confidence')} {Math.round(m.confidence * 100)}%</span>}
                    {m.role === 'assistant' && voiceEnabled && (
                      <button onClick={() => speak(m.content, m.lang)} className="text-steel-300/70 hover:text-white"><Volume2 size={12} /></button>
                    )}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.sources.map((s, i) =>
                        s.caseId ? (
                          <Link key={i} to={`/case/${s.caseId}`} className="inline-flex items-center gap-1 rounded-md border border-steel-500/30 bg-steel-600/15 px-2 py-0.5 text-[10px] text-steel-200 hover:bg-steel-600/30">
                            <FileText size={10} /> {s.title}
                          </Link>
                        ) : (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-steel-300/80">{s.title}</span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-steel-600 to-steel-800 text-white">
                  <Bot size={15} />
                </div>
                <div className="rounded-2xl bg-ink-800/90 border border-white/5 px-4 py-3 shadow-md">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulseDot rounded-full bg-cyan-400" />
                    <span className="h-2 w-2 animate-pulseDot rounded-full bg-cyan-400" style={{ animationDelay: '0.2s' }} />
                    <span className="h-2 w-2 animate-pulseDot rounded-full bg-cyan-400" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Sticky Input Bar at Bottom */}
          <div className="border-t border-white/10 p-3 bg-ink-950/60 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="flex items-center gap-2">
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                className={`rounded-xl p-2.5 transition ${listening ? 'bg-rose-500/20 text-rose-300 animate-pulseDot' : 'bg-white/5 text-steel-300 hover:bg-white/10'}`}
                title="Voice input"
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chat_placeholder')}
                className="input flex-1 bg-ink-900/90 py-2.5 text-xs sm:text-sm"
                disabled={loading}
              />
              <button type="submit" className="btn-primary py-2.5 px-4" disabled={loading || !input.trim()}>
                <Send size={16} />
              </button>
            </form>
            {listening && (
              <p className="mt-1.5 text-xs text-rose-300">
                {t('chat_listening')} {lang === 'kn' ? '(ಕನ್ನಡ)' : '(English)'}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function mdLite(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<span class="block">• $1</span>')
    .replace(/\n/g, '<br/>');
}
