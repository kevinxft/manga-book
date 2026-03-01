import { cn } from '@renderer/lib/utils';

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  const bounded = Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary/70', className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}
