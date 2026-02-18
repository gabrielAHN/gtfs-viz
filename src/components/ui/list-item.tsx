import React from "react";
import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

export const ListItem = React.forwardRef(({ className, title, icon: Icon, children, ...props }, ref) => {
  return (
    <NavigationMenuLink asChild>
      <a
        ref={ref}
        className={cn(
          "block select-none space-y-2 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
          className
        )}
        {...props}
      >
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="w-5 h-5 text-current opacity-70" />}
          <div className="text-sm font-medium leading-none">{title}</div>
        </div>
        <p className="text-sm leading-snug text-current opacity-70">
          {children}
        </p>
      </a>
    </NavigationMenuLink>
  );
});

ListItem.displayName = "ListItem";
