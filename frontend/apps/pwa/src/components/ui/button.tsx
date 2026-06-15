import * as React from "react"
import { cn } from "@/lib/utils"
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'default' | 'outline' | 'ghost'; size?: 'default' | 'sm' | 'lg' }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const base = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = { default: "liquid-metal px-6 py-3", outline: "border border-outline-variant text-on-surface-variant hover:bg-white/5 px-4 py-2", ghost: "text-on-surface-variant hover:bg-white/5 px-4 py-2" }
  const sizes = { default: "", sm: "text-xs px-3 py-1.5", lg: "text-base px-8 py-4" }
  return <button className={cn(base, variants[variant], sizes[size], className)} ref={ref} {...props} />
})
Button.displayName = "Button"
export { Button }
