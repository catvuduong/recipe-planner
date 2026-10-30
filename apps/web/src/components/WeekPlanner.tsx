'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, SLOTS, type PlanEntry, type Slot, type WeekPlan } from '@/lib/api';
import {
  formatDayLong,
  formatDayShort,
  formatWeekRange,
  mondayOf,
  shiftWeek,
  weekDays,
} from '@/lib/dates';
import { formatMinutes, recipeVisual } from '@/lib/format';
import { useToday } from '@/lib/hooks';
import { ErrorState, InlineAlert } from './ui';
import { RecipePicker } from './RecipePicker';

type Loaded =
  | { week: string; status: 'ready'; entries: PlanEntry[] }
  | { week: string; status: 'error'; message: string };

export function WeekPlanner() {
  const today = useToday();
  const [chosenWeek, setChosenWeek] = useState<string | null>(null);
  const week = chosenWeek ?? (today ? mondayOf(today) : null);

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [picking, setPicking] = useState<{ day: string; slot: Slot } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestKey = `${week}#${attempt}`;

  useEffect(() => {
    if (!week) return;
    const controller = new AbortController();
    api<WeekPlan>(`/plan?week=${week}`, { signal: controller.signal })
      .then((plan) => setLoaded({ week, status: 'ready', entries: plan.entries }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setLoaded({ week, status: 'error', message });
      });
    return () => controller.abort();
    // requestKey changes with the week and on retry.
  }, [week, requestKey]);

  // Results for a previous week are ignored, so navigating never shows the wrong meals.
  const current = loaded?.week === week ? loaded : null;
  const entries = current?.status === 'ready' ? current.entries : [];

  function setEntries(update: (current: PlanEntry[]) => PlanEntry[]) {
    setLoaded((current) =>
      current?.status === 'ready' ? { ...current, entries: update(current.entries) } : current,
    );
  }

  async function assign(day: string, slot: Slot, recipeId: number) {
    setPicking(null);
    setActionError(null);
    try {
      const saved = await api<PlanEntry>(`/plan/${day}/${slot}`, {
        method: 'PUT',
        body: JSON.stringify({ recipeId }),
      });
      setEntries((current) => [
        ...current.filter((e) => !(e.day === day && e.slot === slot)),
        saved,
      ]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save that meal');
    }
  }

  async function clear(day: string, slot: Slot) {
    setActionError(null);
    try {
      await api<void>(`/plan/${day}/${slot}`, { method: 'DELETE' });
      setEntries((current) => current.filter((e) => !(e.day === day && e.slot === slot)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove that meal');
    }
  }

  const days = week ? weekDays(week) : [];
  const pickingLabel = picking ? `${formatDayLong(picking.day)} · ${picking.slot}` : '';

  return (
    <main className="page">
      <div className="plan-head">
        <div>
          <p className="eyebrow">Weekly planner</p>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.8rem)', marginTop: 6 }}>Plan the week</h1>
          <p className="lede">
            Tap a meal slot to pick a recipe. The shopping list updates as you go.
          </p>
        </div>
        {week && (
          <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
            <div className="week-nav" aria-label="Choose week">
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setChosenWeek(shiftWeek(week, -1))}
              >
                ‹ Previous
              </button>
              <span className="week-nav__label" data-testid="week-label">
                {formatWeekRange(week)}
              </span>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setChosenWeek(shiftWeek(week, 1))}
              >
                Next ›
              </button>
              <button
                type="button"
                className="btn btn--small"
                disabled={!today || week === mondayOf(today)}
                onClick={() => setChosenWeek(null)}
              >
                This week
              </button>
            </div>
            <Link className="btn btn--primary btn--small" href={`/shopping?week=${week}`}>
              Shopping list for this week →
            </Link>
          </div>
        )}
      </div>

      {actionError && (
        <div style={{ marginTop: 20 }}>
          <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />
        </div>
      )}

      {!current ? (
        <PlannerSkeleton />
      ) : current.status === 'error' ? (
        <div style={{ marginTop: 24 }}>
          <ErrorState message={current.message} onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      ) : (
        <div className="planner" data-testid="planner">
          {days.map((day) => (
            <section
              key={day}
              className={`day${day === today ? ' day--today' : ''}`}
              aria-label={formatDayLong(day)}
            >
              <header className="day__head">
                <span>{formatDayShort(day)}</span>
                {day === today && <small>Today</small>}
              </header>
              {SLOTS.map((slot) => {
                const entry = entries.find((e) => e.day === day && e.slot === slot);
                return entry ? (
                  <FilledSlot
                    key={slot}
                    day={day}
                    slot={slot}
                    entry={entry}
                    onChange={() => setPicking({ day, slot })}
                    onClear={() => clear(day, slot)}
                  />
                ) : (
                  <button
                    key={slot}
                    type="button"
                    className="slot"
                    data-testid={`plan-slot-${day}-${slot}`}
                    aria-label={`Add ${slot} on ${formatDayLong(day)}`}
                    onClick={() => setPicking({ day, slot })}
                  >
                    <span className="slot__empty">+ {slot}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {picking && (
        <RecipePicker
          heading={pickingLabel}
          onClose={() => setPicking(null)}
          onPick={(recipeId) => assign(picking.day, picking.slot, recipeId)}
        />
      )}
    </main>
  );
}

function FilledSlot({
  day,
  slot,
  entry,
  onChange,
  onClear,
}: {
  day: string;
  slot: Slot;
  entry: PlanEntry;
  onChange: () => void;
  onClear: () => void;
}) {
  const visual = recipeVisual({ id: entry.recipeId, tags: entry.tags });
  return (
    <div className="slot slot--filled" data-testid={`plan-slot-${day}-${slot}`}>
      <button
        type="button"
        className="slot__main"
        onClick={onChange}
        aria-label={`Change ${slot}: ${entry.title}`}
      >
        <span className="slot__label">{slot}</span>
        <span className="slot__title">
          <span className="slot-thumb" style={{ background: visual.background }} aria-hidden="true">
            {visual.emoji}
          </span>
          {entry.title}
        </span>
        <span className="slot__meta">⏱ {formatMinutes(entry.minutes)}</span>
      </button>
      <button
        type="button"
        className="slot__remove"
        aria-label={`Remove ${entry.title}`}
        onClick={onClear}
      >
        ×
      </button>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div
      className="planner"
      aria-busy="true"
      aria-label="Loading planner"
      style={{ marginTop: 24 }}
    >
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 300 }} />
      ))}
    </div>
  );
}
