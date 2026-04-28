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
  DialogDescription,
} from "@/components/ui/dialog"

const FormPopup = ({ children, setOpenValue, OpenValue }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const openedAtRef = React.useRef(0)
  const isOpen = OpenValue?.state === true;

  React.useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now()
    }
  }, [isOpen])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setOpenValue({ formType: null, state: false })
    }
  }

  const preventImmediateOutsideClose = (event: Event) => {
    if (Date.now() - openedAtRef.current < 150) {
      event.preventDefault()
    }
  }

  return isDesktop ? (
    <>
      <style>{`
        [data-radix-portal] > div[data-state] {
          z-index: 600 !important;
        }
      `}</style>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto z-[600]"
          onPointerDownOutside={preventImmediateOutsideClose}
          onInteractOutside={preventImmediateOutsideClose}
        >
          <DialogTitle className="hidden" />
          <DialogDescription className="hidden" />
          {children}
        </DialogContent>
      </Dialog>
    </>
  ) : (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent
        className="flex flex-col max-h-[90vh] overflow-hidden z-[600]"
        onPointerDownOutside={preventImmediateOutsideClose}
      >
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
