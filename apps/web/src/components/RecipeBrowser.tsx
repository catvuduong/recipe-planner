'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { api, query, type RecipeSummary } from '@/lib/api';
import { EmptyState, ErrorState } from './ui';
import { RecipeCard } from './RecipeCard';

const QUICK_MINUTES = 30;
const FRIDGE_IDEAS = ['egg', 'rice', 'chickpeas', 'feta', 'garlic', 'lemon'];

type Result =
  | { key: string; status: 'ready'; recipes: RecipeSummary[] }
  | { key: string; status: 'error'; message: string };

export function RecipeBrowser() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const [fridge, setFridge] = useState<string[]>([]);
  const [fridgeDraft, setFridgeDraft] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // The tag chips come from the whole catalogue, so they do not shrink as filters narrow the grid.
  useEffect(() => {
    const controller = new AbortController();
    api<RecipeSummary[]>('/recipes', { signal: controller.signal })
      .then((recipes) => setAllTags([...new Set(recipes.flatMap((r) => r.tags))].sort()))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const filterKey = query({
    q: debouncedSearch || undefined,
    tag: tag ?? undefined,
    maxMinutes: quick ? QUICK_MINUTES : undefined,
    have: fridge.length ? fridge.join(',') : undefined,
  });
  const requestKey = `${filterKey}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api<RecipeSummary[]>(`/recipes${filterKey}`, { signal: controller.signal })
      .then((recipes) => setResult({ key: requestKey, status: 'ready', recipes }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setResult({ key: requestKey, status: 'error', message });
      });
    return () => controller.abort();
  }, [filterKey, requestKey]);

  const isFresh = result?.key === requestKey;
  const hasFilters = !!(debouncedSearch || tag || quick || fridge.length);

  function addFridgeItem(raw: string) {
    const item = raw.trim().toLowerCase();
    if (item && !fridge.includes(item)) setFridge([...fridge, item]);
    setFridgeDraft('');
  }

  function onFridgeKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addFridgeItem(fridgeDraft);
    } else if (event.key === 'Backspace' && !fridgeDraft && fridge.length) {
      setFridge(fridge.slice(0, -1));
    }
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setTag(null);
    setQuick(false);
    setFridge([]);
  }

  return (
    <main className="page">
      <section>
        <p className="eyebrow">Your recipe book</p>
        <h1 style={{ fontSize: 'clamp(2.1rem, 5vw, 3.2rem)', marginTop: 6 }}>
          What&apos;s cooking this week?
        </h1>
        <p className="lede">
          Search the book, filter by what you have, then plan the meals straight onto the calendar.
        </p>
      </section>

      <div className="toolbar">
        <div className="toolbar__main">
          <div className="toolbar__row">
            <div className="search">
              <span className="search__icon" aria-hidden="true">
                🔍
              </span>
              <input
                data-testid="search-input"
                className="field"
                type="search"
                placeholder="Search recipes or ingredients…"
                aria-label="Search recipes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="chip"
              aria-pressed={quick}
              onClick={() => setQuick((value) => !value)}
            >
              ⏱ Under {QUICK_MINUTES} min
            </button>
            {hasFilters && (
              <button type="button" className="btn btn--ghost btn--small" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          <div className="chip-row chip-row--tags" role="group" aria-label="Filter by tag">
            <button
              type="button"
              className="chip"
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
            >
              All
            </button>
            {allTags.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={tag === name}
                onClick={() => setTag(tag === name ? null : name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <section className="fridge" aria-labelledby="fridge-title">
          <div className="fridge__title" id="fridge-title">
            <span>🧊 What&apos;s in my fridge?</span>
            <small>Recipes using the most of what you have come first.</small>
          </div>
          {fridge.length > 0 && (
            <div className="chip-row">
              {fridge.map((item) => (
                <span key={item} className="chip chip--fridge">
                  {item}
                  <button
                    type="button"
                    className="chip__remove"
                    aria-label={`Remove ${item}`}
                    onClick={() => setFridge(fridge.filter((i) => i !== item))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            data-testid="fridge-input"
            className="field"
            placeholder="Add an ingredient and press Enter, e.g. egg"
            aria-label="Add an ingredient you have"
            value={fridgeDraft}
            onChange={(e) => setFridgeDraft(e.target.value)}
            onKeyDown={onFridgeKey}
            onBlur={() => fridgeDraft.trim() && addFridgeItem(fridgeDraft)}
          />
          <div className="chip-row">
            {FRIDGE_IDEAS.filter((idea) => !fridge.includes(idea)).map((idea) => (
              <button key={idea} type="button" className="chip" onClick={() => addFridgeItem(idea)}>
                + {idea}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="results-head">
        <h2>{resultsHeading(result, isFresh, fridge.length > 0)}</h2>
      </div>

      {result === null && <SkeletonGrid />}

      {result?.status === 'error' && (
        <ErrorState message={result.message} onRetry={() => setAttempt((n) => n + 1)} />
      )}

      {result?.status === 'ready' && result.recipes.length === 0 && (
        <EmptyState icon="🥄" title="No recipes match those filters">
          <p>Try a shorter search, another tag, or clear the fridge list.</p>
          <button type="button" className="btn btn--primary" onClick={clearFilters}>
            Show every recipe
          </button>
        </EmptyState>
      )}

      {result?.status === 'ready' && result.recipes.length > 0 && (
        <ul
          className="grid"
          style={{ opacity: isFresh ? 1 : 0.55, transition: 'opacity 0.15s ease' }}
          data-testid="recipe-grid"
        >
          {result.recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      )}
    </main>
  );
}

function resultsHeading(result: Result | null, isFresh: boolean, ranked: boolean): string {
  if (result === null || result.status === 'error') return 'Recipes';
  const count = result.recipes.length;
  const noun = count === 1 ? 'recipe' : 'recipes';
  const suffix = ranked && isFresh ? ' · ranked by your fridge' : '';
  return `${count} ${noun}${suffix}`;
}

function SkeletonGrid() {
  return (
    <ul className="grid" aria-label="Loading recipes" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="skeleton skeleton-card" />
      ))}
    </ul>
  );
}
