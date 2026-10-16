import { cn } from "@/lib/utils";

/** Page title + action buttons. Actions wrap below the title instead of running off narrow screens. */
export function PageHeader({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-10 flex-wrap items-center justify-between gap-3", className)}>
      <h2 className="text-2xl font-bold">{title}</h2>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
