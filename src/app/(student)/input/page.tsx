'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addArticle } from '@/lib/db/articles';
import { useStudent } from '@/context/StudentContext';
import { callAI, extractJSON } from '@/lib/ai';
import type { ArticleLevel } from '@/types';
import type { AppDb } from '@/lib/db';

type Mode = 'text' | 'photo' | 'url' | 'youtube';

async function ai(prompt: string, imageBase64?: string): Promise<string> {
  return callAI({ messages: [{ role: 'user', content: prompt }], ...(imageBase64 ? { imageBase64 } : {}) });
}

async function processAndSave(db: AppDb, rawText: string, router: ReturnType<typeof useRouter>, setStatus: (s: string) => void) {
  setStatus('分析文章...');
  const metaRaw = await ai(`Analyze this English article and return JSON only (no markdown):
{"title":"concise English article title","level":"beginner|intermediate|advanced","topic":"中文主題（2-4字）"}
Article: ${rawText.slice(0, 2000)}`);
  const meta = (() => { try { return extractJSON(metaRaw) as { title: string; level: string; topic: string }; } catch { return { title: 'Untitled', level: 'intermediate', topic: '一般' }; } })();

  setStatus('切分句子...');
  const sentences = rawText.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) ?? [rawText];

  setStatus('翻譯中...');
  const transRaw = await ai(`Translate each English sentence to Traditional Chinese. Return JSON array only, same order.\n${JSON.stringify(sentences)}`);
  const translations: string[] = (() => { try { const p = extractJSON(transRaw); return Array.isArray(p) ? p : []; } catch { return []; } })();

  await addArticle(db, {
    title: meta.title, level: meta.level as ArticleLevel, topic: meta.topic,
    text: rawText, sentences, translations,
    wordCount: rawText.split(/\s+/).length, createdAt: Date.now(),
  });
  router.push('/library');
}

export default function InputPage() {
  const router = useRouter();
  const { db } = useStudent();
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } catch { setStatus('發生錯誤，請重試'); } finally { setLoading(false); }
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    const reader = new FileReader();
    reader.onload = () => run(async () => {
      const b64 = (reader.result as string).split(',')[1];
      setStatus('OCR 識別中...');
      const extracted = await ai('Extract all English text from this image. Return text only.', b64);
      await processAndSave(db, extracted, router, setStatus);
    });
    reader.readAsDataURL(file);
  };

  const s = (active: boolean) => ({
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s',
    background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: active ? '#fff' : 'var(--text-muted)',
  });

  const inp = {
    width: '100%', padding: '14px 16px', boxSizing: 'border-box' as const,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: 15,
  };

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>新增文章</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['text','photo','url','youtube'] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} style={s(mode === m)}>
            {{ text:'貼文', photo:'圖片 OCR', url:'網址', youtube:'YouTube' }[m]}
          </button>
        ))}
      </div>

      {mode === 'text' && <>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="貼上英文文章..."
          style={{ ...inp, minHeight: 200, resize: 'vertical' }} />
        <button onClick={() => db && run(() => processAndSave(db, text, router, setStatus))}
          disabled={loading || !text.trim()} style={{ ...s(true), marginTop: 12, width: '100%', padding: 12 }}>
          {loading ? status : '分析並儲存'}
        </button>
      </>}

      {mode === 'photo' && (
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px dashed var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>選擇包含英文的圖片</p>
          <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} id="pi" />
          <label htmlFor="pi" style={{ ...s(true), padding: '10px 24px', cursor: 'pointer' }}>
            {loading ? status : '選擇圖片'}
          </label>
        </div>
      )}

      {(mode === 'url' || mode === 'youtube') && <>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder={mode === 'url' ? 'https://...' : 'https://youtube.com/watch?v=...'}
          style={inp} />
        <button
          onClick={() => db && run(async () => {
            setStatus(mode === 'url' ? '抓取文章...' : '擷取字幕...');
            const prompt = mode === 'url'
              ? `Fetch and extract the main article text from: ${url}. Return body text only, no HTML.`
              : `Extract and clean English transcript from YouTube: ${url}. Remove timestamps, speaker labels, non-English text.`;
            const content = await ai(prompt);
            await processAndSave(db, content, router, setStatus);
          })}
          disabled={loading || !url.trim()} style={{ ...s(true), marginTop: 12, width: '100%', padding: 12 }}>
          {loading ? status : '擷取並儲存'}
        </button>
      </>}
    </div>
  );
}
