'use client';
import { useState } from 'react';
import { callAI, extractJSON } from '@/lib/ai';
import { useStudent } from '@/context/StudentContext';
import { addChunk } from '@/lib/db/chunks';
import type { ChunkEntry, ChunkRating } from '@/types';

type ChunkData = {
  original: string;
  chunk: string;
  zh: string;
  why: string;
  rating: ChunkRating;
  examples: string[];
  category: string;
};

type TranslationResult = {
  translation: string;
  chunks: ChunkData[];
};

const SYSTEM = `You are a Chinese-to-English translation assistant for a Mandarin speaker learning natural spoken English.

Given Chinese text, return ONLY valid JSON in this exact format:
{"translation":"natural spoken English translation","chunks":[{"original":"中文片語","chunk":"English expression","zh":"中文意思","why":"為什麼這樣說比較自然（繁中）","rating":4,"examples":["example 1","example 2","example 3"],"category":"Daily Conversation"}]}

Chunk rules:
- Focus on non-obvious translations: idioms, collocations, natural spoken patterns
- Skip basic vocabulary easily guessed from Chinese
- Aim for 2-5 high-value chunks per input
- rating: 5=daily use, 4=very common, 3=useful, 2=occasional, 1=rare
- category options: Daily Conversation / Work / Emotions / Social / Travel / Food / Technology / Culture / Other`;

const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

const speak = (text: string) => {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.9;
  window.speechSynthesis.speak(u);
};

export default function TranslatePage() {
  const { db } = useStudent();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const translate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setSaved(new Set());
    setExpanded(new Set());
    try {
      const raw = await callAI({
        system: SYSTEM,
        messages: [{ role: 'user', content: input.trim() }],
      });
      const parsed = extractJSON<TranslationResult>(raw);
      setResult(parsed);
    } catch {
      showToast('翻譯失敗，請再試一次');
    } finally {
      setLoading(false);
    }
  };

  const saveChunk = async (idx: number, chunk: ChunkData) => {
    if (!db) return;
    const entry: Omit<ChunkEntry, 'id'> = { ...chunk, source: 'translation', createdAt: Date.now() };
    await addChunk(db, entry);
    setSaved(prev => new Set([...prev, idx]));
    showToast(`「${chunk.chunk}」已加入 Chunk 庫`);
  };

  const toggleExpand = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const inp = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box' as const,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: 16, resize: 'vertical' as const,
  };

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>中翻英</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        輸入中文，獲得自然英文翻譯與 Chunk 對應
      </p>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) translate(); }}
        placeholder="輸入中文句子或段落..."
        rows={4}
        style={inp}
      />

      <button
        onClick={translate}
        disabled={loading || !input.trim()}
        style={{
          marginTop: 12, width: '100%', padding: '14px',
          background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)',
          color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 16,
          cursor: loading || !input.trim() ? 'default' : 'pointer',
          opacity: loading || !input.trim() ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? '翻譯中...' : '翻譯'}
      </button>

      {result && (
        <div style={{ marginTop: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            英文翻譯
          </p>
          <div style={{ padding: '16px 18px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 18, lineHeight: 1.7, marginBottom: 28 }}>
            {result.translation}
          </div>

          {result.chunks.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Chunk 對應（{result.chunks.length}）
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.chunks.map((chunk, idx) => {
                  const isExpanded = expanded.has(idx);
                  const isSaved = saved.has(idx);
                  return (
                    <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                      <button
                        onClick={() => toggleExpand(idx)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{chunk.original}</span>
                          <span style={{ margin: '0 8px', color: 'var(--text-subtle)' }}>→</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{chunk.chunk}</span>
                          <button
                            onClick={e => { e.stopPropagation(); speak(chunk.chunk); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px', flexShrink: 0 }}
                          >🔊</button>
                        </div>
                        <span style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1, flexShrink: 0 }}>{STARS(chunk.rating)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-subtle)', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                          <p style={{ margin: '10px 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{chunk.why}</p>
                          {chunk.examples.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>例句</p>
                              {chunk.examples.map((ex, i) => (
                                <p key={i} style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>• {ex}</p>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            <button
                              onClick={() => !isSaved && saveChunk(idx, chunk)}
                              disabled={isSaved}
                              style={{
                                padding: '6px 14px', fontSize: 13, fontWeight: 600,
                                borderRadius: 'var(--radius-sm)', border: 'none',
                                cursor: isSaved ? 'default' : 'pointer',
                                background: isSaved ? 'var(--bg-tertiary)' : 'var(--accent)',
                                color: isSaved ? 'var(--text-muted)' : '#fff',
                              }}
                            >
                              {isSaved ? '已收藏' : '加入 Chunk 庫'}
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{chunk.category}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 300, pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
