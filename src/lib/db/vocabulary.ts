import type { AppDb } from './index';
import type { VocabEntry, SrsLevel } from '@/types';

const INTERVALS_MS = [0, 1, 3, 7, 21].map(d => d * 86_400_000);

export const addVocab = (db: AppDb, e: Omit<VocabEntry, 'id'>) => db.vocab.add(e);
export const getAllVocab = (db: AppDb) => db.vocab.toArray().then(arr => arr.sort((a, b) => b.createdAt - a.createdAt));
export const getDueVocab = (db: AppDb) => db.vocab.where('nextReview').belowOrEqual(Date.now()).toArray();
export const deleteVocab = (db: AppDb, id: number) => db.vocab.delete(id);

export const advanceSrs = async (db: AppDb, id: number) => {
  const e = await db.vocab.get(id);
  if (!e) return;
  const next = Math.min(e.srsLevel + 1, 4) as SrsLevel;
  await db.vocab.update(id, { srsLevel: next, nextReview: Date.now() + INTERVALS_MS[next] });
};

export const resetSrs = async (db: AppDb, id: number) => {
  await db.vocab.update(id, { srsLevel: 0, nextReview: Date.now() });
};
