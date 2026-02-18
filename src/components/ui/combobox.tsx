import { useState, useMemo } from "react";
import { BiCheck, BiChevronsDown, BiX } from "react-icons/bi";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps {
  Selections: string[]; 
  Message: string;
  setValue: (value: string | undefined) => void;
  value: string | undefined;
}

export default function Combobox({
  Selections,
  Message,
  setValue,
  value,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  const valueMap = useMemo(() => {
    return Selections.reduce((acc, item) => {
      acc[item.toLowerCase()] = item;
      return acc;
    }, {} as Record<string, string>);
  }, [Selections]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
      <div
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full p-2 text-sm rounded-md border min-h-10 cursor-pointer items-center justify-between",
          "bg-background hover:bg-accent/10 transition-colors",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="flex-1 truncate ml-2">{value || Message}</span>
        <div className="flex items-center space-x-2">
          {value && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setValue(undefined); 
              }}
              className="cursor-pointer"
            >
              <BiX className="h-4 w-4 text-current opacity-50" />
            </div>
          )}
          <BiChevronsDown className="h-4 w-4 text-current opacity-50" />
        </div>
      </div>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command shouldFilter={true}>
          <CommandInput placeholder={Message} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {Selections.slice(0, 1000).map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  onSelect={(currentValue) => {
                    
                    const originalValue = valueMap[currentValue.toLowerCase()];
                    setValue(originalValue === value ? undefined : originalValue);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer",
                    value === item
                      ? "bg-accent text-accent-foreground"
                      : ""
                  )}
                >
                  <BiCheck
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
