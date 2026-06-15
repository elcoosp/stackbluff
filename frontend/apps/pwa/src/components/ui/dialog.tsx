import * as React from "react"
import { cn } from "@/lib/utils"
const Dialog = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", className)} {...props} />)
Dialog.displayName = "Dialog"
const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => <button ref={ref} {...props} />)
DialogTrigger.displayName = "DialogTrigger"
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface-container border border-white/10 rounded-xl p-6 shadow-2xl", className)} {...props}>{children}</div>
))
DialogContent.displayName = "DialogContent"
export { Dialog, DialogTrigger, DialogContent }
