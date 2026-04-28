
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const StationsMapLazy = lazy(() => import('./index'));

export default function StationsMap(props: any) {
  return (
    <Suspense
      fallback={
        <div className="relative h-full w-full">
          <Skeleton className="h-full w-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading station map...</div>
          </div>
        </div>
      }
    >
      <StationsMapLazy {...props} />
    </Suspense>
  );
}
