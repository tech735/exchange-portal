import * as React from "react";

interface InfoCardProps {
  title: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function InfoCard({ title, icon: Icon, action, children }: InfoCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <Icon className="w-3.5 h-3.5" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export function Field({ label, value, mono, className }: FieldProps) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

export function DetailNavHeader({
  index,
  total,
  onNavigate,
}: {
  index: number;
  total: number;
  onNavigate: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 sm:px-6 h-12 border-b border-border shrink-0">
      <NavButton disabled={index <= 0} onClick={() => onNavigate(index - 1)} direction="prev" />
      <NavButton disabled={index >= total - 1} onClick={() => onNavigate(index + 1)} direction="next" />
      <span className="text-xs text-muted-foreground ml-1">
        {index + 1} of {total}
      </span>
    </div>
  );
}

function NavButton({ disabled, onClick, direction }: { disabled: boolean; onClick: () => void; direction: 'prev' | 'next' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      className="h-7 w-7 rounded-full flex items-center justify-center text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
      {direction === 'prev' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      )}
    </button>
  );
}
