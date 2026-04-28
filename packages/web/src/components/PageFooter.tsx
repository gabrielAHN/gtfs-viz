import { GithubButton } from "@/components/contact";
import UpcomingFeatures from "@/components/UpcomingFeatures";

export default function PageFooter() {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <GithubButton />
      <UpcomingFeatures />
    </div>
  );
}
