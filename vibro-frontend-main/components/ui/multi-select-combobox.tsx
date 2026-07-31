"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MultiSelectComboboxProps {
  options: { label: string; value: string; group?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  notFoundText?: string;
  groupByLabel?: boolean;
}

export function MultiSelectCombobox({
  options,
  selectedValues,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  notFoundText = "No option found.",
  groupByLabel = false,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value))
    } else {
      onChange([...selectedValues, value])
    }
  }

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedValues.filter((v) => v !== value))
  }

  const selectedLabels = options
    .filter((o) => selectedValues.includes(o.value))
    .map((o) => o.label)

  // Group options if groupByLabel is true
  const groupedOptions = React.useMemo(() => {
    if (!groupByLabel) return null
    const groups: Record<string, typeof options> = {}
    options.forEach((o) => {
      const g = o.group || "Other"
      if (!groups[g]) groups[g] = []
      groups[g].push(o)
    })
    return groups
  }, [options, groupByLabel])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between min-h-[40px] h-auto"
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedLabels.slice(0, 3).map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))
            )}
            {selectedLabels.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedLabels.length - 3} more
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{notFoundText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  if (selectedValues.length === options.length) {
                    onChange([]);
                  } else {
                    onChange(options.map((o) => o.value));
                  }
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedValues.length === options.length ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="font-semibold">Select All</span>
              </CommandItem>
            </CommandGroup>
            {groupedOptions ? (
              Object.entries(groupedOptions).map(([groupName, items]) => (
                <CommandGroup key={groupName} heading={groupName}>
                  {items.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleToggle(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleToggle(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
