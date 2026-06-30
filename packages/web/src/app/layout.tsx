import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getRuntimeConfig } from "@/config/env";
import { AppProviders } from "@/app/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ToroAtlas UX Tool",
  description: "Foundational shell for the ToroAtlas UX Tool."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  const runtimeConfig = getRuntimeConfig();

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders runtimeConfig={runtimeConfig}>{children}</AppProviders>
      </body>
    </html>
  );
}
