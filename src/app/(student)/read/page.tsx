'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getArticle, updateArticle } from '@/lib/db/articles';
import { addVocab, getAllVocab } from '@/lib/db/vocabulary';
import { useStudent } from '@/context/StudentContext';
import { callAI } from '@/lib/ai';
import type { Article } from '@/types';

type Lookup = { definition: string; phonetic: string; example: string };
type Analysis = { pattern: string; breakdown: string };
type ViewMode = 'full' | 'study';

function ReadPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { db } = useStudent();
  const id = Number(params.get('id'));
  const [article, setArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [shown, setShown] = useState<boolean[]>([]);
  const [showFullTrans, setShowFullTrans] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [word, setWord] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const [analyses, setAnalyses] = useState<Record<number, Analysis>>({});
  const [analyzing, setAnalyzing] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!id || !db) return;
    getArticle(db, id).then(a => {
      if (a) { setArticle(a); setShown(new Array(a.sentences.length).fill(false)); }
    });
    getAllVocab(db).then(v => setSaved(new Set(v.map(e => e.word.toLowerCase()))));
  }, [id, db]);

  // 即時翻譯全文（若尚無儲存翻譯）
  const translateAll = async () => {
    if (!article || !db) return;
    setTranslating(true);
    try {
      const raw = await callAI({
        messages: [{
          role: 'user',
          content: `將以下英文句子逐句翻譯成繁體中文，只回傳 JSON 陣列，順序相同。\n${JSON.stringify(article.sentences)}`,
        }],
      });
      const parsed: string[] = JSON.parse(raw);
      const translations = Array.isArray(parsed) ? parsed : [];
      await updateArticle(db, article.id!, { translations });
      setArticle(prev => prev ? { ...prev, translations } : prev);
    } catch {
      showToast('翻譯失敗，請重試');
    } finally {
      setTranslating(false);
    }
  };

  const handleSelect = useCallback(async () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel || sel.length < 2) return;
    setWord(sel); setLookup(null); setLookingUp(true);
    try {
      const raw = await callAI({ messages: [{ role: 'user', content: `Look up "${sel}". Return JSON only: {"definition":"繁中 (詞性)","phonetic":"/IPA/","example":"example"}` }] });
      setLookup(JSON.parse(raw));
    } catch {
      setLookup({ definition: '查詢失敗', phonetic: '', example: '' });
    } finally {
      setLookingUp(false);
    }
  }, []);

  const analyzeSentence = async (i: number, sentence: string) => {
    setAnalyzing(p => ({ ...p, [i]: true }));
    try {
      const raw = await callAI({
        messages: [{
          role: 'user',
          content: `分析此英文句子的句型結構，用繁體中文說明。只回傳 JSON：{"pattern":"句型（例如 S+V+O）","breakdown":"主詞：... | 動詞：... | 受詞：... 等詳細說明"}\n句子："${sentence}"`,
        }],
      });
      setAnalyses(p => ({ ...p, [i]: JSON.parse(raw) }));
    } catch {
      setAnalyses(p => ({ ...p, [i]: { pattern: '解析失敗', breakdown: '請重試' } }));
    } finally {
      setAnalyzing(p => ({ ...p, [i]: false }));
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const saveWord = async () => {
    if (!word || !lookup || !db) return;
    await addVocab(db, { word, ...lookup, srsLevel: 0, nextReview: Date.now(), createdAt: Date.now() });
    setSaved(p => new Set([...p, word.toLowerCase()]));
    showToast(`已加入「${word}」`);
  };

  const toggleAllShown = (show: boolean) => {
    setShown(new Array(article?.sentences.length ?? 0).fill(show));
  };

  if (!article) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>載入中...</div>;

  const hasTranslations = article.translations.length > 0 && article.translations.some(t => t);

  const modeBtn = (active: boolean) => ({
    padding: '6px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: active ? '#fff' : 'var(--text-muted)',
  });

  const iconBtn = (active = false) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color: active ? 'var(--accent)' : 'var(--text-subtle)',
    fontSize: 13, fontWeight: 600, padding: '2px 6px',
  });

  const pillBtn = (active = false) => ({
    padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 500,
    background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: active ? '#fff' : 'var(--text-muted)',
  });

  return (
    <div style={{ padding: 20, maxWidth: 640, margin: '0 auto' }}>
      <button onClick={() => router.push('/library')}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
        ← 返回
      </button>
      <h1 style={{ fontSize: 22, marginBottom: 4, fontFamily: 'Playfair Display, serif' }}>{article.title}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{article.topic} · {article.wordCount} 字</p>

      {/* 模式切換 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setViewMode('full')} style={modeBtn(viewMode === 'full')}>全文閱讀</button>
        <button onClick={() => setViewMode('study')} style={modeBtn(viewMode === 'study')}>逐句學習</button>
      </div>

      {/* ── 全文閱讀 ── */}
      {viewMode === 'full' && (
        <div onMouseUp={handleSelect}>
          <p style={{ lineHeight: 1.9, fontSize: 15, whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>
            {article.text}
          </p>

          {/* 翻譯按鈕 */}
          {hasTranslations ? (
            <>
              <button onClick={() => setShowFullTrans(p => !p)} style={{
                padding: '8px 18px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 16,
                background: showFullTrans ? 'var(--accent)' : 'var(--bg-secondary)',
                color: showFullTrans ? '#fff' : 'var(--text-muted)',
              }}>
                {showFullTrans ? '隱藏中文翻譯' : '顯示中文翻譯'}
              </button>
              {showFullTrans && (
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 16, lineHeight: 1.9, fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                  {article.translations.join(' ')}
                </div>
              )}
            </>
          ) : (
            <button onClick={translateAll} disabled={translating} style={{
              padding: '8px 18px', borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: translating ? 'default' : 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 16,
              background: 'var(--accent)', color: '#fff', opacity: translating ? 0.7 : 1,
            }}>
              {translating ? '翻譯中...' : '取得中文翻譯'}
            </button>
          )}

          {/* 全文句型解析提示 */}
          <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 8 }}>
            💡 切換到「逐句學習」可逐句解析句型
          </p>
        </div>
      )}

      {/* ── 逐句學習 ── */}
      {viewMode === 'study' && (
        <>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
            {!hasTranslations && (
              <button onClick={translateAll} disabled={translating} style={{ ...pillBtn(true), opacity: translating ? 0.7 : 1 }}>
                {translating ? '翻譯中...' : '取得翻譯'}
              </button>
            )}
            {hasTranslations && (
              <>
                <button onClick={() => toggleAllShown(true)} style={pillBtn(false)}>全部展開</button>
                <button onClick={() => toggleAllShown(false)} style={pillBtn(false)}>全部收起</button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onMouseUp={handleSelect}>
            {article.sentences.map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ margin: 0, lineHeight: 1.7, fontSize: 15, flex: 1 }}>{s}</p>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'flex-start' }}>
                    <button
                      onClick={() => { const u = new SpeechSynthesisUtterance(s); u.lang = 'en-US'; speechSynthesis.speak(u); }}
                      style={{ ...iconBtn(), fontSize: 14 }}>▶</button>
                    {hasTranslations && (
                      <button onClick={() => setShown(p => p.map((v, j) => j === i ? !v : v))}
                        style={iconBtn(shown[i])}>中</button>
                    )}
                    <button onClick={() => analyzeSentence(i, s)} disabled={analyzing[i]}
                      style={{ ...iconBtn(!!analyses[i]), fontSize: 12 }}>
                      {analyzing[i] ? '…' : '解析'}
                    </button>
                  </div>
                </div>

                {shown[i] && hasTranslations && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    {article.translations[i] || '—'}
                  </p>
                )}

                {analyses[i] && (
                  <div style={{ margin: '8px 0 0', fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{analyses[i].pattern}</span>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      {analyses[i].breakdown}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 單字查詢彈窗 */}
      {(lookup || lookingUp) && (
        <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {lookingUp
            ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>查詢「{word}」...</p>
            : lookup && (
              <>
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
              </>
            )}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
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
