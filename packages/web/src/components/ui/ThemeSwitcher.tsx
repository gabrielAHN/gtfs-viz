import { useThemeContext } from "@/context/theme.client";
import { Button } from "@/components/ui/button";
import { BiSun, BiMoon } from "react-icons/bi";
import type { ButtonProps } from "@/components/ui/button";
import clsx from "clsx";

interface ThemeSwitcherProps extends ButtonProps {
  className?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className, ...props }) => {
  const { theme, toggleTheme } = useThemeContext();

  return (
    <Button
      onClick={toggleTheme}
      className={clsx(
        "flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      {...props}
    >
      {theme === "dark" ? <BiMoon className="h-5 w-5" /> : <BiSun className="h-5 w-5" />}
    </Button>
  );
};

export default ThemeSwitcher;
