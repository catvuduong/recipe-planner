import { BadRequestException } from '@nestjs/common';
import type { Ingredient } from './shopping.js';

export interface RecipeInput {
  title: string;
  description: string;
  minutes: number;
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
}

export type RecipePatch = Partial<RecipeInput>;

const MAX_TITLE = 200;

function fail(message: string): never {
  throw new BadRequestException(message);
}

function requireText(value: unknown, field: string, max = MAX_TITLE): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${field} is required`);
  const text = value.trim();
  if (text.length > max) fail(`${field} must be at most ${max} characters`);
  return text;
}

function requireWhole(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    fail(`${field} must be an integer >= ${min}`);
  }
  return value;
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
    fail('tags must be an array of strings');
  }
  const tags = value.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== '');
  return [...new Set(tags)];
}

function parseIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) fail('ingredients must be an array');
  return value.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) fail(`ingredients[${index}] must be an object`);
    const { name, quantity, unit } = raw as Record<string, unknown>;
    if (
      quantity !== undefined &&
      quantity !== null &&
      (typeof quantity !== 'number' || quantity < 0)
    ) {
      fail(`ingredients[${index}].quantity must be a number >= 0`);
    }
    if (unit !== undefined && unit !== null && typeof unit !== 'string') {
      fail(`ingredients[${index}].unit must be a string`);
    }
    const trimmedUnit = typeof unit === 'string' ? unit.trim() : '';
    return {
      name: requireText(name, `ingredients[${index}].name`, 120),
      quantity: typeof quantity === 'number' ? quantity : null,
      unit: trimmedUnit === '' ? null : trimmedUnit,
    };
  });
}

function parseSteps(value: unknown): string[] {
  if (!Array.isArray(value)) fail('steps must be an array');
  return value.map((step, index) => requireText(step, `steps[${index}]`, 1000));
}

// Create needs title, minutes and servings; ingredients, steps, tags and description default to empty.
export function parseRecipeCreate(body: unknown): RecipeInput {
  return parseRecipe(body, false) as RecipeInput;
}

// A patch takes any subset of the fields; ingredients or steps, when sent, replace the existing ones.
export function parseRecipePatch(body: unknown): RecipePatch {
  return parseRecipe(body, true);
}

function parseRecipe(body: unknown, partial: boolean): RecipePatch {
  if (typeof body !== 'object' || body === null) fail('body must be a JSON object');
  const raw = body as Record<string, unknown>;
  const out: RecipePatch = {};

  if (!partial || raw.title !== undefined) out.title = requireText(raw.title, 'title');
  if (raw.description !== undefined) {
    if (typeof raw.description !== 'string') fail('description must be a string');
    out.description = raw.description.trim();
  } else if (!partial) {
    out.description = '';
  }
  if (!partial || raw.minutes !== undefined) out.minutes = requireWhole(raw.minutes, 'minutes', 0);
  if (!partial || raw.servings !== undefined)
    out.servings = requireWhole(raw.servings, 'servings', 1);
  if (raw.tags !== undefined) out.tags = parseTags(raw.tags);
  else if (!partial) out.tags = [];
  if (raw.ingredients !== undefined) out.ingredients = parseIngredients(raw.ingredients);
  else if (!partial) out.ingredients = [];
  if (raw.steps !== undefined) out.steps = parseSteps(raw.steps);
  else if (!partial) out.steps = [];

  return out;
}

// A single optional text query parameter. Repeated parameters arrive as arrays and are refused.
export function parseText(value: unknown, field: string, max = 100): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(`${field} must be a single value`);
  const text = value.trim();
  if (text.length > max) fail(`${field} must be at most ${max} characters`);
  return text || undefined;
}

// Comma-separated list such as `egg,rice`: trimmed, lowercased, de-duplicated, empties dropped.
export function parseCsv(value: unknown, field: string, max = 20): string[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') fail(`${field} must be a comma-separated string`);
  const items = [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (items.length > max) fail(`${field} accepts at most ${max} values`);
  return items;
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1)
    fail('id must be a positive integer');
  return id;
}

export function parseOptionalWhole(value: unknown, field: string, min: number): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < min) fail(`${field} must be an integer >= ${min}`);
  return n;
}
