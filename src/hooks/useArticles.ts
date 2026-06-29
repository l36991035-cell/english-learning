'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { getArticles } from '@/lib/db/articles';

export function useArticles() {
  return useLiveQuery(() => getArticles(), [], []);
}
