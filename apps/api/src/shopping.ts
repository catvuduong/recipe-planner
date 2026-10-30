export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

// One planned meal: the recipe's ingredients as written, and the servings they are written for.
export interface PlannedMeal {
  recipeServings: number;
  ingredients: Ingredient[];
}

export interface ShoppingItem {
  name: string;
  unit: string | null;
  quantity: number | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

// Quantities are stored for the recipe's own servings; this rescales them for another count.
export function scaleQuantity(quantity: number, fromServings: number, toServings: number): number {
  if (fromServings <= 0) throw new Error('fromServings must be positive');
  return round((quantity * toServings) / fromServings);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeUnit(unit: string | null): string | null {
  const trimmed = unit?.trim().toLowerCase() ?? '';
  return trimmed === '' ? null : trimmed;
}

// Merges the ingredients of every planned meal by (name, unit), summing quantities that have one.
// Scaling is relative to `servings`, the number of people the shopping list is for.
export function mergeShoppingList(meals: PlannedMeal[], servings: number): ShoppingItem[] {
  const merged = new Map<string, ShoppingItem>();

  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      const name = normalizeName(ingredient.name);
      const unit = normalizeUnit(ingredient.unit);
      const key = `${name}\u0000${unit ?? ''}`;
      const item = merged.get(key) ?? { name, unit, quantity: null };

      if (ingredient.quantity !== null) {
        const scaled = scaleQuantity(ingredient.quantity, meal.recipeServings, servings);
        item.quantity = round((item.quantity ?? 0) + scaled);
      }
      merged.set(key, item);
    }
  }

  return [...merged.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || (a.unit ?? '').localeCompare(b.unit ?? ''),
  );
}
