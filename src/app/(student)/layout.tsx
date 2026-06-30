'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStudent } from '@/context/StudentContext';

const TABS = [
  { href: '/input',   label: '新增'  },
  { href: '/library', label: '文章庫' },
  { href: '/read',    label: '閱讀'  },
  { href: '/vocab',   label: '單字庫' },
  { href: '/chat',    label: '對話'  },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { currentStudent } = useStudent();

  useEffect(() => {
    if (currentStudent === null) {
      router.replace('/');
    }
  }, [currentStudent, router]);

  if (!currentStudent) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 36, borderBottom: '1px solid var(--border)' }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
            ← {currentStudent.name}
          </Link>
        </div>
        <div style={{ display: 'flex', height: 46 }}>
          {TABS.map(t => (
            <Link key={t.href} href={t.href} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              color: path.startsWith(t.href) ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: path.startsWith(t.href) ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
