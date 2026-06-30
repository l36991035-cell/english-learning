import Dexie, { type EntityTable } from 'dexie';
import type { Article, VocabEntry } from '@/types';

export type AppDb = Dexie & {
  articles: EntityTable<Article, 'id'>;
  vocab: EntityTable<VocabEntry, 'id'>;
};

const cache = new Map<string, AppDb>();

export function getDb(studentId: string): AppDb {
  if (!cache.has(studentId)) {
    const db = new Dexie(`EnglishLearning_${studentId}`) as AppDb;
    db.version(1).stores({
      articles: '++id, level, createdAt',
      vocab: '++id, word, srsLevel, nextReview',
    });
    cache.set(studentId, db);
  }
  return cache.get(studentId)!;
}
