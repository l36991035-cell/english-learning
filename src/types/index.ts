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
