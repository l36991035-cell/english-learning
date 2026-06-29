'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getArticle } from '@/lib/db/articles';
import { addVocab, getAllVocab } from '@/lib/db/vocabulary';
import type { Article } from '@/types';

type Lookup = { definition: string; phonetic: string; example: string };

function ReadPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = Number(params.get('id'));
  const [article, setArticle] = useState<Article | null>(null);
  const [shown, setShown] = useState<boolean[]>([]);
  const [word, setWord] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!id) return;
    getArticle(id).then(a => { if (a) { setArticle(a); setShown(new Array(a.sentences.length).fill(false)); }});
    getAllVocab().then(v => setSaved(new Set(v.map(e => e.word.toLowerCase()))));
  }, [id]);

  const handleSelect = useCallback(async () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel || sel.length < 2) return;
    setWord(sel); setLookup(null); setLookingUp(true);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `Look up "${sel}". Return JSON only: {"definition":"繁中 (詞性)","phonetic":"/IPA/","example":"example"}` }] }),
      });
      setLookup(JSON.parse((await res.json()).content));
    } catch {
      setLookup({ definition: '查詢失敗', phonetic: '', example: '' });
    } finally {
      setLookingUp(false);
    }
  }, []);

  const saveWord = async () => {
    if (!word || !lookup) return;
    await addVocab({ word, ...lookup, srsLevel: 0, nextReview: Date.now(), createdAt: Date.now() });
    setSaved(p => new Set([...p, word.toLowerCase()]));
    setToast(`已加入「${word}」`);
    setTimeout(() => setToast(''), 2000);
  };

  if (!article) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>載入中...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 640, margin: '0 auto' }}>
      <button onClick={() => router.push('/library')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 16, padding: 0 }}>← 返回</button>
      <h1 style={{ fontSize: 22, marginBottom: 4, fontFamily: 'Playfair Display, serif' }}>{article.title}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>{article.topic} · {article.wordCount} 字</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onMouseUp={handleSelect}>
        {article.sentences.map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <p style={{ margin: 0, lineHeight: 1.7, fontSize: 15 }}>{s}</p>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => { const u = new SpeechSynthesisUtterance(s); u.lang='en-US'; speechSynthesis.speak(u); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: 14 }}>▶</button>
                <button onClick={() => setShown(p => p.map((v,j) => j===i ? !v : v))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: shown[i] ? 'var(--accent)' : 'var(--text-subtle)', fontSize: 13, fontWeight: 600 }}>中</button>
              </div>
            </div>
            {shown[i] && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {article.translations[i] || '—'}
            </p>}
          </div>
        ))}
      </div>

      {(lookup || lookingUp) && (
        <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {lookingUp
            ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>查詢「{word}」...</p>
            : lookup && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 18 }}>{word}</strong>
                    <span className="mono" style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>{lookup.phonetic}</span>
                  </div>
                  <button onClick={saveWord} disabled={saved.has(word.toLowerCase())}
                    style={{ background: saved.has(word.toLowerCase()) ? 'var(--bg-tertiary)' : 'var(--accent)', color: saved.has(word.toLowerCase()) ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    {saved.has(word.toLowerCase()) ? '已儲存' : '加入單字庫'}
                  </button>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 14 }}>{lookup.definition}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{lookup.example}</p>
              </>}
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{toast}</div>}
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)' }}>載入中...</div>}>
      <ReadPageInner />
    </Suspense>
  );
}
