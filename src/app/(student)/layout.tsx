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
      <main style={{ paddingBottom: 64 }}>{children}</main>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
        display: 'flex',
      }}>
        {TABS.map(t => (
          <Link key={t.href} href={t.href} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 500, textDecoration: 'none',
            color: path.startsWith(t.href) ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'color 0.15s',
          }}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
