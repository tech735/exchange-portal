import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        info: "border-transparent bg-info/15 text-info",
        // Exchange ticket status variants
        new: "border-transparent bg-info/15 text-info",
        in_process: "border-transparent bg-warning/15 text-warning",
        completed: "border-transparent bg-success/15 text-success",
        denied: "border-transparent bg-destructive/15 text-destructive",
        escalated: "border-transparent bg-destructive/15 text-destructive",
        // Payment status
        paid: "border-transparent bg-success/15 text-success",
        unpaid: "border-transparent bg-warning/15 text-warning",
        refunded: "border-transparent bg-warning/15 text-warning",
        // Stage variants
        lodged: "border-transparent bg-info/15 text-info",
        return_pending: "border-transparent bg-warning/15 text-warning",
        return_received: "border-transparent bg-info/15 text-info",
        warehouse_approved: "border-transparent bg-success/15 text-success",
        warehouse_denied: "border-transparent bg-destructive/15 text-destructive",
        exchange_booked: "border-transparent bg-info/15 text-info",
        exchange_completed: "border-transparent bg-success/15 text-success",
        invoicing_pending: "border-transparent bg-warning/15 text-warning",
        invoiced: "border-transparent bg-success/15 text-success",
        to_be_refunded: "border-transparent bg-warning/15 text-warning",
        closed: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
