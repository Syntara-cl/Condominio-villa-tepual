"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

const DialogContext = React.createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>({})

function Dialog({ children, open, onOpenChange }: any) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({ children, asChild, ...props }: any) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <div onClick={() => onOpenChange?.(true)} {...props}>
      {children}
    </div>
  )
}

function DialogPortal({ children }: any) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function DialogClose({ children, asChild, ...props }: any) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <div onClick={() => onOpenChange?.(false)} {...props}>
      {children}
    </div>
  )
}

function DialogOverlay({ className, ...props }: any) {
  const { open, onOpenChange } = React.useContext(DialogContext)
  if (!open) return null
  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/40 backdrop-blur-sm",
        className
      )}
      style={{ zIndex: 9998 }}
      onClick={() => onOpenChange?.(false)}
      {...props}
    />
  )
}

function DialogContent({ className, children, showCloseButton = true, ...props }: any) {
  const { open, onOpenChange } = React.useContext(DialogContext)
  if (!open) return null

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[calc(100vw-2rem)] sm:max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6",
          className
        )}
        style={{ zIndex: 9999 }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            className="absolute right-4 top-4 rounded-lg p-1 opacity-60 hover:opacity-100 hover:bg-slate-100 transition-all focus:outline-none"
            onClick={() => onOpenChange?.(false)}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </button>
        )}
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: any) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: any) {
  return (
    <div
      className={cn(
        // max-sm: el footer es un flex VERTICAL, y ahi un hijo con `flex-1` recibe
        // flex-basis:0 sobre la altura y pisa su propio h-11/h-12, dejandolo en ~36px.
        // `basis-auto` devuelve el control a la altura declarada; `min-h-11` garantiza
        // el minimo tactil de 44px aunque el shorthand `flex` gane el orden de cascada.
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 max-sm:[&>*]:basis-auto max-sm:[&>*]:min-h-11",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: any) {
  return (
    <h3
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: any) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
