import React from "react"
import useMediaQuery from "react-use-media-query-ts"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Dialog, DialogTitle, DialogContent, DialogDescription } from "@/components/ui/dialog"

const FormPopup = ({ children, setOpenValue, OpenValue, isBusy = false }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const openedAtRef = React.useRef(0)
  const isOpen = OpenValue?.state === true

  React.useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now()
    }
  }, [isOpen])

  const handleOpenChange = (open: boolean) => {
    if (!open && !isBusy) {
      setOpenValue({ formType: null, state: false })
    }
  }

  const preventCloseWhileBusy = (event: Event) => {
    if (isBusy || Date.now() - openedAtRef.current < 150) {
      event.preventDefault()
    }
  }

  return isDesktop ? (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col overflow-visible p-0"
        onPointerDownOutside={preventCloseWhileBusy}
        onInteractOutside={preventCloseWhileBusy}
        hideCloseButton={isBusy}
      >
        <DialogTitle className="hidden" />
        <DialogDescription className="hidden" />
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </DialogContent>
    </Dialog>
  ) : (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent
        className="flex flex-col max-h-[90vh] overflow-visible"
        onPointerDownOutside={preventCloseWhileBusy}
      >
        <DrawerHeader className="hidden">
          <DrawerTitle />
          <DrawerDescription />
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

export default FormPopup
