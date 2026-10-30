'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type ShoppingItem, type ShoppingList as ShoppingListData, query } from '@/lib/api';
import { formatDayLong, isIsoDay, mondayOf } from '@/lib/dates';
import { formatQuantity } from '@/lib/format';
import { useToday } from '@/lib/hooks';
import { EmptyState, ErrorState } from './ui';

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 50;
const DEFAULT_SERVINGS = 2;

// The week comes from ?week=, falling back to the current week once the browser knows today.
export function ShoppingList() {
  const params = useSearchParams();
  const requested = params.get('week');
  const today = useToday();
  const week = isIsoDay(requested) ? mondayOf(requested) : today ? mondayOf(today) : null;

  // Keyed by week so checked items and servings start fresh when the week changes.
  return week ? <ShoppingBody key={week} week={week} /> : <ShoppingSkeleton />;
}

type Loaded =
  | { key: string; status: 'ready'; list: ShoppingListData }
  | { key: string; status: 'error'; message: string };

function itemKey(item: ShoppingItem): string {
  return `${item.name}|${item.unit ?? ''}`;
}

function amountOf(item: ShoppingItem): string {
  if (item.quantity === null) return 'as needed';
  return [formatQuantity(item.quantity), item.unit].filter(Boolean).join(' ');
}

function ShoppingBody({ week }: { week: string }) {
  const [servings, setServings] = useState(DEFAULT_SERVINGS);
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const url = `/plan/shopping-list${query({ week, servings })}`;
  const requestKey = `${url}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api<ShoppingListData>(url, { signal: controller.signal })
      .then((list) => setLoaded({ key: requestKey, status: 'ready', list }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setLoaded({ key: requestKey, status: 'error', message });
      });
    return () => controller.abort();
  }, [url, requestKey]);

  function toggle(key: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copy(items: ShoppingItem[]) {
    const lines = items.map(
      (item) =>
        `- ${[formatQuantity(item.quantity), item.unit, item.name].filter(Boolean).join(' ')}`,
    );
    const text = [`Shopping list for the week of ${formatDayLong(week)}`, '', ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2200);
  }

  const isFresh = loaded?.key === requestKey;
  const items = loaded?.status === 'ready' ? loaded.list.items : [];
  const doneCount = items.filter((item) => checked.has(itemKey(item))).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <main className="page">
      <div className="shop-head">
        <div>
          <p className="eyebrow">Shopping list</p>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.8rem)', marginTop: 6 }}>What to buy</h1>
          <p className="lede">
            Everything your planned meals need for the week of {formatDayLong(week)}.
          </p>
        </div>
        <div className="shop-tools">
          <div className="stepper stepper--light" role="group" aria-label="Cooking for">
            <button
              type="button"
              aria-label="Cook for fewer people"
              disabled={servings <= MIN_SERVINGS}
              onClick={() => setServings((n) => Math.max(MIN_SERVINGS, n - 1))}
            >
              −
            </button>
            <output aria-live="polite" data-testid="shopping-servings">
              Cooking for {servings}
            </output>
            <button
              type="button"
              aria-label="Cook for more people"
              disabled={servings >= MAX_SERVINGS}
              onClick={() => setServings((n) => Math.min(MAX_SERVINGS, n + 1))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            data-testid="copy-list"
            disabled={items.length === 0}
            onClick={() => copy(items)}
          >
            {copyState === 'copied'
              ? 'Copied ✓'
              : copyState === 'failed'
                ? 'Copy not available'
                : 'Copy list'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Link href={`/plan?week=${week}`} className="back" style={{ marginBottom: 0 }}>
          ← Back to the planner
        </Link>
      </div>

      {loaded === null && <ShoppingSkeleton />}

      {loaded?.status === 'error' && (
        <div style={{ marginTop: 24 }}>
          <ErrorState message={loaded.message} onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      )}

      {loaded?.status === 'ready' && items.length === 0 && (
        <div style={{ marginTop: 24 }}>
          <EmptyState icon="🛒" title="Nothing to buy yet">
            <p>Plan a few meals for this week and the ingredients will gather here.</p>
            <Link className="btn btn--primary" href={`/plan?week=${week}`}>
              Open the planner
            </Link>
          </EmptyState>
        </div>
      )}

      {loaded?.status === 'ready' && items.length > 0 && (
        <section
          className="panel shop-card"
          aria-label="Items"
          style={{ opacity: isFresh ? 1 : 0.6 }}
        >
          <p className="meta" aria-live="polite">
            <span>
              {doneCount} of {items.length} picked up
            </span>
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <ul className="shop-list">
            {items.map((item) => {
              const key = itemKey(item);
              const isChecked = checked.has(key);
              return (
                <li key={key} className="shop-item" data-testid="shopping-item">
                  <label>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(key)} />
                    <span className="shop-item__text">
                      <span className="shop-item__name">{item.name}</span>
                      <span
                        className={`shop-item__qty${item.quantity === null ? ' shop-item__qty--none' : ''}`}
                      >
                        {amountOf(item)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function ShoppingSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading shopping list">
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 360, marginTop: 24 }} />
    </main>
  );
}
