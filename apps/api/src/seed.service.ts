import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { currentWeekMonday, SLOTS, weekDays } from './dates.js';
import { DbService, Queryable } from './db.service.js';
import { insertRecipe } from './recipes.service.js';
import { SEED_RECIPES, SEED_WEEK } from './seed-data.js';

const SEED_LOCK = 727275;

// Idempotent: recipes are added by title, and the current week is only filled when it has no plan at all.
export async function seedDatabase(db: DbService, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx: Queryable) => {
    // Several instances may boot at once (serverless cold starts), so serialize the seed.
    await tx.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK]);

    const recipeIds = new Map<string, number>();
    for (const recipe of SEED_RECIPES) {
      const existing = await tx.query<{ id: number }>('SELECT id FROM recipes WHERE title = $1', [
        recipe.title,
      ]);
      recipeIds.set(recipe.title, existing[0]?.id ?? (await insertRecipe(tx, recipe)));
    }

    const days = weekDays(currentWeekMonday(now));
    const [{ planned }] = await tx.query<{ planned: number }>(
      'SELECT count(*)::int AS planned FROM meal_plan WHERE day >= $1::date AND day <= $2::date',
      [days[0], days[6]],
    );
    if (planned > 0) return;

    for (const slot of SLOTS) {
      for (const [index, title] of SEED_WEEK[slot].entries()) {
        const recipeId = recipeIds.get(title);
        if (recipeId === undefined) throw new Error(`seed plan refers to unknown recipe: ${title}`);
        await tx.query('INSERT INTO meal_plan (day, slot, recipe_id) VALUES ($1::date, $2, $3)', [
          days[index],
          slot,
          recipeId,
        ]);
      }
    }
  });
}

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly db: DbService) {}

  async onApplicationBootstrap() {
    if (!this.db.enabled) return;
    try {
      await seedDatabase(this.db);
    } catch (err) {
      // A failed seed should not stop the API from serving the data that is already there.
      this.logger.error('seeding failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
