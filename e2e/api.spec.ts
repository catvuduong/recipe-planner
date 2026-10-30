import { test, expect, APIRequestContext } from '@playwright/test';

// Exercises the HTTP API directly. Each run uses a random token so its data never collides with
// the seeded recipes or with earlier runs, and the weeks used here are far in the future.
const API = 'http://localhost:3001';
const run = Math.random().toString(36).slice(2, 8);
const PLAN_WEEK = '2099-06-01';
const SHOP_WEEK = '2099-07-06';
const DAYS = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(`${PLAN_WEEK}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + i);
  return date.toISOString().slice(0, 10);
});

type Recipe = { id: number; title: string; servings: number; ingredients: { name: string; quantity: number | null; unit: string | null }[] };

async function createRecipe(request: APIRequestContext, body: Record<string, unknown>) {
  const res = await request.post(`${API}/recipes`, { data: body });
  expect(res.status()).toBe(201);
  return (await res.json()) as Recipe;
}

async function deleteRecipe(request: APIRequestContext, id: number) {
  await request.delete(`${API}/recipes/${id}`);
}

async function clearWeek(request: APIRequestContext, monday: string) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${monday}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return date.toISOString().slice(0, 10);
  });
  for (const day of days) {
    for (const slot of ['breakfast', 'lunch', 'dinner']) {
      await request.delete(`${API}/plan/${day}/${slot}`);
    }
  }
}

const created: number[] = [];

test.afterAll(async ({ request }) => {
  for (const id of created) await deleteRecipe(request, id);
});

test.describe('recipe filters', () => {
  test('filters by text, tag and maximum minutes', async ({ request }) => {
    const quick = await createRecipe(request, {
      title: `Quick zq${run}`,
      minutes: 10,
      servings: 2,
      tags: [`tag${run}`],
      ingredients: [{ name: `saffron${run}`, quantity: 1, unit: 'g' }],
      steps: ['Stir.'],
    });
    const slow = await createRecipe(request, {
      title: `Slow zq${run}`,
      minutes: 90,
      servings: 2,
      tags: [`tag${run}`],
      ingredients: [{ name: 'water', quantity: 1, unit: 'l' }],
      steps: ['Wait.'],
    });
    created.push(quick.id, slow.id);

    const byTag = await (await request.get(`${API}/recipes?tag=tag${run}`)).json();
    expect(byTag.map((r: Recipe) => r.id).sort()).toEqual([quick.id, slow.id].sort());

    const underThirty = await (await request.get(`${API}/recipes?tag=tag${run}&maxMinutes=30`)).json();
    expect(underThirty.map((r: Recipe) => r.id)).toEqual([quick.id]);

    const byTitle = await (await request.get(`${API}/recipes?q=zq${run}`)).json();
    expect(byTitle).toHaveLength(2);

    // Text search also looks at ingredients, so the saffron recipe is the only match.
    const byIngredient = await (await request.get(`${API}/recipes?q=saffron${run}`)).json();
    expect(byIngredient.map((r: Recipe) => r.id)).toEqual([quick.id]);

    // LIKE wildcards in user input are matched literally, so a lone % finds nothing.
    const percent = await (await request.get(`${API}/recipes?q=%25`)).json();
    expect(percent).toEqual([]);
  });

  test('rejects malformed filter parameters', async ({ request }) => {
    expect((await request.get(`${API}/recipes?maxMinutes=soon`)).status()).toBe(400);
    expect((await request.get(`${API}/recipes?q=a&q=b`)).status()).toBe(400);
  });
});

test.describe('ingredients on hand', () => {
  test('ranks recipes by how many of the have= ingredients they use', async ({ request }) => {
    const tag = `have${run}`;
    const both = await createRecipe(request, {
      title: `Both ${run}`,
      minutes: 20,
      servings: 2,
      tags: [tag],
      ingredients: [
        { name: `ha${run}`, quantity: 1, unit: null },
        { name: `hb${run}`, quantity: 1, unit: null },
      ],
    });
    const one = await createRecipe(request, {
      title: `One ${run}`,
      minutes: 20,
      servings: 2,
      tags: [tag],
      ingredients: [{ name: `ha${run}`, quantity: 1, unit: null }],
    });
    const none = await createRecipe(request, {
      title: `None ${run}`,
      minutes: 20,
      servings: 2,
      tags: [tag],
      ingredients: [{ name: 'unrelated', quantity: 1, unit: null }],
    });
    created.push(both.id, one.id, none.id);

    const res = await request.get(`${API}/recipes?tag=${tag}&have=HA${run}, hb${run} ,,`);
    expect(res.status()).toBe(200);
    const ranked = (await res.json()) as { id: number; matchCount: number }[];
    expect(ranked.map((r) => [r.id, r.matchCount])).toEqual([
      [both.id, 2],
      [one.id, 1],
      [none.id, 0],
    ]);
  });
});

test.describe('recipe detail and editing', () => {
  test('scales quantities to the requested servings without changing the stored recipe', async ({ request }) => {
    const recipe = await createRecipe(request, {
      title: `Scale ${run}`,
      minutes: 15,
      servings: 4,
      ingredients: [{ name: `flour${run}`, quantity: 200, unit: 'g' }],
    });
    created.push(recipe.id);

    const scaled = await (await request.get(`${API}/recipes/${recipe.id}?servings=2`)).json();
    expect(scaled.servings).toBe(2);
    expect(scaled.ingredients[0].quantity).toBe(100);

    const stored = await (await request.get(`${API}/recipes/${recipe.id}`)).json();
    expect(stored.servings).toBe(4);
    expect(stored.ingredients[0].quantity).toBe(200);
  });

  test('creates with nested ingredients and steps, patches children, and deletes', async ({ request }) => {
    const recipe = await createRecipe(request, {
      title: `Nested ${run}`,
      description: 'Created in one transaction.',
      minutes: 30,
      servings: 2,
      tags: ['Dinner', 'dinner'],
      ingredients: [{ name: `rice${run}`, quantity: 1.5, unit: 'cup' }],
      steps: ['Rinse.', 'Cook.'],
    });
    created.push(recipe.id);
    expect(recipe).toMatchObject({ title: `Nested ${run}`, tags: ['dinner'] });

    const patched = await (
      await request.patch(`${API}/recipes/${recipe.id}`, { data: { minutes: 45, steps: ['Only step.'] } })
    ).json();
    expect(patched.minutes).toBe(45);
    expect(patched.steps.map((s: { text: string }) => s.text)).toEqual(['Only step.']);
    expect(patched.ingredients).toHaveLength(1);

    expect((await request.delete(`${API}/recipes/${recipe.id}`)).status()).toBe(204);
    expect((await request.get(`${API}/recipes/${recipe.id}`)).status()).toBe(404);
    created.splice(created.indexOf(recipe.id), 1);
  });

  test('rejects an invalid recipe body with 400', async ({ request }) => {
    const res = await request.post(`${API}/recipes`, { data: { minutes: 10, servings: 2 } });
    expect(res.status()).toBe(400);
  });
});

test.describe('seed data', () => {
  test('seeds every recipe once and fills the current week', async ({ request }) => {
    // Each boot runs the seeder again, so duplicates here would mean it is not idempotent.
    const recipes = (await (await request.get(`${API}/recipes`)).json()) as Recipe[];
    const titles = recipes.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toContain('Spaghetti alla Carbonara');

    const plan = await (await request.get(`${API}/plan`)).json();
    expect(plan.entries).toHaveLength(21);
  });
});

test.describe('weekly plan', () => {
  test('planning a slot twice replaces the meal', async ({ request }) => {
    await clearWeek(request, PLAN_WEEK);
    const first = await createRecipe(request, { title: `First ${run}`, minutes: 5, servings: 1 });
    const second = await createRecipe(request, { title: `Second ${run}`, minutes: 5, servings: 1 });
    created.push(first.id, second.id);

    const day = DAYS[2];
    expect((await request.put(`${API}/plan/${day}/dinner`, { data: { recipeId: first.id } })).status()).toBe(200);
    const replaced = await request.put(`${API}/plan/${day}/dinner`, { data: { recipeId: second.id } });
    expect(replaced.status()).toBe(200);
    expect(await replaced.json()).toMatchObject({ day, slot: 'dinner', recipeId: second.id });

    const plan = await (await request.get(`${API}/plan?week=${PLAN_WEEK}`)).json();
    const dinners = plan.entries.filter((e: { day: string; slot: string }) => e.day === day && e.slot === 'dinner');
    expect(dinners).toHaveLength(1);
    expect(dinners[0].recipeId).toBe(second.id);

    await clearWeek(request, PLAN_WEEK);
  });

  test('rejects an unknown slot and an unknown recipe', async ({ request }) => {
    expect((await request.put(`${API}/plan/${DAYS[0]}/supper`, { data: { recipeId: 1 } })).status()).toBe(400);
    expect((await request.put(`${API}/plan/${DAYS[0]}/dinner`, { data: { recipeId: 2147483000 } })).status()).toBe(404);
  });

  test('snaps any date to the Monday of its week', async ({ request }) => {
    const plan = await (await request.get(`${API}/plan?week=${DAYS[4]}`)).json();
    expect(plan.week).toBe(PLAN_WEEK);
  });

  test('shopping list merges and scales the planned ingredients', async ({ request }) => {
    await clearWeek(request, SHOP_WEEK);
    const tag = `shop${run}`;
    // 200 g flour and 2 eggs for 2 servings; 100 g flour and 1 egg written for 4 servings.
    const cake = await createRecipe(request, {
      title: `Cake ${run}`,
      minutes: 40,
      servings: 2,
      tags: [tag],
      ingredients: [
        { name: 'Flour', quantity: 200, unit: 'g' },
        { name: 'eggs', quantity: 2, unit: null },
      ],
    });
    const bread = await createRecipe(request, {
      title: `Bread ${run}`,
      minutes: 40,
      servings: 4,
      tags: [tag],
      ingredients: [
        { name: 'flour', quantity: 100, unit: 'G' },
        { name: 'eggs', quantity: 1, unit: null },
      ],
    });
    created.push(cake.id, bread.id);

    await request.put(`${API}/plan/2099-07-06/dinner`, { data: { recipeId: cake.id } });
    await request.put(`${API}/plan/2099-07-07/dinner`, { data: { recipeId: bread.id } });

    // Two servings: flour 200 + 100×2/4 = 250 g; eggs 2 + 1×2/4 = 2.5.
    const forTwo = await (await request.get(`${API}/plan/shopping-list?week=${SHOP_WEEK}&servings=2`)).json();
    const flour = forTwo.items.find((i: { name: string }) => i.name === 'flour');
    const eggs = forTwo.items.find((i: { name: string }) => i.name === 'eggs');
    expect(flour).toEqual({ name: 'flour', unit: 'g', quantity: 250 });
    expect(eggs).toEqual({ name: 'eggs', unit: null, quantity: 2.5 });

    // Four servings doubles the cake and keeps the bread as written: flour 400 + 100 = 500 g.
    const forFour = await (await request.get(`${API}/plan/shopping-list?week=${SHOP_WEEK}&servings=4`)).json();
    expect(forFour.items.find((i: { name: string }) => i.name === 'flour').quantity).toBe(500);
    expect(forFour.servings).toBe(4);

    await clearWeek(request, SHOP_WEEK);
  });
});
