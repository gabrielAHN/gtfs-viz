import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { GithubButton, GhnWebsite } from "@/components/contact";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

function HeaderDrawer({ TabList }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="icon" className="lg:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-inherit">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">Station 🚉 Viz</SheetTitle>
          <SheetDescription />
        </SheetHeader>

        <nav className="grid gap-2">
          {TabList.map((tab, index) => (
            <div
              key={index}
              className="flex flex-col border-b border-primary/20 py-2"
            >
              <div
                className="
                  px-2 py-2 
                  text-lg font-semibold 
                  text-primary 
                  transition-colors 
                "
              >
                {tab.label}
              </div>
              {tab.pages && (
                <div className="ml-2 mt-1 flex flex-col space-y-1">
                  {tab.pages.map((page, subIndex) => (
                    <div
                      key={subIndex}
                      onClick={page.clickFunction}
                      className="
                        cursor-pointer 
                        rounded 
                        px-2 py-2 
                        text-sm font-medium
                        transition-colors
                        bg-primary-foreground
                        hover:bg-primary/10 
                        
                      "
                    >
                      <div className="flex items-center space-x-2">
                        {page.icon && (
                          <page.icon className="h-5 w-5 text-primary group-hover:text-black" />
                        )}
                        <span>{page.title}</span>
                      </div>
                      {page.description && (
                        <div className="pl-7 text-muted-foreground group-hover:text-foreground">
                          {page.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-center mt-4 gap-2">
            <GithubButton />
          </div>
          <GhnWebsite />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export default HeaderDrawer;
