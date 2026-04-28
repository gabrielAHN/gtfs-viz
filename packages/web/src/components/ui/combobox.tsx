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

type ComboboxOption = {
  value: string;
  label: string;
  color?: string;
  searchLabel?: string;
};

interface ComboboxProps {
  Selections?: string[];
  options?: ComboboxOption[];
  Message: string;
  setValue: (value: string | undefined) => void;
  value: string | undefined;
}

export default function Combobox({
  Selections,
  options,
  Message,
  setValue,
  value,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  const normalizedOptions = useMemo(() => {
    if (options && options.length > 0) {
      return options;
    }

    return (Selections ?? []).map((item) => ({
      value: item,
      label: item,
    }));
  }, [Selections, options]);

  const optionByLabel = useMemo(() => {
    return normalizedOptions.reduce((acc, option) => {
      acc[(option.searchLabel ?? option.label).toLowerCase()] = option;
      return acc;
    }, {} as Record<string, ComboboxOption>);
  }, [normalizedOptions]);

  const selectedOption = useMemo(() => {
    if (!value) {
      return undefined;
    }

    return normalizedOptions.find((option) => option.value === value);
  }, [normalizedOptions, value]);

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
          selectedOption ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 ml-2">
          {selectedOption?.color ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selectedOption.color }}
            />
          ) : null}
          <span className="truncate">
            {selectedOption?.label || Message}
          </span>
        </span>
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
              {normalizedOptions.slice(0, 1000).map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchLabel ?? option.label}
                  onSelect={(currentValue) => {
                    const selectedOption = optionByLabel[currentValue.toLowerCase()];
                    const nextValue = selectedOption?.value;
                    setValue(nextValue === value ? undefined : nextValue);
                    setOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer",
                    value === option.value
                      ? "bg-accent text-accent-foreground"
                      : ""
                  )}
                >
                  <BiCheck
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.color ? (
                    <span
                      className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
