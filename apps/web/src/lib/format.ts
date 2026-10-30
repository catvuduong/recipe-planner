import type { Ingredient, ShoppingItem } from './api';

const FRACTIONS: [number, string][] = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

// Cooks read 1½ cups more easily than 1.5, so common fractions get their glyphs.
export function formatQuantity(quantity: number | null): string {
  if (quantity === null) return '';
  const whole = Math.floor(quantity);
  const fraction = quantity - whole;
  const match = FRACTIONS.find(([value]) => Math.abs(fraction - value) < 0.02);
  if (match) return whole ? `${whole}${match[1]}` : match[1];
  return String(Number(quantity.toFixed(2)));
}

export function formatIngredient(item: Ingredient | ShoppingItem): string {
  return [formatQuantity(item.quantity), item.unit, item.name].filter(Boolean).join(' ');
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

const PALETTES = [
  'linear-gradient(135deg, #f7a072 0%, #e0533b 100%)',
  'linear-gradient(135deg, #ffd27a 0%, #f29b38 100%)',
  'linear-gradient(135deg, #a7dcb8 0%, #3f9b6c 100%)',
  'linear-gradient(135deg, #f9cfc6 0%, #d9708a 100%)',
  'linear-gradient(135deg, #cfe5f7 0%, #6fa8d6 100%)',
];

// Emoji are picked by the first matching tag, so every recipe gets a stand-in image without stored assets.
const TAG_EMOJI: [string, string][] = [
  ['italian', '🍝'],
  ['breakfast', '🍳'],
  ['chinese', '🥡'],
  ['indian', '🍛'],
  ['mexican', '🌮'],
  ['japanese', '🍱'],
  ['middle-eastern', '🥘'],
  ['mediterranean', '🥗'],
  ['vegan', '🥬'],
  ['vegetarian', '🥕'],
];

export function recipeVisual(recipe: { id: number; tags: string[] }): {
  emoji: string;
  background: string;
} {
  const tagged = TAG_EMOJI.find(([tag]) => recipe.tags.includes(tag));
  return {
    emoji: tagged?.[1] ?? '🍽️',
    background: PALETTES[recipe.id % PALETTES.length],
  };
}
