'use client';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteChunk } from '@/lib/db/chunks';
import { useStudent } from '@/context/StudentContext';
import type { ChunkRating } from '@/types';

const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
const RATING_LABEL: Record<ChunkRating, string> = {
  5: '每日必用',
  4: '非常常見',
  3: '實用',
  2: '偶爾',
  1: '少見',
};

export default function ChunksPage() {
  const { db } = useStudent();
  const [filterRating, setFilterRating] = useState<ChunkRating | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const allChunks = useLiveQuery(
    () => db ? db.chunks.toArray().then(arr => arr.sort((a, b) => b.createdAt - a.createdAt)) : [],
    [db]
  ) ?? [];

  const shown = allChunks.filter(c => {
    if (filterRating !== 'all' && c.rating !== filterRating) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.chunk.toLowerCase().includes(q) || c.zh.includes(q) || c.original?.toLowerCase().includes(q);
    }
    return true;
  });

  const chip = (active: boolean, color = 'var(--accent)') => ({
    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: active ? color : 'var(--bg-tertiary)',
    color: active ? '#fff' : 'var(--text-muted)',
  });

  const inp = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box' as const,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: 15,
  };

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Chunk 庫</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        共 {allChunks.length} 個 Chunk
      </p>

      {/* 搜尋 */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="搜尋 chunk 或中文意思..."
        style={{ ...inp, marginBottom: 12 }}
      />

      {/* 星級篩選 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilterRating('all')} style={chip(filterRating === 'all')}>全部</button>
        {([5, 4, 3, 2, 1] as ChunkRating[]).map(r => (
          <button key={r} onClick={() => setFilterRating(filterRating === r ? 'all' : r)}
            style={chip(filterRating === r, '#f59e0b')}>
            {'★'.repeat(r)} {RATING_LABEL[r]}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p style={{ color: 'var(--text-subtle)', textAlign: 'center', marginTop: 60 }}>
          {allChunks.length === 0 ? '尚無收藏的 Chunk，去對話或閱讀頁收藏吧！' : '沒有符合的 Chunk'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(c => {
          const isExpanded = expanded[c.id!];
          return (
            <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
              {/* 摘要列 */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 8 }}>
                <button
                  onClick={() => setExpanded(p => ({ ...p, [c.id!]: !p[c.id!] }))}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  <span style={{ fontSize: 16 }}>💡</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>{c.chunk}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 8 }}>{c.zh}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1, flexShrink: 0 }}>{STARS(c.rating)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-subtle)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                </button>
                <button
                  onClick={() => c.id && db && deleteChunk(db, c.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: '0 4px' }}
                >✕</button>
              </div>

              {/* 展開內容 */}
              {isExpanded && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                  {c.original && (
                    <p style={{ margin: '10px 0 4px', fontSize: 13, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-subtle)' }}>原文：</span>
                      <em>{c.original}</em>
                    </p>
                  )}
                  <p style={{ margin: '8px 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{c.why}</p>
                  {c.examples?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>例句</p>
                      {c.examples.map((ex, i) => (
                        <p key={i} style={{ margin: '0 0 3px', fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>• {ex}</p>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-subtle)' }}>
                      {c.source === 'chat' ? '對話' : '文章'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{c.category}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
