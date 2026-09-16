import { BiPlus, BiReset } from "react-icons/bi"
import Combobox from "@/components/ui/combobox"
import { MultiSelect } from "@/components/ui/multiselect"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import React from "react"

interface HeaderProps {
  setOpen: (openState: { formType: string; state: boolean }) => void
  RouteIdData: Array<{ label: string; value: string; color?: string }>
  RouteIdDropdown: string
  setRouteIdDropdown: (value: string) => void
  RouteNameData: Array<{ label: string; value?: string; searchLabel?: string }>
  RouteNameDropDown: string
  setRouteNameDropDown: (value: string) => void
  RouteTypeData: Array<{ label: string; value: string; color?: string }>
  RouteTypeDropDown: string[]
  setRouteTypeDropDown: (values: string[]) => void
  showBrand?: boolean
  RouteBrandData?: Array<{ label: string; value: string }>
  RouteBrandDropDown?: string[]
  setRouteBrandDropDown?: (values: string[]) => void
  onResetFilters?: () => void
  isResetDisabled?: boolean
}

const Header: React.FC<HeaderProps> = (props) => {
  const {
    RouteIdData,
    setOpen,
    RouteIdDropdown,
    setRouteIdDropdown,
    RouteNameData,
    RouteNameDropDown,
    setRouteNameDropDown,
    RouteTypeData,
    RouteTypeDropDown,
    setRouteTypeDropDown,
    showBrand,
    RouteBrandData,
    RouteBrandDropDown,
    setRouteBrandDropDown,
    onResetFilters,
    isResetDisabled: isResetDisabledProp,
  } = props

  const brandVisible = Boolean(showBrand && setRouteBrandDropDown && RouteBrandData)

  const isResetDisabled =
    isResetDisabledProp !== undefined
      ? isResetDisabledProp
      : (!RouteIdDropdown || RouteIdDropdown.trim() === "") &&
        (!RouteNameDropDown || RouteNameDropDown.trim() === "") &&
        (!RouteTypeDropDown || RouteTypeDropDown.length === 0)

  const handleReset = () => {
    setRouteIdDropdown("")
    setRouteNameDropDown("")
    setRouteTypeDropDown([])
    if (setRouteBrandDropDown) setRouteBrandDropDown([])
    if (onResetFilters) {
      onResetFilters()
    }
  }

  const handleOpen = ({ formType }: { formType: string }) => {
    setOpen({ formType, state: true })
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col sm:flex-col md:flex-row lg:flex-row lg:items-center lg:justify-start gap-4 w-full">
        <Button
          variant="outline"
          onClick={() => handleOpen({ formType: "add" })}
          className="w-full md:w-auto flex items-center justify-center"
        >
          <BiPlus className="mr-2 h-5 w-5" />
          Route
        </Button>
        <Button
          disabled={isResetDisabled}
          variant="outline"
          onClick={handleReset}
          className="w-full md:w-auto flex items-center justify-center"
        >
          <BiReset className="mr-2 h-5 w-5" />
          Reset
        </Button>
      </div>
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1 ${
          brandVisible ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <div className="col-span-1">
          {RouteNameData ? (
            <Combobox
              options={RouteNameData.map((item) => ({
                value: item.value || item.label,
                label: item.label,
                searchLabel: item.searchLabel,
              }))}
              Message="Route Name"
              value={RouteNameDropDown}
              setValue={(val) => setRouteNameDropDown(val || "")}
            />
          ) : (
            <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
          )}
        </div>
        <div className="col-span-1">
          {RouteIdData ? (
            <Combobox
              options={RouteIdData}
              Message="Route ID"
              value={RouteIdDropdown}
              setValue={(val) => setRouteIdDropdown(val || "")}
            />
          ) : (
            <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
          )}
        </div>
        <div className="col-span-1">
          {RouteTypeData ? (
            <MultiSelect
              options={RouteTypeData}
              onValueChange={(newValue) => setRouteTypeDropDown(newValue)}
              defaultValue={RouteTypeDropDown}
              placeholder="Route Type"
            />
          ) : (
            <Skeleton className="h-12 rounded-md" />
          )}
        </div>
        {brandVisible && (
          <div className="col-span-1">
            <MultiSelect
              options={RouteBrandData!}
              onValueChange={(newValue) => setRouteBrandDropDown!(newValue)}
              defaultValue={RouteBrandDropDown || []}
              placeholder="Brand"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default Header
