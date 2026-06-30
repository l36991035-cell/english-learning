'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Student } from '@/types';
import type { AppDb } from '@/lib/db';
import { getDb } from '@/lib/db';
import {
  getStudents,
  addStudent,
  getCurrentStudentId,
  setCurrentStudentId,
} from '@/lib/students';

interface StudentContextValue {
  currentStudent: Student | null;
  db: AppDb | null;
  students: Student[];
  selectStudent: (id: string) => void;
  createStudent: (name: string) => Student;
}

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  useEffect(() => {
    const list = getStudents();
    setStudents(list);
    const id = getCurrentStudentId();
    if (id) {
      const found = list.find(s => s.id === id) ?? null;
      setCurrentStudent(found);
    }
  }, []);

  const selectStudent = (id: string) => {
    const found = students.find(s => s.id === id) ?? null;
    setCurrentStudentId(id);
    setCurrentStudent(found);
  };

  const createStudent = (name: string): Student => {
    const student = addStudent(name);
    setStudents(prev => [...prev, student]);
    return student;
  };

  const db = currentStudent ? getDb(currentStudent.id) : null;

  return (
    <StudentContext.Provider value={{ currentStudent, db, students, selectStudent, createStudent }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudent must be used within StudentProvider');
  return ctx;
}
