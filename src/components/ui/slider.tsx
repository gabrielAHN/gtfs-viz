"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showSteps?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  onThumbPointerDown?: (index: number) => void;
  hideRange?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showSteps, showValue, formatValue, onThumbPointerDown, hideRange, ...props }, ref) => {
  const value = props.value || props.defaultValue || [0];
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;

  const steps = React.useMemo(() => {
    if (!showSteps) return [];
    const stepCount = Math.floor((max - min) / step) + 1;
    return Array.from({ length: stepCount }, (_, i) => ({
      value: min + i * step,
      position: ((min + i * step - min) / (max - min)) * 100,
    }));
  }, [showSteps, min, max, step]);

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      {}
      {showSteps && (
        <div className="absolute top-0 left-0 w-full h-2 pointer-events-none">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="absolute w-0.5 h-2 bg-muted-foreground/30"
              style={{ left: `${s.position}%` }}
            />
          ))}
        </div>
      )}

      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className={cn("absolute h-full bg-primary", hideRange && "bg-transparent")} />
      </SliderPrimitive.Track>

      {}
      {value.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onPointerDown={() => onThumbPointerDown?.(index)}
        >
          {showValue && (
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap font-medium">
              {formatValue ? formatValue(value[index]) : value[index]}
            </span>
          )}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
