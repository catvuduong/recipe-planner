import { BadRequestException } from '@nestjs/common';
import {
  parseCsv,
  parseId,
  parseRecipeCreate,
  parseRecipePatch,
  parseText,
} from './recipe-input.js';

const valid = {
  title: '  Shakshuka ',
  minutes: 30,
  servings: 2,
  tags: [' Breakfast ', 'breakfast', 'Vegetarian'],
  ingredients: [{ name: ' eggs ', quantity: 4, unit: '' }],
  steps: ['Cook the sauce.'],
};

describe('parseRecipeCreate', () => {
  it('trims text, lowercases and de-duplicates tags, and blanks units to null', () => {
    expect(parseRecipeCreate(valid)).toEqual({
      title: 'Shakshuka',
      description: '',
      minutes: 30,
      servings: 2,
      tags: ['breakfast', 'vegetarian'],
      ingredients: [{ name: 'eggs', quantity: 4, unit: null }],
      steps: ['Cook the sauce.'],
    });
  });

  it('requires a title, minutes and servings', () => {
    expect(() => parseRecipeCreate({ ...valid, title: '   ' })).toThrow(BadRequestException);
    expect(() => parseRecipeCreate({ ...valid, minutes: undefined })).toThrow(BadRequestException);
    expect(() => parseRecipeCreate({ ...valid, servings: 0 })).toThrow(BadRequestException);
  });

  it('rejects a fractional number of minutes', () => {
    expect(() => parseRecipeCreate({ ...valid, minutes: 1.5 })).toThrow(BadRequestException);
  });

  it('rejects a negative ingredient quantity and an ingredient without a name', () => {
    expect(() =>
      parseRecipeCreate({ ...valid, ingredients: [{ name: 'egg', quantity: -1 }] }),
    ).toThrow(BadRequestException);
    expect(() => parseRecipeCreate({ ...valid, ingredients: [{ quantity: 1 }] })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a body that is not an object', () => {
    expect(() => parseRecipeCreate(null)).toThrow(BadRequestException);
    expect(() => parseRecipeCreate('pasta')).toThrow(BadRequestException);
  });
});

describe('parseRecipePatch', () => {
  it('accepts a subset of fields and leaves the rest out', () => {
    expect(parseRecipePatch({ minutes: 10 })).toEqual({ minutes: 10 });
  });

  it('still validates the fields it does receive', () => {
    expect(() => parseRecipePatch({ servings: 0 })).toThrow(BadRequestException);
  });
});

describe('parseText', () => {
  it('trims the value and treats blank as absent', () => {
    expect(parseText('  carbonara ', 'q')).toBe('carbonara');
    expect(parseText('   ', 'q')).toBeUndefined();
    expect(parseText(undefined, 'q')).toBeUndefined();
  });

  it('refuses repeated parameters, which arrive as arrays', () => {
    expect(() => parseText(['a', 'b'], 'q')).toThrow(BadRequestException);
  });
});

describe('parseCsv', () => {
  it('splits, trims, lowercases and drops empty and repeated values', () => {
    expect(parseCsv(' Egg, rice ,,EGG ', 'have')).toEqual(['egg', 'rice']);
  });

  it('returns an empty list when the parameter is absent', () => {
    expect(parseCsv(undefined, 'have')).toEqual([]);
  });

  it('caps the number of values', () => {
    const many = Array.from({ length: 21 }, (_, i) => `item${i}`).join(',');
    expect(() => parseCsv(many, 'have')).toThrow(BadRequestException);
  });
});

describe('parseId', () => {
  it('accepts positive integers', () => {
    expect(parseId('42')).toBe(42);
  });

  it('rejects anything else', () => {
    for (const value of ['0', '-1', '1.5', 'abc', '1e3']) {
      expect(() => parseId(value)).toThrow(BadRequestException);
    }
  });
});
