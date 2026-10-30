import { useSyncExternalStore } from 'react';
import { todayIso } from './dates';

const noSubscribe = () => () => {};

// Today's UTC date, known only in the browser. Server and prerendered HTML get null, so a
// statically built page never shows a stale week and hydration does not mismatch.
export function useToday(): string | null {
  return useSyncExternalStore(noSubscribe, todayIso, () => null);
}
