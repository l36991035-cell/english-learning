'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllVocab, getDueVocab } from '@/lib/db/vocabulary';

export const useAllVocab = () => useLiveQuery(() => getAllVocab(), [], []);
export const useDueVocab = () => useLiveQuery(() => getDueVocab(), [], []);
