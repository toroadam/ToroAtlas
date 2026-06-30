import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}>;

export function EmptyState({
  title,
  description,
  action,
  icon,
  className
}: EmptyStateProps): JSX.Element {
  return (
    <section
      className={cn(
        "flex min-h-60 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center",
        className
      )}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </section>
  );
}
