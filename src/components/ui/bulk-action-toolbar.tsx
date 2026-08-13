import * as React from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  totalMatching: number;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
  primaryActions: BulkAction[];
  overflowActions?: BulkAction[];
  itemLabel?: string;
  className?: string;
}

export function BulkActionToolbar({
  selectedCount,
  totalMatching,
  onSelectAllMatching,
  onClearSelection,
  primaryActions,
  overflowActions = [],
  itemLabel = "selected",
  className,
}: BulkActionToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 animate-fade-in", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full hover:bg-muted/60 transition-colors"
          >
            <Checkbox checked className="pointer-events-none" />
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedCount} {itemLabel}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {totalMatching > selectedCount && (
            <DropdownMenuItem onClick={onSelectAllMatching}>
              Select all {totalMatching} matching
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onClearSelection}>Clear selection</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-5 w-px bg-border" />

      <div className="flex flex-wrap items-center gap-1.5">
        {primaryActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="rounded-full bg-background font-normal"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}

        {overflowActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full h-9 w-9 bg-background">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(action.destructive && "text-destructive focus:text-destructive")}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
