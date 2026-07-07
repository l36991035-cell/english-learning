'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { callAI as callWorkerAI } from '@/lib/ai';

const TOPICS = ['Daily Life','Travel','Food','Work','Hobbies','News','Culture','Technology'];
type Msg = { role: 'user' | 'assistant'; content: string };

const SYSTEM = (topic: string) =>
  `You are a friendly English conversation partner for a Mandarin speaker practicing English. Topic: ${topic}.
- Keep each reply to 2–3 sentences
- At the end of each reply, add ONE "小提示" in Traditional Chinese only when needed:
  * Grammar error → e.g. "小提示：應說 X 而非 Y"
  * Correct but unnatural or too formal → e.g. "小提示：'How are you?' 沒錯，但口語更常說 'How's it going?' 或 'What's up?'"
  * If the user's English is already natural, skip the 小提示
- End with a follow-up question`;

const speak = (text: string) => {
  if (typeof window === 'undefined') return;
  const english = text.split('小提示')[0].trim();
  if (!english) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(english);
  u.lang = 'en-US';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
};

export default function ChatPage() {
  const [topic, setTopic] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendTextRef = useRef<(text: string) => Promise<void>>();

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text.trim() }];
    setMsgs(next);
    setInput('');
    setLoading(true);
    try {
      const reply = await callWorkerAI({ model: 'claude-sonnet-4-6', system: SYSTEM(topic || 'General'), messages: next });
      setMsgs([...next, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch {} finally { setLoading(false); }
  }, [msgs, loading, topic]);

  useEffect(() => { sendTextRef.current = sendText; }, [sendText]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      sendTextRef.current?.(transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const send = () => sendText(input);

  const start = async (t: string) => {
    setTopic(t);
    setLoading(true);
    try {
      const init: Msg = { role: 'user', content: "Hello! Let's start." };
      const reply = await callWorkerAI({ model: 'claude-sonnet-4-6', system: SYSTEM(t), messages: [init] });
      setMsgs([init, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch { setTopic(''); } finally { setLoading(false); }
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      <div style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 17 }}>{topic}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Claude Sonnet</p>
        </div>
        <button onClick={() => { setTopic(''); setMsgs([]); window.speechSynthesis.cancel(); }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
          換主題
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '80%', padding: '14px 18px', borderRadius: 'var(--radius)', fontSize: 17, lineHeight: 1.7, background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)', border: m.role === 'assistant' ? '1px solid var(--border)' : 'none', whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '14px 18px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 17 }}>...</div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={listening ? '聆聽中...' : 'Type or use mic...'}
          disabled={loading || listening}
          style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-primary)', border: `1px solid ${listening ? '#e53e3e' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 17 }} />
        <button onClick={toggleListen} disabled={loading}
          style={{ padding: '10px 14px', minWidth: 52, background: listening ? '#e53e3e' : 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: listening ? '#fff' : 'var(--text-muted)', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
          {listening ? '停止' : '語音'}
        </button>
        <button onClick={send} disabled={loading || !input.trim() || listening}
          style={{ padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 17 }}>
          送出
        </button>
      </div>
    </div>
  );
}
