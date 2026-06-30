import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function HomePage(): JSX.Element {
  return (
    <main className="container flex min-h-screen items-center py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>ToroAtlas UX Tool Shell</CardTitle>
          <CardDescription>
            Next.js App Router, strict TypeScript, Tailwind, and reusable UI
            primitives are now scaffolded.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Open Dashboard Placeholder</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">Open Unauthenticated Placeholder</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
