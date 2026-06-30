import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";

type AuthedLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AuthedLayout({
  children
}: AuthedLayoutProps): JSX.Element {
  return <AppShell>{children}</AppShell>;
}
