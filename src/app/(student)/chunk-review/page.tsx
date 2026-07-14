'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { callAI, extractJSON } from '@/lib/ai';
import { useStudent } from '@/context/StudentContext';
import { getDueChunks, updateChunkSrs } from '@/lib/db/chunks';
import type { ChunkEntry, SrsLevel } from '@/types';

type Mode = 'zh_to_en' | 'en_to_zh' | 'sentence';
type ReviewItem = { chunk: ChunkEntry; mode: Mode };
type JudgeResult = { correct: boolean; feedback: string };

const MODE_LABELS: Record<Mode, string> = {
  zh_to_en: '中文 → 英文',
  en_to_zh: '英文 → 中文',
  sentence: '照樣造句',
};
const MODES: Mode[] = ['zh_to_en', 'en_to_zh', 'sentence'];

function buildPrompt(item: ReviewItem, answer: string): string {
  const { chunk, mode } = item;
  if (mode === 'zh_to_en') {
    return `The learner saw the Chinese phrase "${chunk.original}" and must recall the English expression.
Their answer: "${answer}"
Target: "${chunk.chunk}" (meaning: ${chunk.zh})
Judge if the answer conveys the same meaning and is natural English. Minor wording differences are OK.
Return JSON only: {"correct":true,"feedback":"繁中回饋 1-2 句"}`;
  }
  if (mode === 'en_to_zh') {
    return `The learner saw the English expression "${chunk.chunk}" and must recall its Chinese meaning.
Their answer: "${answer}"
Correct meaning: "${chunk.zh}"
Judge if the answer captures the core meaning. Exact wording not required.
Return JSON only: {"correct":true,"feedback":"繁中回饋 1-2 句"}`;
  }
  return `The learner must make a sentence using the English expression "${chunk.chunk}".
Their sentence: "${answer}"
Judge: (1) did they use "${chunk.chunk}" or a natural variation correctly, (2) is the sentence grammatically correct and natural.
Return JSON only: {"correct":true,"feedback":"繁中回饋，說明哪裡好或需改進，1-2 句"}`;
}

export default function ChunkReviewPage() {
  const router = useRouter();
  const { db } = useStudent();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [judging, setJudging] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!db) return;
    getDueChunks(db).then(chunks => {
      const shuffled = [...chunks].sort(() => Math.random() - 0.5);
      setItems(shuffled.map(chunk => ({ chunk, mode: MODES[Math.floor(Math.random() * 3)] })));
      setLoading(false);
    });
  }, [db]);

  const current = items[idx];

  const setupRecognition = useCallback((lang: string) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = lang; r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => { setListening(false); setInput(e.results[0][0].transcript); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
  }, []);

  useEffect(() => {
    if (!current) return;
    setupRecognition(current.mode === 'en_to_zh' ? 'zh-TW' : 'en-US');
  }, [current, setupRecognition]);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); return; }
    setListening(true);
    try { recognitionRef.current.start(); } catch {}
  };

  const judge = async () => {
    if (!input.trim() || judging || !current) return;
    setJudging(true);
    try {
      const raw = await callAI({ messages: [{ role: 'user', content: buildPrompt(current, input.trim()) }] });
      const res = extractJSON<JudgeResult>(raw);
      setResult(res);
      setScore(prev => ({ correct: prev.correct + (res.correct ? 1 : 0), total: prev.total + 1 }));
    } catch {
      setResult({ correct: false, feedback: '判斷失敗，請再試一次' });
    } finally {
      setJudging(false);
    }
  };

  const next = async () => {
    if (current && db && result) {
      await updateChunkSrs(db, current.chunk.id!, result.correct, (current.chunk.srsLevel ?? 0) as SrsLevel);
    }
    setResult(null); setInput(''); setHint(false);
    setIdx(prev => prev + 1);
  };

  const btn = (primary = false, disabled = false) => ({
    padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
    cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    fontWeight: 600 as const, fontSize: 15, opacity: disabled ? 0.5 : 1,
    background: primary ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: primary ? '#fff' : 'var(--text-muted)',
  });

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>載入中...</div>;

  if (items.length === 0) return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontSize: 20, marginBottom: 8 }}>🎉 今天沒有需要複習的 Chunk！</p>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>繼續加入新 Chunk，明天再來複習。</p>
      <button onClick={() => router.push('/chunks')} style={btn(true)}>回 Chunk 庫</button>
    </div>
  );

  if (idx >= items.length) return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>完成！</p>
      <p style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 24 }}>
        答對 {score.correct} / {score.total} 題
      </p>
      <button onClick={() => router.push('/chunks')} style={btn(true)}>回 Chunk 庫</button>
    </div>
  );

  const { chunk, mode } = current;
  const placeholder =
    mode === 'zh_to_en' ? '輸入英文...' :
    mode === 'en_to_zh' ? '輸入中文意思...' :
    '用這個 chunk 造一個英文句子...';

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      {/* 進度列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{idx + 1} / {items.length}</span>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 600 }}>
          {MODE_LABELS[mode]}
        </span>
      </div>

      {/* 題目 */}
      <div style={{ padding: '28px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', marginBottom: 20 }}>
        {mode === 'zh_to_en' && <p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{chunk.original}</p>}
        {mode === 'en_to_zh' && <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{chunk.chunk}</p>}
        {mode === 'sentence' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>用這個 chunk 造句</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{chunk.chunk}</p>
          </>
        )}
      </div>

      {/* 提示按鈕（造句模式不顯示） */}
      {mode !== 'sentence' && !result && (
        <button onClick={() => setHint(h => !h)} style={{ ...btn(), marginBottom: 14, fontSize: 13 }}>
          {hint ? '隱藏提示' : '💡 提示'}
        </button>
      )}
      {hint && (
        <div style={{ padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 14, color: '#92400e' }}>
          {mode === 'zh_to_en' ? chunk.chunk : chunk.zh}
        </div>
      )}

      {/* 輸入區 */}
      {!result && (
        <>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && judge()}
            placeholder={placeholder}
            disabled={judging || listening}
            style={{ width: '100%', padding: '12px 14px', boxSizing: 'border-box', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={toggleListen}
              disabled={judging}
              style={{ ...btn(false, judging), background: listening ? '#e53e3e' : 'var(--bg-tertiary)', color: listening ? '#fff' : 'var(--text-muted)' }}
            >
              {listening ? '停止' : '🎤 語音'}
            </button>
            <button onClick={judge} disabled={!input.trim() || judging || listening} style={{ ...btn(true, !input.trim() || judging || listening), flex: 1 }}>
              {judging ? '判斷中...' : '送出'}
            </button>
          </div>
        </>
      )}

      {/* AI 回饋 */}
      {result && (
        <div style={{ marginTop: 8 }}>
          <div style={{ padding: '16px 18px', borderRadius: 'var(--radius)', border: `1px solid ${result.correct ? '#6ee7b7' : '#fca5a5'}`, background: result.correct ? '#f0fdf4' : '#fff5f5', marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: result.correct ? '#065f46' : '#991b1b', margin: '0 0 6px' }}>
              {result.correct ? '✓ 正確！' : '✗ 再加油'}
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: result.correct ? '#065f46' : '#991b1b', lineHeight: 1.6 }}>
              {result.feedback}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              參考答案：<strong style={{ color: 'var(--text-primary)' }}>{mode === 'en_to_zh' ? chunk.zh : chunk.chunk}</strong>
            </p>
          </div>
          <button onClick={next} style={{ ...btn(true), width: '100%' }}>
            {idx >= items.length - 1 ? '完成複習' : '下一題 →'}
          </button>
        </div>
      )}
    </div>
  );
}
