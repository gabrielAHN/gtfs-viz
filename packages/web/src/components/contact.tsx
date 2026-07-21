import { Button } from "@/components/ui/button";
import { BiLogoGithub } from "react-icons/bi";

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
