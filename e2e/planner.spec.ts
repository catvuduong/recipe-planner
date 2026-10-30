import { test, expect } from '@playwright/test';

const API = 'http://localhost:3001';
const run = Math.random().toString(36).slice(2, 8);

// The planner always shows the current UTC week, so the flow below works on that week.
function currentMonday(): string {
  const date = new Date();
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

function dayOffset(monday: string, offset: number): string {
  const date = new Date(`${monday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const MONDAY = currentMonday();
const THURSDAY = dayOffset(MONDAY, 3);
const TITLE = `Buckwheat pancakes ${run}`;

let recipeId: number;
let originalLunchRecipeId: number | null = null;

test.beforeAll(async ({ request }) => {
  const created = await request.post(`${API}/recipes`, {
    data: {
      title: TITLE,
      minutes: 15,
      servings: 2,
      tags: ['breakfast'],
      ingredients: [{ name: `buckwheat ${run}`, quantity: 100, unit: 'g' }],
      steps: ['Whisk and fry.'],
    },
  });
  recipeId = (await created.json()).id;

  // Remember what the lunch slot held, so the seeded week can be put back afterwards.
  const plan = await (await request.get(`${API}/plan?week=${MONDAY}`)).json();
  const lunch = plan.entries.find((e: { day: string; slot: string }) => e.day === THURSDAY && e.slot === 'lunch');
  originalLunchRecipeId = lunch?.recipeId ?? null;
});

test.afterAll(async ({ request }) => {
  if (originalLunchRecipeId !== null) {
    await request.put(`${API}/plan/${THURSDAY}/lunch`, { data: { recipeId: originalLunchRecipeId } });
  } else {
    await request.delete(`${API}/plan/${THURSDAY}/lunch`);
  }
  await request.delete(`${API}/recipes/${recipeId}`);
});

test('searching the recipe book finds a recipe', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('search-input').fill('carbonara');

  const cards = page.getByTestId('recipe-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Spaghetti alla Carbonara');
});

test('the fridge input ranks recipes by what you already have', async ({ page }) => {
  await page.goto('/');
  const fridge = page.getByTestId('fridge-input');
  await fridge.fill('rice');
  await fridge.press('Enter');

  const first = page.getByTestId('recipe-card').first();
  await expect(first).toContainText('Egg Fried Rice');
  await expect(first).toContainText('Uses 1 of yours');
});

test('scaling a recipe on its detail page updates the quantities', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('recipe-card').filter({ hasText: 'Shakshuka' }).click();

  await expect(page.getByTestId('servings-value')).toHaveText('Serves 2');
  await page.getByRole('button', { name: 'Use more servings' }).click();

  await expect(page.getByTestId('servings-value')).toHaveText('Serves 3');
  await expect(page.locator('.ingredients')).toContainText('600 g');
});

test('a recipe added to a planner slot shows up on the shopping list', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('search-input').fill(run);
  await expect(page.getByTestId('recipe-card')).toHaveCount(1);
  await expect(page.getByTestId('recipe-card')).toContainText(TITLE);

  await page.goto('/plan');
  const slot = page.getByTestId(`plan-slot-${THURSDAY}-lunch`);
  await expect(slot).toBeVisible();
  await slot.click();

  const picker = page.getByTestId('recipe-picker');
  await expect(picker).toBeVisible();
  await picker.getByTestId('picker-search').fill(run);
  await expect(picker.getByTestId('picker-option')).toHaveCount(1);
  await picker.getByTestId('picker-option').click();
  await expect(slot).toContainText(TITLE);

  await page.goto('/shopping');
  const item = page.getByTestId('shopping-item').filter({ hasText: `buckwheat ${run}` });
  await expect(item).toBeVisible();
  await expect(item).toContainText('100 g');

  await item.locator('input').check();
  await expect(item.locator('input')).toBeChecked();
});
