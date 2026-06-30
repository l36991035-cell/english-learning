'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { getArticles } from '@/lib/db/articles';
import { useStudent } from '@/context/StudentContext';
import type { Article } from '@/types';

export function useArticles() {
  const { db, currentStudent } = useStudent();
  return useLiveQuery(
    () => (db ? getArticles(db) : Promise.resolve([] as Article[])),
    [currentStudent?.id],
    [] as Article[]
  );
}
