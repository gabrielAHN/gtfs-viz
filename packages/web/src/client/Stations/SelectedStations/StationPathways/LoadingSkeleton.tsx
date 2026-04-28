import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PathwaysLoadingSkeletonProps = {
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export default function PathwaysLoadingSkeleton({
  className,
  headerClassName,
  contentClassName,
}: PathwaysLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className={cn("h-12 w-full rounded-md", headerClassName)} />
      <Skeleton
        className={cn("h-[65vh] w-full rounded-md", contentClassName)}
      />
    </div>
  );
}
