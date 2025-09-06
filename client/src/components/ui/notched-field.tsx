"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface NotchedFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  requiredMark?: boolean
  children: React.ReactNode
  labelClassName?: string
}

export function NotchedField({ label, requiredMark, children, className, labelClassName, ...props }: NotchedFieldProps) {
  return (
  <div
    className={cn(
      "notched-field relative rounded-md border border-slate-200 bg-white px-2 pb-1.5 pt-2 transition-colors",
      "focus-within:border-blue-500 focus-within:shadow-[0_0_0_2px_rgba(59,130,246,0.2)]",
      className
    )}
    {...props}
  >
      <span className={cn("pointer-events-none absolute -top-2 left-2 inline-flex items-center gap-1 bg-white px-1 text-xs text-muted-foreground", labelClassName)}>
        {label}
        {requiredMark ? <span className="text-red-500">*</span> : null}
      </span>
      <div className="relative">
        {children}
      </div>
    </div>
  )
}

export default NotchedField
