import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  currentWeekMonday,
  addDays,
  formatIsoDay,
  mondayOf,
  parseIsoDay,
  Slot,
  SLOTS,
} from './dates.js';
import { DbService } from './db.service.js';
import { mergeShoppingList, PlannedMeal, ShoppingItem } from './shopping.js';

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

export interface ShoppingList {
  week: string;
  servings: number;
  items: ShoppingItem[];
}

// Accepts any date and snaps it to the Monday of its week; defaults to the current UTC week.
export function resolveWeek(value: string | undefined): string {
  if (value === undefined || value === '') return currentWeekMonday();
  const date = parseIsoDay(value);
  if (!date) throw new BadRequestException('week must be a YYYY-MM-DD date');
  return mondayOf(date);
}

function parseDay(value: string): string {
  const date = parseIsoDay(value);
  if (!date) throw new BadRequestException('day must be a YYYY-MM-DD date');
  return formatIsoDay(date);
}

function parseSlot(value: string): Slot {
  if (!(SLOTS as readonly string[]).includes(value)) {
    throw new BadRequestException(`slot must be one of ${SLOTS.join(', ')}`);
  }
  return value as Slot;
}

function weekEnd(week: string): string {
  return formatIsoDay(addDays(parseIsoDay(week)!, 7));
}

@Injectable()
export class PlanService {
  constructor(private readonly db: DbService) {}

  async week(week: string): Promise<WeekPlan> {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT to_char(p.day, 'YYYY-MM-DD') AS day, p.slot, r.id AS recipe_id, r.title, r.minutes, r.servings, r.tags
         FROM meal_plan p
         JOIN recipes r ON r.id = p.recipe_id
        WHERE p.day >= $1::date AND p.day < $2::date`,
      [week, weekEnd(week)],
    );
    const order = (slot: string) => SLOTS.indexOf(slot as Slot);
    const entries = rows
      .map((row) => ({
        day: row.day,
        slot: row.slot as Slot,
        recipeId: row.recipe_id,
        title: row.title,
        minutes: row.minutes,
        servings: row.servings,
        tags: row.tags,
      }))
      .sort((a, b) => a.day.localeCompare(b.day) || order(a.slot) - order(b.slot));
    return { week, entries };
  }

  // Planning a slot that already holds a meal replaces it.
  async set(dayInput: string, slotInput: string, recipeId: unknown): Promise<PlanEntry> {
    const day = parseDay(dayInput);
    const slot = parseSlot(slotInput);
    if (typeof recipeId !== 'number' || !Number.isInteger(recipeId)) {
      throw new BadRequestException('recipeId must be an integer');
    }

    const [recipe] = await this.db.query<{ id: number }>('SELECT id FROM recipes WHERE id = $1', [
      recipeId,
    ]);
    if (!recipe) throw new NotFoundException('recipe not found');

    await this.db.query(
      `INSERT INTO meal_plan (day, slot, recipe_id) VALUES ($1::date, $2, $3)
       ON CONFLICT (day, slot) DO UPDATE SET recipe_id = EXCLUDED.recipe_id`,
      [day, slot, recipeId],
    );

    const [entry] = (await this.week(resolveWeek(day))).entries.filter(
      (e) => e.day === day && e.slot === slot,
    );
    return entry;
  }

  async clear(dayInput: string, slotInput: string): Promise<void> {
    const day = parseDay(dayInput);
    const slot = parseSlot(slotInput);
    await this.db.query('DELETE FROM meal_plan WHERE day = $1::date AND slot = $2', [day, slot]);
  }

  // Each planned slot contributes its recipe's ingredients, scaled from the recipe's servings to `servings`.
  async shoppingList(week: string, servings: number): Promise<ShoppingList> {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT p.id AS slot_id, r.servings AS recipe_servings, i.name, i.quantity::float8 AS quantity, i.unit
         FROM meal_plan p
         JOIN recipes r ON r.id = p.recipe_id
         LEFT JOIN ingredients i ON i.recipe_id = r.id
        WHERE p.day >= $1::date AND p.day < $2::date
        ORDER BY p.id, i.id`,
      [week, weekEnd(week)],
    );

    const meals = new Map<number, PlannedMeal>();
    for (const row of rows) {
      const meal: PlannedMeal = meals.get(row.slot_id) ?? {
        recipeServings: row.recipe_servings,
        ingredients: [],
      };
      if (row.name !== null)
        meal.ingredients.push({ name: row.name, quantity: row.quantity, unit: row.unit });
      meals.set(row.slot_id, meal);
    }

    return { week, servings, items: mergeShoppingList([...meals.values()], servings) };
  }
}
