import { useDeferredValue, useMemo, useState } from "react"
import { BiCheck, BiChevronsDown, BiX } from "react-icons/bi"

import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type ComboboxOption = {
  value: string
  label: string
  color?: string
  searchLabel?: string
}

interface ComboboxProps {
  Selections?: string[]
  options?: ComboboxOption[]
  Message: string
  setValue: (value: string | undefined) => void
  value: string | undefined
  wrapLabel?: boolean
  disabled?: boolean
}

export default function Combobox({
  Selections,
  options,
  Message,
  setValue,
  value,
  wrapLabel = false,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)

  const normalizedOptions = useMemo(() => {
    if (options && options.length > 0) {
      return options
    }

    return (Selections ?? []).map((item) => ({
      value: item,
      label: item,
    }))
  }, [Selections, options])

  const filteredOptions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return normalizedOptions
    return normalizedOptions.filter((option) =>
      `${option.value} ${option.label} ${option.searchLabel ?? ""}`.toLowerCase().includes(query),
    )
  }, [deferredSearch, normalizedOptions])

  const visibleOptions = useMemo(() => filteredOptions.slice(0, 1000), [filteredOptions])

  const selectedOption = useMemo(() => {
    if (!value) {
      return undefined
    }

    return normalizedOptions.find((option) => option.value === value)
  }, [normalizedOptions, value])

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(nextOpen) => {
        if (disabled) return
        setOpen(nextOpen)
        if (!nextOpen) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={disabled ? false : open}
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled) setOpen((prev) => !prev)
          }}
          className={cn(
            "flex w-full p-2 text-sm rounded-md border min-h-10 cursor-pointer items-center justify-between",
            "bg-background hover:bg-accent/10 transition-colors",
            selectedOption ? "text-foreground" : "text-muted-foreground",
            disabled && "cursor-not-allowed opacity-50 hover:bg-background",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 ml-2">
            {selectedOption?.color ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selectedOption.color }}
              />
            ) : null}
            <span className={wrapLabel ? "break-all text-left" : "truncate"}>
              {selectedOption?.label || Message}
            </span>
          </span>
          <div className="flex items-center space-x-2">
            {value && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  if (!disabled) setValue(undefined)
                }}
                className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
              >
                <BiX className="h-4 w-4 text-current opacity-50" />
              </div>
            )}
            <BiChevronsDown className="h-4 w-4 text-current opacity-50" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={Message} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No results found.</CommandEmpty>
            {filteredOptions.length > visibleOptions.length ? (
              <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                Showing {visibleOptions.length.toLocaleString()} of{" "}
                {filteredOptions.length.toLocaleString()} results. Type to narrow the list.
              </div>
            ) : null}
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchLabel ?? option.label}
                  onSelect={() => {
                    setValue(option.value === value ? undefined : option.value)
                    setOpen(false)
                    setSearch("")
                  }}
                  className={cn(
                    "cursor-pointer",
                    value === option.value ? "bg-accent text-accent-foreground" : "",
                  )}
                >
                  <BiCheck
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.color ? (
                    <span
                      className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : null}
                  <span className={wrapLabel ? "break-all whitespace-normal" : "truncate"}>
                    {option.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
