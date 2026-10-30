import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService, Queryable } from './db.service.js';
import { RecipeInput, RecipePatch } from './recipe-input.js';
import { scaleQuantity } from './shopping.js';

export interface RecipeSummary {
  id: number;
  title: string;
  description: string;
  minutes: number;
  servings: number;
  tags: string[];
  // How many of the `have` ingredients this recipe uses; null when no `have` was given.
  matchCount: number | null;
}

export interface RecipeDetail {
  id: number;
  title: string;
  description: string;
  minutes: number;
  servings: number;
  tags: string[];
  ingredients: { id: number; name: string; quantity: number | null; unit: string | null }[];
  steps: { position: number; text: string }[];
}

export interface RecipeFilters {
  q?: string;
  tag?: string;
  maxMinutes?: number;
  have?: string[];
}

// Escapes LIKE wildcards so user input is matched literally.
function likeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

@Injectable()
export class RecipesService {
  constructor(private readonly db: DbService) {}

  async list(filters: RecipeFilters): Promise<RecipeSummary[]> {
    const params: unknown[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [];

    if (filters.q) {
      const pattern = bind(likeContains(filters.q));
      where.push(`(r.title ILIKE ${pattern}
        OR r.description ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM ingredients qi WHERE qi.recipe_id = r.id AND qi.name ILIKE ${pattern}))`);
    }
    if (filters.tag) where.push(`${bind(filters.tag.toLowerCase())} = ANY (r.tags)`);
    if (filters.maxMinutes !== undefined) where.push(`r.minutes <= ${bind(filters.maxMinutes)}`);

    // Each `have` term counts once per recipe if any of the recipe's ingredients contains it.
    const have = filters.have ?? [];
    const matchCount = have.length
      ? `(SELECT count(*)::int FROM unnest(${bind(have.map(likeContains))}::text[]) AS h(pattern)
          WHERE EXISTS (SELECT 1 FROM ingredients hi WHERE hi.recipe_id = r.id AND hi.name ILIKE h.pattern))`
      : 'NULL::int';

    const rows = await this.db.query<Record<string, any>>(
      `SELECT r.id, r.title, r.description, r.minutes, r.servings, r.tags, ${matchCount} AS match_count
         FROM recipes r
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY ${have.length ? 'match_count DESC, ' : ''}r.title ASC`,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      minutes: row.minutes,
      servings: row.servings,
      tags: row.tags,
      matchCount: row.match_count,
    }));
  }

  async get(id: number, servings?: number): Promise<RecipeDetail> {
    return readRecipe(this.db, id, servings);
  }

  async create(input: RecipeInput): Promise<RecipeDetail> {
    return this.db.transaction(async (tx) => readRecipe(tx, await insertRecipe(tx, input)));
  }

  async update(id: number, patch: RecipePatch): Promise<RecipeDetail> {
    return this.db.transaction(async (tx) => {
      const exists = await tx.query<{ id: number }>(
        'SELECT id FROM recipes WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (exists.length === 0) throw new NotFoundException('recipe not found');

      const columns: Record<string, string> = {
        title: 'title',
        description: 'description',
        minutes: 'minutes',
        servings: 'servings',
        tags: 'tags',
      };
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [key, column] of Object.entries(columns)) {
        const value = patch[key as keyof RecipePatch];
        if (value === undefined) continue;
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      }
      if (sets.length) {
        values.push(id);
        await tx.query(
          `UPDATE recipes SET ${sets.join(', ')} WHERE id = $${values.length}`,
          values,
        );
      }

      if (patch.ingredients !== undefined || patch.steps !== undefined) {
        // Only the children that were sent are replaced; the others are left as they are.
        if (patch.ingredients !== undefined)
          await tx.query('DELETE FROM ingredients WHERE recipe_id = $1', [id]);
        if (patch.steps !== undefined)
          await tx.query('DELETE FROM steps WHERE recipe_id = $1', [id]);
        await replaceChildren(tx, id, patch);
      }
      return readRecipe(tx, id);
    });
  }

  async remove(id: number): Promise<void> {
    const rows = await this.db.query<{ id: number }>(
      'DELETE FROM recipes WHERE id = $1 RETURNING id',
      [id],
    );
    if (rows.length === 0) throw new NotFoundException('recipe not found');
  }
}

// Inserts a recipe with its ingredients and steps. Callers own the transaction.
export async function insertRecipe(tx: Queryable, input: RecipeInput): Promise<number> {
  const [{ id }] = await tx.query<{ id: number }>(
    `INSERT INTO recipes (title, description, minutes, servings, tags)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.title, input.description, input.minutes, input.servings, input.tags],
  );
  await replaceChildren(tx, id, input);
  return id;
}

// Inserts the ingredient and step rows that are present on `input`, using one statement each.
async function replaceChildren(tx: Queryable, recipeId: number, input: Partial<RecipeInput>) {
  if (input.ingredients?.length) {
    await tx.query(
      `INSERT INTO ingredients (recipe_id, name, quantity, unit)
       SELECT $1, t.name, t.quantity, t.unit
         FROM unnest($2::text[], $3::float8[], $4::text[]) AS t(name, quantity, unit)`,
      [
        recipeId,
        input.ingredients.map((i) => i.name),
        input.ingredients.map((i) => i.quantity),
        input.ingredients.map((i) => i.unit),
      ],
    );
  }
  if (input.steps?.length) {
    await tx.query(
      `INSERT INTO steps (recipe_id, position, text)
       SELECT $1, t.n::int, t.text FROM unnest($2::text[]) WITH ORDINALITY AS t(text, n)`,
      [recipeId, input.steps],
    );
  }
}

async function readRecipe(db: Queryable, id: number, servings?: number): Promise<RecipeDetail> {
  const [recipe] = await db.query<Record<string, any>>(
    'SELECT id, title, description, minutes, servings, tags FROM recipes WHERE id = $1',
    [id],
  );
  if (!recipe) throw new NotFoundException('recipe not found');

  const ingredients = await db.query<Record<string, any>>(
    'SELECT id, name, quantity::float8 AS quantity, unit FROM ingredients WHERE recipe_id = $1 ORDER BY id',
    [id],
  );
  const steps = await db.query<{ position: number; text: string }>(
    'SELECT position, text FROM steps WHERE recipe_id = $1 ORDER BY position',
    [id],
  );

  // Scaling only changes quantities; the stored recipe is untouched.
  const target = servings ?? recipe.servings;
  const scale = (quantity: number | null) =>
    quantity === null ? null : scaleQuantity(quantity, recipe.servings, target);

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    minutes: recipe.minutes,
    servings: target,
    tags: recipe.tags,
    ingredients: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: scale(i.quantity),
      unit: i.unit,
    })),
    steps,
  };
}
