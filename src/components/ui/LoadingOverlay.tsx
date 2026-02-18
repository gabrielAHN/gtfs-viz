import { useEffect } from "react";
import { Progress } from "@/components/ui/progress";

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  subMessage?: string;
  progress?: number;
}

export function LoadingOverlay({
  isVisible,
  message = "Loading...",
  subMessage,
  progress,
}: LoadingOverlayProps) {
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card rounded-lg shadow-lg p-8 max-w-md w-full mx-4 border">
        <div className="flex flex-col items-center gap-6">
          {}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20"></div>
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl">
              🚉
            </div>
          </div>

          {}
          <div className="text-center space-y-2 w-full">
            <h3 className="text-lg font-semibold text-foreground">{message}</h3>
            {subMessage && (
              <p className="text-sm text-muted-foreground">{subMessage}</p>
            )}
          </div>

          {}
          {progress !== undefined && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {Math.round(progress)}%
              </p>
            </div>
          )}

          {}
          {progress === undefined && (
            <div className="w-full">
              <Progress className="w-full" indeterminate />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
