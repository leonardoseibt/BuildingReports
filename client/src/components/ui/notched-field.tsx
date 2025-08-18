"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface NotchedFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  requiredMark?: boolean
  children: React.ReactNode
}

export function NotchedField({ label, requiredMark, children, className, ...props }: NotchedFieldProps) {
  return (
    <div className={cn("relative rounded-md border bg-white px-2.5 pb-2 pt-2.5 focus-within:border-foreground", className)} {...props}>
      <span className="pointer-events-none absolute -top-2 left-2 inline-flex items-center gap-1 bg-white px-1 text-xs text-muted-foreground">
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
