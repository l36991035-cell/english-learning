import { db } from './index';
import type { VocabEntry, SrsLevel } from '@/types';

const INTERVALS_MS = [0, 1, 3, 7, 21].map(d => d * 86_400_000);

export const addVocab = (e: Omit<VocabEntry, 'id'>) => db.vocab.add(e);
export const getAllVocab = () => db.vocab.orderBy('createdAt').reverse().toArray();
export const getDueVocab = () => db.vocab.where('nextReview').belowOrEqual(Date.now()).toArray();
export const deleteVocab = (id: number) => db.vocab.delete(id);

export const advanceSrs = async (id: number) => {
  const e = await db.vocab.get(id);
  if (!e) return;
  const next = Math.min(e.srsLevel + 1, 4) as SrsLevel;
  await db.vocab.update(id, { srsLevel: next, nextReview: Date.now() + INTERVALS_MS[next] });
};

export const resetSrs = async (id: number) => {
  await db.vocab.update(id, { srsLevel: 0, nextReview: Date.now() });
};
