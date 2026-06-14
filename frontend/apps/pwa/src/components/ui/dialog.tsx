import * as React from "react"
import { cn } from "../../lib/utils"
const Dialog = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("fixed inset-0 z-50 flex items-center justify-center", className)} {...props} />)
Dialog.displayName = "Dialog"
const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => <button ref={ref} {...props} />)
DialogTrigger.displayName = "DialogTrigger"
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => <div ref={ref} className={cn("fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-background p-6 shadow-lg rounded-lg", className)} {...props}>{children}</div>)
DialogContent.displayName = "DialogContent"
export { Dialog, DialogTrigger, DialogContent }
