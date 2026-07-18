'use client';
import { useState, useCallback } from 'react';
import { callAI, extractJSON } from '@/lib/ai';

export type Lookup = {
  definition: string;
  phonetic: string;
  example: string;
  example_zh: string;
  example_breakdown: string;
  phrases: string[];
  informal: string;
};

export function useWordLookup() {
  const [word, setWord] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const lookupWord = useCallback(async (raw: string) => {
    const w = raw.replace(/[^a-zA-Z''-]/g, '').trim();
    if (!w || w.length < 2) return;
    setWord(w);
    setLookup(null);
    setLookingUp(true);
    try {
      const result = await callAI({
        messages: [{
          role: 'user',
          content: `Look up "${w}". Return JSON only: {"definition":"繁中定義 (詞性)","phonetic":"/IPA/","example":"自然英文例句","example_zh":"例句中文翻譯","example_breakdown":"例句語法結構解析（繁中，說明主詞/動詞/受詞等）","phrases":["常見片語或搭配詞: 中文意思"],"informal":"口語或非正式用法說明（若無則空字串）"}`,
        }],
      });
      setLookup(extractJSON<Lookup>(result));
    } catch {
      setLookup({ definition: '查詢失敗', phonetic: '', example: '', example_zh: '', example_breakdown: '', phrases: [], informal: '' });
    } finally {
      setLookingUp(false);
    }
  }, []);

  const clear = useCallback(() => { setWord(''); setLookup(null); }, []);

  return { word, lookup, lookingUp, lookupWord, clear };
}
