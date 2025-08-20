import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button";

// Simple, reusable pagination component (exported as PaginationSimple)
export function PaginationSimple({ totalPages, page, onPageChange, maxVisible = 5 }: { totalPages: number; page: number; onPageChange: (p: number) => void; maxVisible?: number; }) {
  const nodes: React.ReactNode[] = [];
  nodes.push(
    <Button key="prev" variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
      Anterior
    </Button>
  );

  if (totalPages <= maxVisible) {
    for (let p = 1; p <= totalPages; p++) {
      nodes.push(
        <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm" onClick={() => onPageChange(p)} className={page === p ? '' : 'bg-white'}>
          {p}
        </Button>
      );
    }
  } else {
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, Math.min(page - half, totalPages - maxVisible + 1));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (start > 1) {
      nodes.push(
        <Button key={1} variant={page === 1 ? 'default' : 'outline'} size="sm" onClick={() => onPageChange(1)} className={page === 1 ? '' : 'bg-white'}>
          1
        </Button>
      );
      if (start > 2) nodes.push(<span key="lead-ellipsis" className="px-2">...</span>);
    }

    for (let p = start; p <= end; p++) {
      nodes.push(
        <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm" onClick={() => onPageChange(p)} className={page === p ? '' : 'bg-white'}>
          {p}
        </Button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) nodes.push(<span key="trail-ellipsis" className="px-2">...</span>);
      nodes.push(
        <Button key={totalPages} variant={page === totalPages ? 'default' : 'outline'} size="sm" onClick={() => onPageChange(totalPages)} className={page === totalPages ? '' : 'bg-white'}>
          {totalPages}
        </Button>
      );
    }
  }

  nodes.push(
    <Button key="next" variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
      Próxima
    </Button>
  );

  return <div className="flex items-center gap-1">{nodes}</div>;
}

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
