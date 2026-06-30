import type { Student } from '@/types';

const LIST_KEY = 'students';
const CURRENT_KEY = 'currentStudentId';

export function getStudents(): Student[] {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function addStudent(name: string): Student {
  const students = getStudents();
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  const student: Student = { id, name, createdAt: Date.now() };
  localStorage.setItem(LIST_KEY, JSON.stringify([...students, student]));
  return student;
}

export function getCurrentStudentId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentStudentId(id: string): void {
  localStorage.setItem(CURRENT_KEY, id);
}

export function clearCurrentStudent(): void {
  localStorage.removeItem(CURRENT_KEY);
}
