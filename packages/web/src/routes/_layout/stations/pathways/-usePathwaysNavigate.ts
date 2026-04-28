import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

export function usePathwaysNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (options: Parameters<typeof navigate>[0]) => {
      if (typeof window === "undefined") {
        return navigate(options);
      }

      const left = window.scrollX;
      const top = window.scrollY;

      return navigate(options).finally(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ left, top, behavior: "auto" });
          requestAnimationFrame(() => {
            window.scrollTo({ left, top, behavior: "auto" });
          });
        });
      });
    },
    [navigate],
  );
}
