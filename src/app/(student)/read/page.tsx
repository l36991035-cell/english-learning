'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getArticle, updateArticle } from '@/lib/db/articles';
import { addVocab, getAllVocab } from '@/lib/db/vocabulary';
import { useStudent } from '@/context/StudentContext';
import { callAI, extractJSON } from '@/lib/ai';
import type { Article, ChunkEntry } from '@/types';
import { addChunk } from '@/lib/db/chunks';

type Lookup = { definition: string; phonetic: string; example: string; example_zh: string; example_breakdown: string; phrases: string[]; informal: string };
type Analysis = { pattern: string; breakdown: string };
type ViewMode = 'full' | 'study' | 'chunks';
type ChunkData = { original: string; chunk: string; zh: string; why: string; rating: 1|2|3|4|5; examples: string[]; category: string };

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
  const [articleChunks, setArticleChunks] = useState<ChunkData[]>([]);
  const [fetchingChunks, setFetchingChunks] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});
  const [savedChunkIdxs, setSavedChunkIdxs] = useState<Set<number>>(new Set());

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
      const parsed = extractJSON<string[]>(raw);
      const translations = Array.isArray(parsed) ? parsed : [];
      await updateArticle(db, article.id!, { translations });
      setArticle(prev => prev ? { ...prev, translations } : prev);
    } catch {
      showToast('翻譯失敗，請重試');
    } finally {
      setTranslating(false);
    }
  };

  const lookupWord = useCallback(async (raw: string) => {
    const w = raw.replace(/[^a-zA-Z'’-]/g, '').trim();
    if (!w || w.length < 2) return;
    setWord(w); setLookup(null); setLookingUp(true);
    try {
      const result = await callAI({ messages: [{ role: 'user', content: `Look up "${w}". Return JSON only: {"definition":"繁中定義 (詞性)","phonetic":"/IPA/","example":"自然英文例句","example_zh":"例句中文翻譯","example_breakdown":"例句語法結構解析（繁中，說明主詞/動詞/受詞等）","phrases":["常見片語或搭配詞: 中文意思"],"informal":"口語或非正式用法說明（若無則空字串）"}` }] });
      setLookup(extractJSON<Lookup>(result));
    } catch {
      setLookup({ definition: '查詢失敗', phonetic: '', example: '', example_zh: '', example_breakdown: '', phrases: [], informal: '' });
    } finally {
      setLookingUp(false);
    }
  }, []);

  const renderWords = (text: string) =>
    text.split(/(\s+)/).map((token, i) =>
      /^\s+$/.test(token) ? token :
      <span key={i} onClick={() => lookupWord(token)}
        style={{ cursor: 'pointer', borderRadius: 2, padding: '0 1px' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >{token}</span>
    );

  const analyzeSentence = async (i: number, sentence: string) => {
    setAnalyzing(p => ({ ...p, [i]: true }));
    try {
      const raw = await callAI({
        messages: [{
          role: 'user',
          content: `分析此英文句子的句型結構，用繁體中文說明。只回傳 JSON：{"pattern":"句型（例如 S+V+O）","breakdown":"主詞：... | 動詞：... | 受詞：... 等詳細說明"}\n句子："${sentence}"`,
        }],
      });
      setAnalyses(p => ({ ...p, [i]: extractJSON<Analysis>(raw) }));
    } catch {
      setAnalyses(p => ({ ...p, [i]: { pattern: '解析失敗', breakdown: '請重試' } }));
    } finally {
      setAnalyzing(p => ({ ...p, [i]: false }));
    }
  };

  const fetchArticleChunks = async () => {
    if (!article) return;
    setFetchingChunks(true);
    setArticleChunks([]);
    setExpandedChunks({});
    setSavedChunkIdxs(new Set());
    try {
      const raw = await callAI({
        messages: [{
          role: 'user',
          content: `Analyze this English article and find 3–6 high-value chunks (natural expressions, collocations, conversational phrases) worth learning.
Return JSON array only:
[{"original":"exact phrase from text","chunk":"the chunk expression","zh":"中文意思","why":"為什麼值得學（繁中，1-2句）","rating":5,"examples":["例句1","例句2","例句3"],"category":"Daily Conversation"}]

Rating: 5=extremely common daily use, 4=very common, 3=useful.
Only include rating 3+. Prioritize chunks a learner can reuse in conversation.

Article:
${article.text.slice(0, 3000)}`,
        }],
      });
      const parsed = extractJSON<ChunkData[]>(raw);
      if (Array.isArray(parsed)) setArticleChunks(parsed);
    } catch {
      showToast('分析失敗，請重試');
    } finally {
      setFetchingChunks(false);
    }
  };

  const saveArticleChunk = async (idx: number, chunk: ChunkData) => {
    if (!db) return;
    const entry: Omit<ChunkEntry, 'id'> = { ...chunk, source: 'article', createdAt: Date.now() };
    await addChunk(db, entry);
    setSavedChunkIdxs(prev => new Set([...prev, idx]));
    showToast(`「${chunk.chunk}」已加入 Chunk 庫`);
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
      <h1 style={{ fontSize: 24, marginBottom: 4, fontFamily: 'Playfair Display, serif' }}>{article.title}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 16 }}>{article.topic} · {article.wordCount} 字</p>

      {/* 模式切換 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setViewMode('full')} style={modeBtn(viewMode === 'full')}>全文閱讀</button>
        <button onClick={() => setViewMode('study')} style={modeBtn(viewMode === 'study')}>逐句學習</button>
        <button onClick={() => { setViewMode('chunks'); if (articleChunks.length === 0 && !fetchingChunks) fetchArticleChunks(); }} style={modeBtn(viewMode === 'chunks')}>
          {fetchingChunks ? '分析中...' : '✨ Chunks'}
        </button>
      </div>

      {/* ── 全文閱讀 ── */}
      {viewMode === 'full' && (
        <div>
          <p style={{ lineHeight: 1.9, fontSize: 17, whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>
            {renderWords(article.text)}
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
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 16, lineHeight: 1.9, fontSize: 16, color: 'var(--text-muted)', marginBottom: 20 }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {article.sentences.map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ margin: 0, lineHeight: 1.7, fontSize: 17, flex: 1 }}>{renderWords(s)}</p>
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
                  <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
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

      {/* ── Chunks ── */}
      {viewMode === 'chunks' && (
        <div>
          {fetchingChunks && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>AI 正在分析文章 Chunks...</p>
          )}
          {!fetchingChunks && articleChunks.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>點擊下方按鈕讓 AI 找出這篇文章值得學習的 Chunk</p>
              <button onClick={fetchArticleChunks} style={{ padding: '10px 24px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 16 }}>
                ✨ 找 Chunks
              </button>
            </div>
          )}
          {articleChunks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {articleChunks.map((chunk, i) => {
                const expanded = expandedChunks[i];
                const saved = savedChunkIdxs.has(i);
                const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
                return (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                    <button
                      onClick={() => setExpandedChunks(p => ({ ...p, [i]: !p[i] }))}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 16 }}>💡</span>
                      <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent)', flex: 1 }}>{chunk.chunk}</span>
                      <span style={{ fontSize: 12, color: '#f59e0b', letterSpacing: 1 }}>{STARS(chunk.rating)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-subtle)', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
                    </button>
                    {expanded && (
                      <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                        <p style={{ margin: '10px 0 4px', fontSize: 13, color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--text-subtle)' }}>原文：</span>
                          <em>{chunk.original}</em>
                        </p>
                        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {chunk.chunk} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 14 }}>（{chunk.zh}）</span>
                        </p>
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{chunk.why}</p>
                        {chunk.examples.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            {chunk.examples.map((ex, j) => (
                              <p key={j} style={{ margin: '0 0 3px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>• {ex}</p>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => !saved && saveArticleChunk(i, chunk)}
                          disabled={saved}
                          style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', cursor: saved ? 'default' : 'pointer', background: saved ? 'var(--bg-tertiary)' : 'var(--accent)', color: saved ? 'var(--text-muted)' : '#fff' }}
                        >
                          {saved ? '已收藏' : '加入 Chunk 庫'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={fetchArticleChunks} style={{ marginTop: 4, padding: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                重新分析
              </button>
            </div>
          )}
        </div>
      )}

      {/* 單字查詢彈窗 */}
      {(lookup || lookingUp) && (
        <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', maxHeight: '60vh', overflowY: 'auto' }}>
          {lookingUp
            ? <p style={{ color: 'var(--text-muted)', margin: 0, padding: 16 }}>查詢「{word}」...</p>
            : lookup && (
              <div style={{ padding: 16 }}>
                {/* 單字標題列 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 20 }}>{word}</strong>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>{lookup.phonetic}</span>
                    <button onClick={() => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; u.rate = 0.85; window.speechSynthesis.speak(u); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>🔊</button>
                  </div>
                  <button onClick={saveWord} disabled={saved.has(word.toLowerCase())}
                    style={{ background: saved.has(word.toLowerCase()) ? 'var(--bg-tertiary)' : 'var(--accent)', color: saved.has(word.toLowerCase()) ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                    {saved.has(word.toLowerCase()) ? '已儲存' : '加入單字庫'}
                  </button>
                </div>

                {/* 定義 */}
                <p style={{ margin: '0 0 12px', fontSize: 16 }}>{lookup.definition}</p>

                {/* 例句區塊 */}
                <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid var(--accent)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontStyle: 'italic', color: 'var(--text-primary)' }}>{lookup.example}</p>
                  {lookup.example_zh && <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text-muted)' }}>{lookup.example_zh}</p>}
                  {lookup.example_breakdown && (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                      解析：{lookup.example_breakdown}
                    </p>
                  )}
                </div>

                {/* 常見片語 */}
                {lookup.phrases?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>常見片語</p>
                    {lookup.phrases.map((ph, i) => (
                      <p key={i} style={{ margin: '0 0 3px', fontSize: 14, color: 'var(--text-muted)' }}>• {ph}</p>
                    ))}
                  </div>
                )}

                {/* 口語用法 */}
                {lookup.informal && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>口語用法</p>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{lookup.informal}</p>
                  </div>
                )}
              </div>
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
