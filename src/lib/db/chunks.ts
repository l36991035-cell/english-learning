import type { AppDb } from '@/lib/db';
import type { ChunkEntry, SrsLevel } from '@/types';

const SRS_INTERVALS = [0, 1, 3, 7, 21].map(d => d * 24 * 60 * 60 * 1000);

export async function addChunk(db: AppDb, entry: Omit<ChunkEntry, 'id'>): Promise<number> {
  return db.chunks.add(entry) as Promise<number>;
}

export async function getAllChunks(db: AppDb): Promise<ChunkEntry[]> {
  return db.chunks.toArray().then(arr => arr.sort((a, b) => b.createdAt - a.createdAt));
}

export async function deleteChunk(db: AppDb, id: number): Promise<void> {
  return db.chunks.delete(id);
}

export async function getDueChunks(db: AppDb): Promise<ChunkEntry[]> {
  const now = Date.now();
  const all = await db.chunks.toArray();
  return all.filter(c => !c.nextReview || c.nextReview <= now);
}

export async function updateChunkSrs(db: AppDb, id: number, correct: boolean, currentLevel: SrsLevel = 0): Promise<void> {
  const newLevel = (correct ? Math.min(4, currentLevel + 1) : 0) as SrsLevel;
  const nextReview = Date.now() + SRS_INTERVALS[newLevel];
  await db.chunks.update(id, { srsLevel: newLevel, nextReview });
}
