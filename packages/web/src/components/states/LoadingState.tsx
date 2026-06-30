import { Skeleton } from "@/components/ui/skeleton";

type LoadingStateProps = Readonly<{
  title?: string;
  description?: string;
}>;

export function LoadingState({
  title = "Loading",
  description = "Preparing your workspace..."
}: LoadingStateProps): JSX.Element {
  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </section>
  );
}
