import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SignInPage(): JSX.Element {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Authentication Placeholder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tenant authentication wiring is intentionally deferred. This page
          marks the unauthenticated boundary for future auth integration.
        </p>
        <Separator />
        <Button asChild className="w-full">
          <Link href="/dashboard">Continue to scaffolded app shell</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
