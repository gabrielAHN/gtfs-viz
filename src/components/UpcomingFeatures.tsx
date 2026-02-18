import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Github } from "lucide-react";

const upcomingFeatures = [
  {
    title: "Full Pathway Editing",
    description: "Add, delete, and modify pathways between station entrances and platforms",
    category: "Editing",
  },
  {
    title: "Route Visualization",
    description: "Visualize transit routes with stop sequences and service patterns",
    category: "Visualization",
  },
  {
    title: "Schedule Timeline",
    description: "Interactive timeline views showing trip schedules and frequencies",
    category: "Visualization",
  },
];

export default function UpcomingFeatures() {
  const [open, setOpen] = useState(false);

  const handleDiscussions = () => {
    window.open(
      "https://github.com/gabrielAHN/gtfs-viz/discussions",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Upcoming Features
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6" />
            Upcoming Features
          </DialogTitle>
          <DialogDescription>
            Features planned for future releases. Help us prioritize by voting and
            discussing in our GitHub repository!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {upcomingFeatures.map((feature, index) => (
            <div
              key={index}
              className="border rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full ml-2">
                  {feature.category}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Have ideas for new features? Join the discussion and help shape the future of GTFS Viz!
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="default"
              onClick={handleDiscussions}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Share Your Ideas
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  "https://github.com/gabrielAHN/gtfs-viz/issues/new",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="gap-2"
            >
              <Github className="h-4 w-4" />
              Report Bug
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
