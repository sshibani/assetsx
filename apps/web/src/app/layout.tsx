import type { ReactNode } from "react";
import type { Viewport } from "next";
import { AuthProvider } from "../lib/client-context";
import { AppShell } from "../components/app-shell";
import "./globals.css";

export const metadata = {
  title: "AssetX",
  description: "Image Asset Management System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
