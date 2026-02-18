import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { logger } from '@/lib/logger';

interface SmartRangeSliderProps {
  values: number[];
  selectedRange: [number, number] | undefined;
  onRangeChange: (range: [number, number] | undefined | { exclude: number }) => void;
  className?: string;
  label?: (value: number) => React.ReactNode;
  excludeValue?: number;
}

export const SmartRangeSlider = React.forwardRef<HTMLDivElement, SmartRangeSliderProps>(
  ({ values, selectedRange, onRangeChange, className, label, excludeValue }, ref) => {
    const sortedValues = React.useMemo(() => [...values].sort((a, b) => a - b), [values]);
    const [isDragging, setIsDragging] = React.useState<number | null>(null);

    if (sortedValues.length === 1) {
      const singleValue = sortedValues[0];
      const isExcluded = excludeValue === singleValue;

      const isActive = isExcluded
        ? false
        : (selectedRange === undefined || (selectedRange[0] === singleValue && selectedRange[1] === singleValue));

      return (
        <div ref={ref} className={cn('w-full', className)}>
          <Button
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (isExcluded) {

                onRangeChange(undefined);
              } else if (isActive) {

                onRangeChange({ exclude: singleValue } as any);
              } else {

                onRangeChange([singleValue, singleValue]);
              }
            }}
            className="w-full"
          >
            {label ? label(singleValue) : singleValue} {isActive ? '✓' : isExcluded ? '✗' : ''}
          </Button>
        </div>
      );
    }

    if (sortedValues.length === 2) {
      const [val1, val2] = sortedValues;

      let currentIndex = 1; 
      if (selectedRange) {
        if (selectedRange[0] === val1 && selectedRange[1] === val1) {
          currentIndex = 0; 
        } else if (selectedRange[0] === val2 && selectedRange[1] === val2) {
          currentIndex = 2; 
        } else {
          currentIndex = 1; 
        }
      }

      const handleChange = (newValue: number[]) => {
        const newIndex = newValue[0];
        if (newIndex === 0) {
          
          onRangeChange([val1, val1]);
        } else if (newIndex === 2) {
          
          onRangeChange([val2, val2]);
        } else {
          
          onRangeChange([val1, val2]);
        }
      };

      const formatKnobValue = (val: number) => {
        if (val === 0) return label ? String(label(val1)) : String(val1);
        if (val === 2) return label ? String(label(val2)) : String(val2);
        return 'All';
      };

      return (
        <div ref={ref} className={cn('w-full pt-8 pb-2 px-4', className)}>
          <Slider
            value={[currentIndex]}
            onValueChange={handleChange}
            min={0}
            max={2}
            step={1}
            showValue
            formatValue={formatKnobValue}
            hideRange
          />
        </div>
      );
    }

    const defaultRange: [number, number] = [sortedValues[0], sortedValues[sortedValues.length - 1]];
    const currentRange = selectedRange || defaultRange;

    const startIndex = currentRange[0] !== undefined
      ? sortedValues.findIndex((v) => v >= currentRange[0])
      : 0;
    const endIndex = currentRange[1] !== undefined
      ? sortedValues.findIndex((v) => v >= currentRange[1])
      : sortedValues.length - 1;

    const validStartIndex = startIndex === -1 ? 0 : startIndex;
    const validEndIndex = endIndex === -1 ? sortedValues.length - 1 : endIndex;

    const handleValueChange = (indices: number[]) => {
      let [newStartIdx, newEndIdx] = indices;
      const [currentStartIdx, currentEndIdx] = [validStartIndex, validEndIndex];

      const minGap = 1;

      if (isDragging === 0) {
        
        if (newStartIdx >= currentEndIdx - minGap) {
          const desiredGap = newStartIdx - currentStartIdx;
          newEndIdx = Math.min(sortedValues.length - 1, currentEndIdx + desiredGap);
          newStartIdx = Math.max(0, newEndIdx - minGap);
        }
      } else if (isDragging === 1) {
        
        if (newEndIdx <= currentStartIdx + minGap) {
          const desiredGap = currentEndIdx - newEndIdx;
          newStartIdx = Math.max(0, currentStartIdx - desiredGap);
          newEndIdx = Math.min(sortedValues.length - 1, newStartIdx + minGap);
        }
      }

      const newRange: [number, number] = [
        sortedValues[newStartIdx],
        sortedValues[newEndIdx],
      ];

      onRangeChange(newRange);
    };

    return (
      <div ref={ref} className={cn('w-full pt-8 pb-2 px-4', className)}>
        <Slider
          value={[validStartIndex, validEndIndex]}
          onValueChange={handleValueChange}
          onValueCommit={() => setIsDragging(null)}
          onThumbPointerDown={(index) => setIsDragging(index)}
          min={0}
          max={sortedValues.length - 1}
          step={1}
          minStepsBetweenThumbs={0}
          showValue
          formatValue={(idx) => label ? String(label(sortedValues[idx])) : String(sortedValues[idx])}
        />
      </div>
    );
  }
);

SmartRangeSlider.displayName = 'SmartRangeSlider';
