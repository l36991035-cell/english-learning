import type { AppDb } from '@/lib/db';
import type { ChunkEntry } from '@/types';

export async function addChunk(db: AppDb, entry: Omit<ChunkEntry, 'id'>): Promise<number> {
  return db.chunks.add(entry) as Promise<number>;
}

export async function getAllChunks(db: AppDb): Promise<ChunkEntry[]> {
  return db.chunks.toArray().then(arr => arr.sort((a, b) => b.createdAt - a.createdAt));
}

export async function deleteChunk(db: AppDb, id: number): Promise<void> {
  return db.chunks.delete(id);
}
