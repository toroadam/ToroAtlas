import { Settings2 } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";

export default function SettingsPage(): JSX.Element {
  return (
    <EmptyState
      title="Settings are scaffolded"
      description="Environment, tenant preferences, and integration controls will plug into this route in downstream features."
      icon={<Settings2 className="h-6 w-6" />}
    />
  );
}
