'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';

const LINKS = [
  { href: '/', label: 'Recipes' },
  { href: '/plan', label: 'Weekly planner' },
  { href: '/shopping', label: 'Shopping list' },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand">
          <span className="brand__mark" aria-hidden="true">
            🍅
          </span>
          Recipe Planner
        </Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/' || pathname.startsWith('/recipes')
                : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

type Health = 'checking' | 'ok' | 'down';

// Shows whether the API and its database answer; the page itself does not depend on it.
export function ApiHealth() {
  const [state, setState] = useState<{ status: Health; text: string }>({
    status: 'checking',
    text: 'checking the kitchen…',
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/health`, { cache: 'no-store', signal: controller.signal })
      .then((r) => r.json())
      .then((d: { status: string; db: string }) =>
        setState({ status: 'ok', text: `api ${d.status} / db ${d.db}` }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'down', text: 'api unreachable' });
      });
    return () => controller.abort();
  }, []);

  return (
    <footer className="site-footer">
      <span
        className="health-dot"
        data-status={state.status === 'checking' ? undefined : state.status}
        aria-hidden="true"
      />
      <span data-testid="health">{state.text}</span>
    </footer>
  );
}
