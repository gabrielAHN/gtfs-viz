import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  CheckIcon,
  XCircle,
  ChevronDown,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

// ----- Variants / Styling --------------------------------------------------
const multiSelectVariants = cva(
  "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      variant: {
        default:
          "border-foreground/10 text-foreground bg-card hover:bg-card/80",
        secondary:
          "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        inverted: "inverted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// ----- Types ---------------------------------------------------------------
interface OptionItem {
  value: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  /** 
   * Color to apply to the badge. 
   * e.g. "#eb4d4b" or "rgb(220,38,38)" 
   */
  color?: string
}

interface MultiSelectProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  options: OptionItem[]
  onValueChange: (value: string[]) => void
  defaultValue?: string[]
  placeholder?: string
  maxCount?: number
  modalPopover?: boolean
  asChild?: boolean
  className?: string
}

// ----- Component -----------------------------------------------------------
export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      onValueChange,
      variant,
      defaultValue = [],
      placeholder = "Select options",
      maxCount = 3,
      modalPopover = false,
      asChild = false,
      className,
      ...props
    },
    ref
  ) => {
    // State
    const [selectedValues, setSelectedValues] = React.useState<string[]>(
      defaultValue
    )
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)

    React.useEffect(() => {
      setSelectedValues(defaultValue || [])
    }, [defaultValue])

    // ----- Handlers --------------------------------------------------------
    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        setIsPopoverOpen(true)
      } else if (event.key === "Backspace" && !event.currentTarget.value) {
        // Remove last selection on backspace
        const newSelectedValues = [...selectedValues]
        newSelectedValues.pop()
        setSelectedValues(newSelectedValues)
        onValueChange(newSelectedValues)
      }
    }

    const toggleOption = (optionValue: string) => {
      const newSelectedValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue]

      setSelectedValues(newSelectedValues)
      onValueChange(newSelectedValues)
    }

    const handleClear = () => {
      setSelectedValues([])
      onValueChange([])
    }

    const handleTogglePopover = () => {
      setIsPopoverOpen((prev) => !prev)
    }

    const clearExtraOptions = () => {
      const newSelectedValues = selectedValues.slice(0, maxCount)
      setSelectedValues(newSelectedValues)
      onValueChange(newSelectedValues)
    }

    const toggleAll = () => {
      if (selectedValues.length === options.length) {
        handleClear()
      } else {
        const allValues = options.map((o) => o.value)
        setSelectedValues(allValues)
        onValueChange(allValues)
      }
    }

    // ----- Render ----------------------------------------------------------
    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        {/* Trigger (the main selection box) */}
        <PopoverTrigger asChild>
          <div
            ref={ref}
            {...props}
            onClick={handleTogglePopover}
            className={cn(
              "flex w-full items-center justify-between rounded-md border min-h-10 h-auto p-1",
              "bg-inherit hover:bg-gray-100 dark:hover:bg-gray-800",
              className
            )}
          >
            {/* If we have selected values, show them as badges */}
            {selectedValues.length > 0 ? (
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-wrap items-center">
                  {selectedValues.slice(0, maxCount).map((value) => {
                    const option = options.find((o) => o.value === value)
                    if (!option) return null

                    const IconComponent = option.icon
                    return (
                      <Badge
                        key={value}
                        className={cn(
                          // If no color is provided, default to a plain style
                          !option.color && "bg-muted text-muted-foreground",
                          multiSelectVariants({ variant })
                        )}
                        // Use backgroundColor if color is provided
                        style={
                          option.color
                            ? { backgroundColor: option.color }
                            : undefined
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleOption(value)
                        }}
                      >
                        {IconComponent && (
                          <IconComponent className="mr-2 h-4 w-4" />
                        )}
                        {option.label}
                        <XCircle className="ml-2 h-4 w-4 cursor-pointer text-inherit" />
                      </Badge>
                    )
                  })}

                  {/* If more items than maxCount, show a + number badge */}
                  {selectedValues.length > maxCount && (
                    <Badge
                      className={cn(
                        "cursor-pointer",
                        multiSelectVariants({ variant })
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        clearExtraOptions()
                      }}
                    >
                      {`+ ${selectedValues.length - maxCount} more`}
                      <XCircle className="ml-2 h-4 w-4 cursor-pointer" />
                    </Badge>
                  )}
                </div>

                {/* Right side icons: Clear and ChevronDown */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleClear()
                    }}
                  >
                    <XIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-4" />
                  <ChevronDown className="mx-1 h-4 w-4 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              /* If no items selected, show placeholder text */
              <div className="mx-auto flex w-full items-center justify-between">
                <span className="mx-3 text-sm text-stone-500 dark:text-stone-400">
                  {placeholder}
                </span>
                <ChevronDown className="mx-2 h-4 w-4 cursor-pointer text-muted-foreground" />
              </div>
            )}
          </div>
        </PopoverTrigger>

        {/* Popover Content - The Command list */}
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onEscapeKeyDown={() => setIsPopoverOpen(false)}
        >
          <Command>
            <CommandInput
              placeholder="Search..."
              onKeyDown={handleInputKeyDown}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {/* Toggle All option */}
                <CommandItem
                  key="all"
                  onSelect={toggleAll}
                  className="cursor-pointer"
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      selectedValues.length === options.length
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible"
                    )}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </div>
                  <span>(Select All)</span>
                </CommandItem>

                {/* Render each Option */}
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => toggleOption(option.value)}
                      className="flex cursor-pointer items-center"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>

                      {/* Optional color badge */}
                      {option.color && (
                        <div
                          className="mr-2 h-2 w-2 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}

                      {/* Optional icon */}
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>

              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {/* Clear button */}
                  {selectedValues.length > 0 && (
                    <>
                      <CommandItem
                        onSelect={handleClear}
                        className="flex-1 cursor-pointer justify-center"
                      >
                        Clear
                      </CommandItem>
                      <Separator
                        orientation="vertical"
                        className="h-full min-h-[20px]"
                      />
                    </>
                  )}
                  {/* Close button */}
                  <CommandItem
                    onSelect={() => setIsPopoverOpen(false)}
                    className="max-w-full flex-1 cursor-pointer justify-center"
                  >
                    Close
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)

MultiSelect.displayName = "MultiSelect"
