'use client';

import { useEffect, useState } from 'react';
import { api, query, type RecipeSummary } from '@/lib/api';
import { formatMinutes, recipeVisual } from '@/lib/format';
import { ErrorState } from './ui';

type Result =
  | { key: string; status: 'ready'; recipes: RecipeSummary[] }
  | { key: string; status: 'error'; message: string };

export function RecipePicker({
  heading,
  onClose,
  onPick,
}: {
  heading: string;
  onClose: () => void;
  onPick: (recipeId: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const url = `/recipes${query({ q: debounced || undefined })}`;
  const requestKey = `${url}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api<RecipeSummary[]>(url, { signal: controller.signal })
      .then((recipes) => setResult({ key: requestKey, status: 'ready', recipes }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setResult({ key: requestKey, status: 'error', message });
      });
    return () => controller.abort();
  }, [url, requestKey]);

  const isFresh = result?.key === requestKey;

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div
        className="picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        data-testid="recipe-picker"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="picker__head">
          <div>
            <p className="eyebrow">Add to plan</p>
            <h2 id="picker-title" style={{ fontSize: '1.4rem', marginTop: 4 }}>
              {heading}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <input
          data-testid="picker-search"
          className="field"
          type="search"
          autoFocus
          placeholder="Search recipes or ingredients…"
          aria-label="Search recipes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {result?.status === 'error' ? (
          <ErrorState message={result.message} onRetry={() => setAttempt((n) => n + 1)} />
        ) : result?.status === 'ready' && result.recipes.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
            No recipes match “{debounced}”.
          </p>
        ) : result === null ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
            Loading recipes…
          </p>
        ) : (
          <ul className="picker__list" style={{ opacity: isFresh ? 1 : 0.6 }}>
            {result.recipes.map((recipe) => {
              const visual = recipeVisual(recipe);
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    className="picker__option"
                    data-testid="picker-option"
                    onClick={() => onPick(recipe.id)}
                  >
                    <span
                      className="picker__emoji"
                      style={{ background: visual.background }}
                      aria-hidden="true"
                    >
                      {visual.emoji}
                    </span>
                    <span style={{ display: 'grid', minWidth: 0 }}>
                      <strong>{recipe.title}</strong>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        ⏱ {formatMinutes(recipe.minutes)} · serves {recipe.servings}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
