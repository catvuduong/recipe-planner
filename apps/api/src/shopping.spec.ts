import { mergeShoppingList, scaleQuantity } from './shopping.js';

describe('scaleQuantity', () => {
  it('scales linearly from the recipe servings to the target servings', () => {
    expect(scaleQuantity(200, 4, 2)).toBe(100);
    expect(scaleQuantity(200, 2, 6)).toBe(600);
  });

  it('keeps the quantity when the servings match', () => {
    expect(scaleQuantity(1.5, 4, 4)).toBe(1.5);
  });

  it('rounds to two decimal places', () => {
    expect(scaleQuantity(1, 3, 2)).toBe(0.67);
  });

  it('rejects a non-positive recipe servings count', () => {
    expect(() => scaleQuantity(1, 0, 2)).toThrow();
  });
});

describe('mergeShoppingList', () => {
  it('sums quantities of the same ingredient and unit across meals, scaled to the household', () => {
    const items = mergeShoppingList(
      [
        { recipeServings: 2, ingredients: [{ name: 'Flour', quantity: 200, unit: 'g' }] },
        { recipeServings: 4, ingredients: [{ name: 'flour', quantity: 100, unit: 'g' }] },
      ],
      2,
    );
    // 200 g for 2 servings stays 200 g; 100 g written for 4 servings is 50 g for 2.
    expect(items).toEqual([{ name: 'flour', unit: 'g', quantity: 250 }]);
  });

  it('keeps the same name in different units as separate lines', () => {
    const items = mergeShoppingList(
      [
        { recipeServings: 2, ingredients: [{ name: 'butter', quantity: 40, unit: 'g' }] },
        { recipeServings: 2, ingredients: [{ name: 'butter', quantity: 1, unit: 'tbsp' }] },
      ],
      2,
    );
    expect(items).toEqual([
      { name: 'butter', unit: 'g', quantity: 40 },
      { name: 'butter', unit: 'tbsp', quantity: 1 },
    ]);
  });

  it('treats a missing unit the same as a blank one', () => {
    const items = mergeShoppingList(
      [
        { recipeServings: 2, ingredients: [{ name: 'eggs', quantity: 2, unit: null }] },
        { recipeServings: 2, ingredients: [{ name: 'eggs ', quantity: 1, unit: '  ' }] },
      ],
      2,
    );
    expect(items).toEqual([{ name: 'eggs', unit: null, quantity: 3 }]);
  });

  it('collapses extra whitespace in names', () => {
    const items = mergeShoppingList(
      [{ recipeServings: 1, ingredients: [{ name: '  red   onion ', quantity: 1, unit: null }] }],
      1,
    );
    expect(items).toEqual([{ name: 'red onion', unit: null, quantity: 1 }]);
  });

  it('lists unquantified ingredients without a quantity and does not add them to sums', () => {
    const items = mergeShoppingList(
      [
        { recipeServings: 2, ingredients: [{ name: 'salt', quantity: null, unit: null }] },
        { recipeServings: 2, ingredients: [{ name: 'salt', quantity: 5, unit: 'g' }] },
      ],
      2,
    );
    expect(items).toEqual([
      { name: 'salt', unit: null, quantity: null },
      { name: 'salt', unit: 'g', quantity: 5 },
    ]);
  });

  it('returns an empty list when nothing is planned', () => {
    expect(mergeShoppingList([], 2)).toEqual([]);
  });

  it('sorts by name, then unit', () => {
    const items = mergeShoppingList(
      [
        {
          recipeServings: 1,
          ingredients: [
            { name: 'walnuts', quantity: 1, unit: 'g' },
            { name: 'apples', quantity: 2, unit: null },
          ],
        },
      ],
      1,
    );
    expect(items.map((item) => item.name)).toEqual(['apples', 'walnuts']);
  });
});
