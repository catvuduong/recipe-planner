import { Suspense } from 'react';
import { ShoppingList } from '@/components/ShoppingList';

export default function ShoppingPage() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <ShoppingList />
    </Suspense>
  );
}
