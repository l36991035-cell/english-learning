import { db } from './index';
import type { Article } from '@/types';

export const addArticle = (a: Omit<Article, 'id'>) => db.articles.add(a);
export const getArticles = () => db.articles.orderBy('createdAt').reverse().toArray();
export const getArticle = (id: number) => db.articles.get(id);
export const deleteArticle = (id: number) => db.articles.delete(id);
