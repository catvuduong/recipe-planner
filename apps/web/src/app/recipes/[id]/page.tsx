import { Suspense } from 'react';
import { RecipeView } from '@/components/RecipeView';

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <RecipeFromParams params={params} />
    </Suspense>
  );
}

// Params are only known at request time, so reading them waits behind the Suspense boundary above.
async function RecipeFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeView id={id} />;
}
