import Dexie, { type EntityTable } from 'dexie';
import type { Article, VocabEntry, ChunkEntry } from '@/types';

export type AppDb = Dexie & {
  articles: EntityTable<Article, 'id'>;
  vocab: EntityTable<VocabEntry, 'id'>;
  chunks: EntityTable<ChunkEntry, 'id'>;
};

const cache = new Map<string, AppDb>();

export function getDb(studentId: string): AppDb {
  if (!cache.has(studentId)) {
    const db = new Dexie(`EnglishLearning_${studentId}`) as AppDb;
    db.version(1).stores({
      articles: '++id, level, createdAt',
      vocab: '++id, word, srsLevel, nextReview',
    });
    db.version(2).stores({
      articles: '++id, level, createdAt',
      vocab: '++id, word, srsLevel, nextReview',
      chunks: '++id, rating, createdAt',
    });
    cache.set(studentId, db);
  }
  return cache.get(studentId)!;
}
