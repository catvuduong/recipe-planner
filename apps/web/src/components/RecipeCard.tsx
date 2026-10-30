import Link from 'next/link';
import type { RecipeSummary } from '@/lib/api';
import { formatMinutes, recipeVisual } from '@/lib/format';

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const visual = recipeVisual(recipe);
  return (
    <li>
      <Link href={`/recipes/${recipe.id}`} className="recipe-card" data-testid="recipe-card">
        <div
          className="recipe-card__visual"
          style={{ background: visual.background }}
          aria-hidden="true"
        >
          <span>{visual.emoji}</span>
          {recipe.matchCount !== null && recipe.matchCount > 0 && (
            <span className="recipe-card__badge">Uses {recipe.matchCount} of yours</span>
          )}
        </div>
        <div className="recipe-card__body">
          <h3 className="recipe-card__title">{recipe.title}</h3>
          {recipe.description && <p className="recipe-card__desc">{recipe.description}</p>}
          <div className="meta">
            <span>⏱ {formatMinutes(recipe.minutes)}</span>
            <span>👥 serves {recipe.servings}</span>
          </div>
          {recipe.tags.length > 0 && (
            <div className="tags">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
