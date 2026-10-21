import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tone = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  brand: "bg-accent text-accent-foreground",
};

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: tone.neutral,
        destructive: tone.danger,
        outline: "border border-border text-foreground",
        neutral: tone.neutral,
        brand: tone.brand,
        success: tone.success,
        warning: tone.warning,
        info: tone.info,
        danger: tone.danger,
        // Ticket status
        new: tone.info,
        in_process: tone.warning,
        completed: tone.success,
        denied: tone.danger,
        escalated: tone.danger,
        // Payment
        paid: tone.success,
        unpaid: tone.warning,
        refunded: tone.warning,
        // Stage
        lodged: tone.info,
        return_pending: tone.warning,
        return_received: tone.info,
        warehouse_approved: tone.success,
        warehouse_denied: tone.danger,
        exchange_booked: tone.info,
        exchange_completed: tone.success,
        invoicing_pending: tone.warning,
        invoiced: tone.success,
        to_be_refunded: tone.warning,
        closed: tone.neutral,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Show a leading status dot in the current text colour. */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
