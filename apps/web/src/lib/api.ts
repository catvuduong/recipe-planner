export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface RecipeSummary {
  id: number;
  title: string;
  description: string;
  minutes: number;
  servings: number;
  tags: string[];
  matchCount: number | null;
}

export interface Ingredient {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeDetail {
  id: number;
  title: string;
  description: string;
  minutes: number;
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: { position: number; text: string }[];
}

export type Slot = 'breakfast' | 'lunch' | 'dinner';
export const SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];

export interface PlanEntry {
  day: string;
  slot: Slot;
  recipeId: number;
  title: string;
  minutes: number;
  servings: number;
  tags: string[];
}

export interface WeekPlan {
  week: string;
  entries: PlanEntry[];
}

export interface ShoppingItem {
  name: string;
  unit: string | null;
  quantity: number | null;
}

export interface ShoppingList {
  week: string;
  servings: number;
  items: ShoppingItem[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Nest reports validation failures as { message: string | string[] }; surface the first one.
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    if (message) return message;
  } catch {
    // Not JSON; fall back to the status line below.
  }
  return `Request failed (${res.status})`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'content-type': 'application/json' } : undefined;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      ...init,
      headers: { ...headers, ...init?.headers },
    });
  } catch {
    throw new ApiError('Could not reach the recipe service', 0);
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
