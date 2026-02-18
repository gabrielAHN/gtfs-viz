import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  BiCheck,
  BiXCircle,
  BiChevronDown,
  BiX,
} from "react-icons/bi"

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

const multiSelectVariants = cva(
  "m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      variant: {
        default:
          "border-foreground/10 text-foreground bg-accent/50 hover:bg-accent",
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

interface OptionItem {
  value: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  
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
    
    const [selectedValues, setSelectedValues] = React.useState<string[]>(
      defaultValue
    )
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)

    const defaultValueStr = JSON.stringify(defaultValue || [])

    React.useEffect(() => {
      setSelectedValues(JSON.parse(defaultValueStr) as string[])
    }, [defaultValueStr])

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        setIsPopoverOpen(true)
      } else if (event.key === "Backspace" && !event.currentTarget.value) {
        
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

    return (
      <Popover
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        modal={modalPopover}
      >
        {}
        <PopoverTrigger asChild>
          <div
            ref={ref}
            {...props}
            onClick={handleTogglePopover}
            className={cn(
              "flex w-full items-center justify-between rounded-md border min-h-10 h-auto p-1",
              "bg-background hover:bg-accent/10 transition-colors",
              "text-foreground",
              className
            )}
          >
            {}
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
                          multiSelectVariants({ variant })
                        )}
                        
                        style={
                          option.color
                            ? { backgroundColor: option.color, color: '#fff' }
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
                        <BiXCircle className="ml-2 h-4 w-4 cursor-pointer text-inherit" />
                      </Badge>
                    )
                  })}

                  {}
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
                      <BiXCircle className="ml-2 h-4 w-4 cursor-pointer" />
                    </Badge>
                  )}
                </div>

                {}
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
                    <BiX className="h-4 w-4 text-current opacity-70" />
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-4" />
                  <BiChevronDown className="mx-1 h-4 w-4 cursor-pointer text-current opacity-70" />
                </div>
              </div>
            ) : (
              
              <div className="mx-auto flex w-full items-center justify-between">
                <span className="mx-3 text-sm text-muted-foreground">
                  {placeholder}
                </span>
                <BiChevronDown className="mx-2 h-4 w-4 cursor-pointer text-muted-foreground" />
              </div>
            )}
          </div>
        </PopoverTrigger>

        {}
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
                {}
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
                    <BiCheck className="h-4 w-4" />
                  </div>
                  <span>(Select All)</span>
                </CommandItem>

                {}
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
                        <BiCheck className="h-4 w-4" />
                      </div>

                      {}
                      {option.color && (
                        <div
                          className="mr-2 h-2 w-2 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}

                      {}
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-current opacity-70" />
                      )}
                      <span>{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>

              <CommandSeparator />
              <CommandGroup>
                <div className="flex items-center justify-between">
                  {}
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
                  {}
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
