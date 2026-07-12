'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { callAI as callWorkerAI, extractJSON } from '@/lib/ai';
import { useStudent } from '@/context/StudentContext';
import { addVocab } from '@/lib/db/vocabulary';
import { addChunk } from '@/lib/db/chunks';
import type { ChunkEntry } from '@/types';

const TOPICS = ['Daily Life','Travel','Food','Work','Hobbies','News','Culture','Technology'];

function parseChatResponse(raw: string): { reply: string; chunk: ChunkData | null } {
  // 1. Try code-fence extraction first
  try { return extractJSON<{ reply: string; chunk: ChunkData | null }>(raw); } catch {}
  // 2. Find the first { ... } block in the text (AI sometimes adds preamble text)
  const start = raw.indexOf('{');
  if (start !== -1) {
    try {
      const obj = JSON.parse(raw.slice(start)) as { reply?: string; chunk?: ChunkData | null };
      if (obj.reply) return { reply: obj.reply, chunk: obj.chunk ?? null };
    } catch {}
  }
  // 3. Plain-text fallback
  return { reply: raw, chunk: null };
}
type Msg = { role: 'user' | 'assistant'; content: string };
type Lookup = { definition: string; phonetic: string; example: string; example_zh: string; example_breakdown: string; phrases: string[]; informal: string };
type ChunkData = { original: string; chunk: string; zh: string; why: string; rating: 1|2|3|4|5; examples: string[]; category: string };

const SYSTEM = (topic: string) =>
  `You are a friendly English conversation partner for a Mandarin speaker practicing English. Topic: ${topic}.

Rules:
- Keep each reply to 2–3 sentences
- At the end of each reply, add ONE "小提示" in Traditional Chinese only when needed:
  * Grammar error → e.g. "小提示：應說 X 而非 Y"
  * Correct but unnatural → e.g. "小提示：口語更常說 'How's it going?'"
  * If the user's English is already natural, skip the 小提示
- End with a follow-up question

IMPORTANT: You must ALWAYS return valid JSON in this exact format:
{"reply":"your conversational reply here","chunk":null}

OR if you find a chunk worth teaching:
{"reply":"your conversational reply here","chunk":{"original":"user phrase","chunk":"better expression","zh":"中文意思","why":"為什麼更自然（繁中）","rating":5,"examples":["example 1","example 2","example 3"],"category":"Daily Conversation"}}

Chunk rules:
- Only suggest a chunk when it's genuinely valuable (high-frequency, natural, native-speaker expression)
- Return chunk: null if the user's expression is already natural, or if you suggested a chunk in the last 2 exchanges
- Rating: 5=extremely common daily use, 4=very common, 3=useful, 2=occasional, 1=rare
- Prioritize: conversational phrases > collocations > idioms. Avoid formal/academic expressions.`;

