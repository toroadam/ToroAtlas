import { LoadingState } from "@/components/states/LoadingState";

export default function Loading(): JSX.Element {
  return (
    <LoadingState
      title="Loading workspace"
      description="Preparing authenticated shell content..."
    />
  );
}
