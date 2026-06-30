import type { ReactNode } from "react";

type UnauthedLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function UnauthedLayout({
  children
}: UnauthedLayoutProps): JSX.Element {
  return (
    <div className="container flex min-h-screen items-center justify-center py-12">
      {children}
    </div>
  );
}
