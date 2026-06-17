import type { ReactNode } from "react";
import { AuthProvider } from "../lib/client-context.js";
import "./globals.css";

export const metadata = {
  title: "AssetX",
  description: "Image Asset Management System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
