'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudent } from '@/context/StudentContext';

export default function SelectStudentPage() {
  const router = useRouter();
  const { students, selectStudent, createStudent } = useStudent();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const enter = (id: string) => {
    selectStudent(id);
    router.push('/library');
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const student = createStudent(trimmed);
    setName('');
    setAdding(false);
    enter(student.id);
  };

  const card = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 24px', cursor: 'pointer',
    fontSize: 18, fontWeight: 600, textAlign: 'center' as const,
    transition: 'border-color 0.15s',
  };

  const btn = (primary = false) => ({
    padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, fontSize: 15,
    background: primary ? 'var(--accent)' : 'var(--bg-tertiary)',
    color: primary ? '#fff' : 'var(--text-muted)',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>English Learning</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>選擇你的帳號</p>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {students.map(s => (
          <div key={s.id} onClick={() => enter(s.id)} style={card}>
            {s.name}
          </div>
        ))}

        {adding ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="輸入名字..."
              style={{ flex: 1, padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 15 }}
            />
            <button onClick={handleAdd} style={btn(true)}>確認</button>
            <button onClick={() => { setAdding(false); setName(''); }} style={btn()}>取消</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ ...btn(), border: '1px dashed var(--border)', padding: '16px 24px', borderRadius: 'var(--radius)' }}>
            ＋ 新增學生
          </button>
        )}
      </div>
    </div>
  );
}