export default function ChatPage() {
  const { db } = useStudent();
  const [topic, setTopic] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chunkMap, setChunkMap] = useState<Record<number, ChunkData>>({});
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});
  const [savedChunkIdxs, setSavedChunkIdxs] = useState<Set<number>>(new Set());
  const [challengeChunk, setChallengeChunk] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<Record<number, boolean>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chatWord, setChatWord] = useState<string | null>(null);
  const [chatLookup, setChatLookup] = useState<Lookup | null>(null);
  const [chatLookingUp, setChatLookingUp] = useState(false);
  const [toast, setToast] = useState('');

  const bottom = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendTextRef = useRef<((text: string) => Promise<void>) | undefined>(undefined);
  const voiceModeRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const startListening = useCallback(() => {
    if (!recognitionRef.current || loadingRef.current) return;
    try { recognitionRef.current.start(); setListening(true); } catch {}
  }, []);

  const speak = useCallback((text: string, autoListen = false) => {
    if (typeof window === 'undefined') return;
    const english = text.split('小提示')[0].trim();
    if (!english) { if (autoListen && voiceModeRef.current) startListening(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(english);
    u.lang = 'en-US'; u.rate = 0.9;
    if (autoListen) { u.onend = () => { if (voiceModeRef.current) startListening(); }; }
    window.speechSynthesis.speak(u);
  }, [startListening]);

  const translateMsg = async (idx: number, content: string) => {
    if (translations[idx]) {
      setTranslations(prev => { const n = {...prev}; delete n[idx]; return n; });
      return;
    }
    setTranslating(prev => ({...prev, [idx]: true}));
    try {
      const englishPart = content.split('小提示')[0].trim();
      const result = await callWorkerAI({ messages: [{ role: 'user', content: `Translate to Traditional Chinese (繁體中文). Output the translation only:\n\n${englishPart}` }] });
      setTranslations(prev => ({...prev, [idx]: result}));
    } catch {} finally { setTranslating(prev => ({...prev, [idx]: false})); }
  };

  const fetchSuggestions = async (replyContent: string) => {
    try {
      const english = replyContent.split('小提示')[0].trim();
      const raw = await callWorkerAI({ messages: [{ role: 'user', content: `The AI conversation partner just said: "${english}"\n\nGive 3 short natural English replies a language learner could say. Each under 12 words. Return JSON array only: ["reply1","reply2","reply3"]` }] });
      const arr = extractJSON<string[]>(raw);
      if (Array.isArray(arr)) setSuggestions(arr);
    } catch {}
  };

  const handleWordClick = async (raw: string) => {
    const w = raw.replace(/[^a-zA-Z'-]/g, '').trim().toLowerCase();
    if (!w || w.length < 2) return;
    setChatWord(w); setChatLookup(null); setChatLookingUp(true);
    try {
      const result = await callWorkerAI({ messages: [{ role: 'user', content: `Look up "${w}". Return JSON only: {"definition":"繁中定義 (詞性)","phonetic":"/IPA/","example":"自然英文例句","example_zh":"例句中文翻譯","example_breakdown":"例句語法結構解析（繁中）","phrases":["常見片語: 意思"],"informal":"口語用法（若無則空字串）"}` }] });
      setChatLookup(extractJSON<Lookup>(result));
    } catch {
      setChatLookup({ definition: '查詢失敗', phonetic: '', example: '', example_zh: '', example_breakdown: '', phrases: [], informal: '' });
    } finally { setChatLookingUp(false); }
  };

  const saveChatWord = async () => {
    if (!chatWord || !chatLookup || !db) return;
    await addVocab(db, { word: chatWord, definition: chatLookup.definition, phonetic: chatLookup.phonetic, example: chatLookup.example, srsLevel: 0, nextReview: Date.now(), createdAt: Date.now() });
    showToast(`「${chatWord}」已加入單字庫`);
    setChatWord(null); setChatLookup(null);
  };

  const saveChunk = async (idx: number, chunk: ChunkData) => {
    if (!db) return;
    const entry: Omit<ChunkEntry, 'id'> = { ...chunk, source: 'chat', createdAt: Date.now() };
    await addChunk(db, entry);
    setSavedChunkIdxs(prev => new Set([...prev, idx]));
    showToast(`「${chunk.chunk}」已加入 Chunk 庫`);
  };

  const triggerPractice = (chunk: string) => {
    setChallengeChunk(chunk);
    showToast(`練習模式：試著在下一句用上它！`);
  };

  const renderMsgText = (content: string) => {
    const [english, ...rest] = content.split('小提示');
    const tokens = english.split(/(\s+)/);
    return (
      <>
        {tokens.map((token, i) => {
          const word = token.replace(/[^a-zA-Z'-]/g, '');
          if (!word || word.length < 2) return <span key={i}>{token}</span>;
          return (
            <span key={i} onClick={e => { e.stopPropagation(); handleWordClick(word); }}
              style={{ cursor: 'pointer', borderBottom: '1px dotted rgba(0,0,0,0.25)', borderRadius: 2 }}>
              {token}
            </span>
          );
        })}
        {rest.length > 0 && (
          <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6, fontSize: 15 }}>
            小提示{rest.join('小提示')}
          </span>
        )}
      </>
    );
  };

  const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  const renderChunkCard = (idx: number, chunk: ChunkData) => {
    const expanded = expandedChunks[idx];
    const saved = savedChunkIdxs.has(idx);
    return (
      <div style={{ marginTop: 6, maxWidth: '80%', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        {/* 收折摘要列 */}
        <button
          onClick={() => setExpandedChunks(p => ({ ...p, [idx]: !p[idx] }))}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontSize: 15 }}>💡</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)', flex: 1 }}>{chunk.chunk}</span>
          <span style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1 }}>{STARS(chunk.rating)}</span>
          <span style={{ fontSize: 12, color: 'var(--text-subtle)', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
        </button>

        {/* 展開內容 */}
        {expanded && (
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
            <p style={{ margin: '10px 0 4px', fontSize: 13, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-subtle)' }}>原本：</span> {chunk.original}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              → {chunk.chunk} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 14 }}>（{chunk.zh}）</span>
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{chunk.why}</p>
            {chunk.examples.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {chunk.examples.map((ex, i) => (
                  <p key={i} style={{ margin: '0 0 3px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>• {ex}</p>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => !saved && saveChunk(idx, chunk)}
                disabled={saved}
                style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', cursor: saved ? 'default' : 'pointer', background: saved ? 'var(--bg-tertiary)' : 'var(--accent)', color: saved ? 'var(--text-muted)' : '#fff' }}
              >
                {saved ? '已收藏' : '加入 Chunk 庫'}
              </button>
              <button
                onClick={() => triggerPractice(chunk.chunk)}
                style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                再練一次
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || loadingRef.current) return;
    const userContent = challengeChunk
      ? `${text.trim()}\n[Practice note: Check if user used "${challengeChunk}" naturally. If yes, praise it briefly.]`
      : text.trim();
    const displayMsg: Msg = { role: 'user', content: text.trim() };
    const next: Msg[] = [...msgs, { role: 'user', content: userContent }];
    setMsgs(prev => [...prev, displayMsg]);
    setInput(''); setSuggestions([]); setChallengeChunk(null);
    loadingRef.current = true; setLoading(true);
    try {
      const raw = await callWorkerAI({ model: 'claude-sonnet-4-6', system: SYSTEM(topic || 'General'), messages: next });
      const { reply, chunk } = parseChatResponse(raw);
      let replyText = reply;
      let chunkData = chunk;

      const assistantIdx = next.length; // index in msgs after appending
      setMsgs(prev => [...prev, { role: 'assistant', content: replyText }]);
      if (chunkData) setChunkMap(p => ({ ...p, [assistantIdx]: chunkData! }));
      loadingRef.current = false; setLoading(false);
      speak(replyText, true);
      fetchSuggestions(replyText);
    } catch { loadingRef.current = false; setLoading(false); }
  }, [msgs, topic, speak, challengeChunk]);

  useEffect(() => { sendTextRef.current = sendText; }, [sendText]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'zh-TW'; r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => { setListening(false); sendTextRef.current?.(e.results[0][0].transcript); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    listening ? recognitionRef.current.stop() : startListening();
  };

  const toggleVoiceMode = () => {
    const next = !voiceMode;
    setVoiceMode(next); voiceModeRef.current = next;
    if (!next) { window.speechSynthesis.cancel(); try { recognitionRef.current?.stop(); } catch {} }
  };

  const start = async (t: string) => {
    setTopic(t); loadingRef.current = true; setLoading(true);
    try {
      const init: Msg = { role: 'user', content: "Hello! Let's start." };
      const raw = await callWorkerAI({ model: 'claude-sonnet-4-6', system: SYSTEM(t), messages: [init] });
      const { reply: initReply } = parseChatResponse(raw);
      setMsgs([init, { role: 'assistant' as const, content: initReply }]);
      loadingRef.current = false; setLoading(false);
      speak(initReply, true); fetchSuggestions(initReply);
    } catch { setTopic(''); loadingRef.current = false; setLoading(false); }
  };

  const smallBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' };

  if (!topic) return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>對話練習</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 17 }}>選擇主題開始英語對話</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {TOPICS.map(t => (
          <button key={t} onClick={() => start(t)} disabled={loading}
            style={{ padding: 18, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 500, textAlign: 'left', opacity: loading ? 0.6 : 1 }}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  // Build display messages (user messages only show trimmed content)
  const displayMsgs = msgs.filter(m => !m.content.includes('[Practice note:'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 17 }}>{topic}</p>
          <p style={{ margin: 0, fontSize: 12, color: voiceMode ? '#48bb78' : 'var(--text-muted)' }}>
            {voiceMode ? '語音對話模式 — 說完 AI 自動聆聽' : '點 AI 訊息中的單字可查詢'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={toggleVoiceMode}
            style={{ padding: '6px 12px', background: voiceMode ? '#d1fae5' : 'var(--bg-primary)', border: `1px solid ${voiceMode ? '#6ee7b7' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: voiceMode ? '#065f46' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
            {voiceMode ? '語音模式 ON' : '語音模式'}
          </button>
          <button onClick={() => { setTopic(''); setMsgs([]); setVoiceMode(false); setSuggestions([]); setTranslations({}); setChatWord(null); setChunkMap({}); setExpandedChunks({}); setSavedChunkIdxs(new Set()); setChallengeChunk(null); voiceModeRef.current = false; window.speechSynthesis.cancel(); try { recognitionRef.current?.stop(); } catch {} }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
            換主題
          </button>
        </div>
      </div>

      {voiceMode && (
        <div style={{ padding: '7px 20px', background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', fontSize: 13, color: '#065f46', textAlign: 'center' }}>
          支援中英文混說 — AI 說完後自動開始聆聽你的回答
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 150, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayMsgs.map((m, i) => {
          const chunkData = m.role === 'assistant' ? chunkMap[i] : undefined;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', padding: '14px 18px', borderRadius: 'var(--radius)', fontSize: 17, lineHeight: 1.7, background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)', border: m.role === 'assistant' ? '1px solid var(--border)' : 'none', whiteSpace: 'pre-wrap' }}>
                {m.role === 'assistant' ? renderMsgText(m.content) : m.content}
              </div>
              {m.role === 'assistant' && (
                <>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button onClick={() => speak(m.content)} style={smallBtn}>🔊 重播</button>
                    <button onClick={() => translateMsg(i, m.content)} style={{ ...smallBtn, color: translating[i] || translations[i] ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {translating[i] ? '翻譯中...' : translations[i] ? '隱藏翻譯' : '🇹🇼 看中文'}
                    </button>
                  </div>
                  {translations[i] && (
                    <div style={{ maxWidth: '80%', marginTop: 4, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #a7f3d0', color: '#065f46', fontSize: 15, lineHeight: 1.65 }}>
                      {translations[i]}
                    </div>
                  )}
                  {chunkData && renderChunkCard(i, chunkData)}
                </>
              )}
            </div>
          );
        })}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 17 }}>...</div>
          </div>
        )}
        {listening && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '12px 18px', background: '#fff5f5', borderRadius: 'var(--radius)', border: '1px solid #feb2b2', color: '#c53030', fontSize: 15, fontStyle: 'italic' }}>
              聆聽中，請說話...
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Word lookup popup */}
      {chatWord && (
        <div style={{ position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 100, padding: '0 12px' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', padding: 16, maxHeight: '55vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 20 }}>{chatWord}</strong>
                {chatLookup?.phonetic && <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 15 }}>{chatLookup.phonetic}</span>}
                <button onClick={() => speak(chatWord)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>🔊</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={saveChatWord} disabled={!chatLookup || chatLookup.definition === '查詢失敗'}
                  style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
                  加入單字庫
                </button>
                <button onClick={() => { setChatWord(null); setChatLookup(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
              </div>
            </div>
            {chatLookingUp && <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>查詢中...</p>}
            {chatLookup && (
              <>
                <p style={{ margin: '0 0 10px', fontSize: 16, color: 'var(--text-primary)' }}>{chatLookup.definition}</p>
                {chatLookup.example && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid var(--accent)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 15, fontStyle: 'italic' }}>{chatLookup.example}</p>
                    {chatLookup.example_zh && <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text-muted)' }}>{chatLookup.example_zh}</p>}
                    {chatLookup.example_breakdown && (
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        解析：{chatLookup.example_breakdown}
                      </p>
                    )}
                  </div>
                )}
                {chatLookup.phrases?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>常見片語</p>
                    {chatLookup.phrases.map((ph, i) => <p key={i} style={{ margin: '0 0 2px', fontSize: 14, color: 'var(--text-muted)' }}>• {ph}</p>)}
                  </div>
                )}
                {chatLookup.informal && (
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>口語用法</p>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{chatLookup.informal}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 300, pointerEvents: 'none' }}>
          {toast}
        </div>
      )}

      {/* Bottom: challenge chip + suggestions + input */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        {challengeChunk && (
          <div style={{ padding: '6px 16px 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>練習：</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', background: '#d1fae5', padding: '3px 10px', borderRadius: 20 }}>
              {challengeChunk}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>試著在下一句用上它</span>
            <button onClick={() => setChallengeChunk(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}
        {suggestions.length > 0 && !loading && (
          <div style={{ padding: '8px 16px 4px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)', alignSelf: 'center', marginRight: 2 }}>建議回覆：</span>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setSuggestions([]); sendText(s); }}
                style={{ padding: '6px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', color: 'var(--text-primary)', fontWeight: 500 }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendText(input)}
            placeholder={listening ? '聆聽中...' : '打字或按語音...'}
            disabled={loading || listening}
            style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-primary)', border: `1px solid ${listening ? '#e53e3e' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 17 }} />
          <button onClick={toggleListen} disabled={loading}
            style={{ padding: '10px 14px', minWidth: 52, background: listening ? '#e53e3e' : 'var(--bg-primary)', border: `1px solid ${listening ? '#e53e3e' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: listening ? '#fff' : 'var(--text-muted)', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            {listening ? '停止' : '語音'}
          </button>
          <button onClick={() => sendText(input)} disabled={loading || !input.trim() || listening}
            style={{ padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 17 }}>
            送出
          </button>
        </div>
      </div>
    </div>
  );
}
