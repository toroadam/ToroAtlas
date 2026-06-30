import { PlusCircle } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { Button } from "@/components/ui/button";

export default function DashboardPage(): JSX.Element {
  return (
    <EmptyState
      title="Dashboard modules are not connected yet"
      description="This shell is ready for future dashboard widgets, data queries, and tenant-scoped insights."
      icon={<PlusCircle className="h-6 w-6" />}
      action={<Button>Define first dashboard widget</Button>}
    />
  );
}
