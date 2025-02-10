import React from "react"
import useMediaQuery from "react-use-media-query-ts"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogTitle,
  DialogContent,
} from "@/components/ui/dialog"

const FormPopup = ({ children, setOpenValue, OpenValue }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setOpenValue({ formType: null, state: false })
    }
  }

  return isDesktop ? (
    <Dialog open={OpenValue.state} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogTitle className="hidden" />
        <DrawerDescription className="hidden" />
        {children}
      </DialogContent>
    </Dialog>
  ) : (
    <Drawer open={OpenValue.state} onOpenChange={handleOpenChange}>
      <DrawerContent className="flex flex-col max-h-screen overflow-hidden">
        <DrawerHeader className="hidden">
          <DrawerTitle />
          <DrawerDescription />
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export default FormPopup
