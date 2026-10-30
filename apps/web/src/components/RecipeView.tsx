'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, query, type RecipeDetail } from '@/lib/api';
import { formatMinutes, formatQuantity, recipeVisual } from '@/lib/format';
import { EmptyState, ErrorState } from './ui';

type Result =
  | { key: string; status: 'ready'; recipe: RecipeDetail }
  | { key: string; status: 'error'; message: string; notFound: boolean };

export function RecipeView({ id }: { id: string }) {
  // Undefined means "the recipe's own servings"; any other value asks the API to scale the quantities.
  const [requested, setRequested] = useState<number | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const url = `/recipes/${encodeURIComponent(id)}${query({ servings: requested })}`;
  const requestKey = `${url}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    api<RecipeDetail>(url, { signal: controller.signal })
      .then((recipe) => setResult({ key: requestKey, status: 'ready', recipe }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const notFound = err instanceof ApiError && err.status === 404;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setResult({ key: requestKey, status: 'error', message, notFound });
      });
    return () => controller.abort();
  }, [url, requestKey]);

  if (result === null) return <DetailSkeleton />;

  if (result.status === 'error') {
    return (
      <main className="page">
        <BackLink />
        {result.notFound ? (
          <EmptyState icon="🤷" title="We couldn't find that recipe">
            <Link className="btn btn--primary" href="/">
              Back to the recipe book
            </Link>
          </EmptyState>
        ) : (
          <ErrorState message={result.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}
      </main>
    );
  }

  const { recipe } = result;
  const visual = recipeVisual(recipe);
  const isFresh = result.key === requestKey;
  const servings = recipe.servings;

  return (
    <main className="page">
      <BackLink />

      <section className="detail-hero" style={{ background: visual.background }}>
        <span className="emoji" aria-hidden="true">
          {visual.emoji}
        </span>
        <div>
          <h1>{recipe.title}</h1>
          {recipe.description && <p style={{ marginTop: 10 }}>{recipe.description}</p>}
        </div>
        <div className="meta">
          <span>⏱ {formatMinutes(recipe.minutes)}</span>
          {recipe.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <div className="stepper" role="group" aria-label="Servings">
          <button
            type="button"
            aria-label="Use fewer servings"
            disabled={servings <= 1}
            onClick={() => setRequested(servings - 1)}
          >
            −
          </button>
          <output aria-live="polite" data-testid="servings-value">
            Serves {servings}
          </output>
          <button
            type="button"
            aria-label="Use more servings"
            onClick={() => setRequested(servings + 1)}
          >
            +
          </button>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel detail-section" aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading">Ingredients</h2>
          <ul className="ingredients" data-loading={!isFresh} aria-busy={!isFresh}>
            {recipe.ingredients.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                {item.quantity === null ? (
                  <span className="muted">to taste</span>
                ) : (
                  <strong>{`${formatQuantity(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`}</strong>
                )}
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 14 }}>
            Quantities scale with the servings control.
          </p>
        </section>

        <section className="panel detail-section" aria-labelledby="method-heading">
          <h2 id="method-heading">Method</h2>
          <ol className="steps">
            {recipe.steps.map((step) => (
              <li key={step.position}>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 24 }}>
            <Link className="btn btn--primary" href="/plan">
              Plan a meal with this →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/" className="back">
      ← All recipes
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading recipe">
      <BackLink />
      <div className="skeleton" style={{ height: 240 }} />
      <div className="detail-grid">
        <div className="skeleton" style={{ height: 320 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    </main>
  );
}
