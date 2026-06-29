'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/input',   label: '新增'  },
  { href: '/library', label: '文章庫' },
  { href: '/read',    label: '閱讀'  },
  { href: '/vocab',   label: '單字庫' },
  { href: '/chat',    label: '對話'  },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, height: 52,
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex',
      }}>
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
      </nav>
      <main>{children}</main>
    </div>
  );
}
