export type ArticleLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Article {
  id?: number;
  title: string;
  level: ArticleLevel;
  topic: string;
  text: string;
  sentences: string[];
  translations: string[];
  wordCount: number;
  createdAt: number;
}

export type SrsLevel = 0 | 1 | 2 | 3 | 4;

export interface VocabEntry {
  id?: number;
  word: string;
  definition: string;
  phonetic: string;
  example: string;
  srsLevel: SrsLevel;
  nextReview: number;
  createdAt: number;
}

export interface Student {
  id: string;
  name: string;
  createdAt: number;
}

export type ChunkRating = 1 | 2 | 3 | 4 | 5;

export interface ChunkEntry {
  id?: number;
  original: string;      // 使用者原本說的 / 文章中的原始片語
  chunk: string;         // 推薦的 chunk 表達
  zh: string;            // 中文意思
  why: string;           // 為什麼更自然
  rating: ChunkRating;   // 1-5 星
  examples: string[];    // 例句陣列
  category: string;      // e.g. "Daily Conversation"
  source: 'chat' | 'article'; // 來源
  createdAt: number;
}
