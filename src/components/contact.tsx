import { Button } from "@/components/ui/button";
import { BiLogoGithub } from "react-icons/bi";

export const GhnWebsite: React.FC = () => (
  <div className="flex justify-center m-2">
    <a
      href="https://www.gabrielhn.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs px-3 py-1.5 rounded-md bg-muted/50 text-muted-foreground hover:text-accent-foreground hover:bg-accent hover:shadow-[0_0_20px_hsl(46_74.1%_50%/0.6)] transition-all duration-200 no-underline"
    >
      by gabrielhn
    </a>
  </div>
);

export const GithubButton: React.FC = () => (
  <Button
    variant={"icon"}
    onClick={() =>
      window.open("https://github.com/gabrielAHN/gtfs-viz.git", "_blank")
    }
  >
    <BiLogoGithub />
  </Button>
);
