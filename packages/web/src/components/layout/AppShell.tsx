import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav, type NavItem } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";

type AppShellProps = Readonly<{
  children: ReactNode;
  navItems?: NavItem[];
}>;

export default function AppShell({
  children,
  navItems
}: AppShellProps): JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-wide">
              ToroAtlas UX Tool
            </Link>
            <AppNav items={navItems} />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/sign-in">Sign out</Link>
          </Button>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
