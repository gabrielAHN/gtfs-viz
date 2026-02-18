import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

export const GhnWebsite: React.FC = () => (
  <div className="flex justify-center m-2">
    <a
      href="https://www.gabrielhn.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="dark:hover:text-yellow-400 dark:text-white text-gray-700 hover:text-yellow-400  no-underline"
    >
      Created by gabrielhn
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
      <Github />
    </Button>
);
