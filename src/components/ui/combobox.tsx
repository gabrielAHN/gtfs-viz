import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

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
  Selections: string[]; // Accepts a list of strings
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
      <div
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full p-2 text-sm rounded-md border min-h-10 cursor-pointer items-center justify-between",
          "bg-inherit hover:bg-gray-100 dark:hover:bg-gray-800",
          value ? "" : "text-muted-foreground"
        )}
      >
        <span className="flex-1 truncate ml-2">{value || Message}</span>
        <div className="flex items-center space-x-2">
          {value && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setValue(undefined); // Clear the selection
              }}
              className="cursor-pointer"
            >
              <X className="h-4 w-4 opacity-50" />
            </div>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </div>
      </div>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={Message} />
          <CommandList>
            <CommandEmpty>{Message}</CommandEmpty>
            <CommandGroup>
              {Selections.map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? undefined : currentValue);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer",
                    value === item
                      ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                      : ""
                  )}
                >
                  <Check
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
