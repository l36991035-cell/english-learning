'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useArticles } from '@/hooks/useArticles';
import { deleteArticle, updateArticle } from '@/lib/db/articles';
import { useStudent } from '@/context/StudentContext';
import type { ArticleLevel } from '@/types';

const LABEL: Record<ArticleLevel, string> = { beginner:'初級', intermediate:'中級', advanced:'高級' };
const COLOR: Record<ArticleLevel, string> = { beginner:'#10b981', intermediate:'#f59e0b', advanced:'#ef4444' };

export default function LibraryPage() {
  const router = useRouter();
  const { db } = useStudent();
  const articles = useArticles() ?? [];
  const [filter, setFilter] = useState<ArticleLevel | 'all'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const shown = filter === 'all' ? articles : articles.filter(a => a.level === filter);

  const chip = (active: boolean, color = 'var(--accent)') => ({
    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: active ? color : 'var(--bg-tertiary)',
    color: active ? '#fff' : 'var(--text-muted)',
  });

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>文章庫</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>全部</button>
        {(['beginner','intermediate','advanced'] as ArticleLevel[]).map(l => (
          <button key={l} onClick={() => setFilter(l)} style={chip(filter === l, COLOR[l])}>{LABEL[l]}</button>
        ))}
      </div>
      {shown.length === 0 && (
        <p style={{ color: 'var(--text-subtle)', textAlign: 'center', marginTop: 60 }}>
          尚無文章，前往「新增」加入第一篇
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map(a => (
          <div key={a.id} onClick={() => router.push(`/read?id=${a.id}`)}
            style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 16, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: COLOR[a.level] + '22', color: COLOR[a.level], display: 'inline-block', marginBottom: 6 }}>
                  {LABEL[a.level]}
                </span>
                {editingId === a.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => { if (db && editTitle.trim()) updateArticle(db, a.id!, { title: editTitle.trim() }); setEditingId(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 16, margin: '0 0 4px', fontFamily: 'Playfair Display, serif', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)' }}
                  />
                ) : (
                  <h3
                    onClick={e => { e.stopPropagation(); setEditingId(a.id!); setEditTitle(a.title); }}
                    title="點擊編輯標題"
                    style={{ fontSize: 16, margin: '0 0 4px', fontFamily: 'Playfair Display, serif', cursor: 'text', minHeight: 24 }}
                  >
                    {a.title || <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>（未命名）</span>}
                  </h3>
                )}
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{a.topic} · {a.wordCount} 字</p>
              </div>
              <button onClick={e => { e.stopPropagation(); db && deleteArticle(db, a.id!); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
