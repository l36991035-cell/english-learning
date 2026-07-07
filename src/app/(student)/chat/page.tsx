'use client';
import { useState, useRef, useEffect } from 'react';
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

export default function ChatPage() {
  const [topic, setTopic] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const callAI = async (history: Msg[]) => {
    return callWorkerAI({ model: 'claude-sonnet-4-6', system: SYSTEM(topic || 'General'), messages: history });
  };

  const start = async (t: string) => {
    setTopic(t); setLoading(true);
    try {
      const init: Msg = { role: 'user', content: "Hello! Let's start." };
      const reply = await callAI([init]);
      setMsgs([init, { role: 'assistant', content: reply }]);
    } catch { setTopic(''); } finally { setLoading(false); }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const next: Msg[] = [...msgs, { role: 'user', content: input.trim() }];
    setMsgs(next); setInput(''); setLoading(true);
    try {
      const reply = await callAI(next);
      setMsgs([...next, { role: 'assistant', content: reply }]);
    } catch {} finally { setLoading(false); }
  };

  if (!topic) return (
    <div style={{ padding:24, maxWidth:640, margin:'0 auto' }}>
      <h1 style={{ fontSize:24, marginBottom:8 }}>對話練習</h1>
      <p style={{ color:'var(--text-muted)', marginBottom:24 }}>選擇主題開始英語對話</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {TOPICS.map(t => (
          <button key={t} onClick={() => start(t)} style={{ padding:16, background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text-primary)', cursor:'pointer', fontFamily:'inherit', fontSize:15, fontWeight:500, textAlign:'left' }}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 52px)' }}>
      <div style={{ padding:'14px 20px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ margin:0, fontWeight:600 }}>{topic}</p>
          <p style={{ margin:0, fontSize:11, color:'var(--text-muted)' }}>Claude Sonnet</p>
        </div>
        <button onClick={() => { setTopic(''); setMsgs([]); }} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:13 }}>換主題</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth:'80%', padding:'12px 16px', borderRadius:'var(--radius)', fontSize:15, lineHeight:1.6, background: m.role==='user' ? 'var(--accent)' : 'var(--bg-secondary)', color: m.role==='user' ? '#fff' : 'var(--text-primary)', border: m.role==='assistant' ? '1px solid var(--border)' : 'none' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ padding:'12px 16px', background:'var(--bg-secondary)', borderRadius:'var(--radius)', border:'1px solid var(--border)', color:'var(--text-muted)' }}>...</div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div style={{ padding:'10px 16px', background:'var(--bg-secondary)', borderTop:'1px solid var(--border)', display:'flex', gap:8, position:'fixed', bottom:0, left:0, right:0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}
          placeholder="Type in English..." disabled={loading}
          style={{ flex:1, padding:'10px 14px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text-primary)', fontFamily:'inherit', fontSize:15 }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ padding:'10px 18px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          送出
        </button>
      </div>
    </div>
  );
}
