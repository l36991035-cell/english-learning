import type { AppDb } from './index';
import type { Article } from '@/types';

export const addArticle = (db: AppDb, a: Omit<Article, 'id'>) => db.articles.add(a);
export const getArticles = (db: AppDb) => db.articles.orderBy('createdAt').reverse().toArray();
export const getArticle = (db: AppDb, id: number) => db.articles.get(id);
export const deleteArticle = (db: AppDb, id: number) => db.articles.delete(id);
