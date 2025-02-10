import { useThemeContext } from "@/context/combinedContext"; // Update the path accordingly

import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";
import clsx from "clsx";

interface ThemeSwitcherProps extends ButtonProps {
  className?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className, ...props }) => {
  const { theme, toggleTheme } = useThemeContext();

  const isDark = theme === "dark";

  return (
    <Button
      onClick={toggleTheme}
      className={clsx(
        "flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      {...props}
    >
      {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
};

export default ThemeSwitcher;
