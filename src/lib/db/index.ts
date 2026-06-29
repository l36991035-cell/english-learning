import Dexie, { type EntityTable } from 'dexie';
import type { Article, VocabEntry } from '@/types';

const db = new Dexie('EnglishLearning') as Dexie & {
  articles: EntityTable<Article, 'id'>;
  vocab: EntityTable<VocabEntry, 'id'>;
};

db.version(1).stores({
  articles: '++id, level, createdAt',
  vocab: '++id, word, srsLevel, nextReview',
});

export { db };
