
import { lazy, Suspense, ComponentProps } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DeckglMapLazy = lazy(() => import('./DeckglMap'));

type DeckglMapProps = ComponentProps<typeof DeckglMapLazy>;

export default function DeckglMap(props: DeckglMapProps) {
  return (
    <Suspense
      fallback={
        <div className="relative h-full w-full">
          <Skeleton className="h-full w-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading map...</div>
          </div>
        </div>
      }
    >
      <DeckglMapLazy {...props} />
    </Suspense>
  );
}
