'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllVocab, getDueVocab } from '@/lib/db/vocabulary';
import { useStudent } from '@/context/StudentContext';
import type { VocabEntry } from '@/types';

export const useAllVocab = () => {
  const { db, currentStudent } = useStudent();
  return useLiveQuery(
    () => (db ? getAllVocab(db) : Promise.resolve([] as VocabEntry[])),
    [currentStudent?.id],
    [] as VocabEntry[]
  );
};

export const useDueVocab = () => {
  const { db, currentStudent } = useStudent();
  return useLiveQuery(
    () => (db ? getDueVocab(db) : Promise.resolve([] as VocabEntry[])),
    [currentStudent?.id],
    [] as VocabEntry[]
  );
};
