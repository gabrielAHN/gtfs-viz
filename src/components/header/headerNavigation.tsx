import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { ListItem } from "@/components/ui/list-item";



const HeaderNavigation = ({ TabList }) => {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {TabList.map((tab, index) => (
          <NavigationMenuItem key={index}>
            {tab.pages ? (
              <>
                <NavigationMenuTrigger className="px-4 py-2 text-xs font-bold text-primary transition-colors hover:text-popover-foreground dark:text-white dark:hover:text-popover-foreground">
                  {tab.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="flex flex-wrap gap-4 p-4">
                  {tab.pages.map((subPage, subIndex) => (
                    <ListItem
                      key={subIndex}
                      title={subPage.title}
                      onClick={subPage.clickFunction}
                      icon={subPage.icon}
                      className="w-[225px]"
                    >
                      {subPage.description ? subPage.description : "No description"}
                    </ListItem>
                  ))}
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink
                className="px-4 py-2 text-xs font-bold text-primary transition-colors hover:text-popover-foreground dark:text-white dark:hover:text-popover-foreground"
                onClick={() => tab.clickFunction}
                href={tab.url}
              >
                {tab.label}
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
        <NavigationMenuIndicator />
      </NavigationMenuList>
    </NavigationMenu>
  );
};

export default HeaderNavigation;