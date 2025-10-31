import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luna Control Center",
  description:
    "Operational dashboard for Luna AI Discord bot with Horizon UI styling.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className="gradient-bg min-h-screen">
        {children}
      </body>
    </html>
  );
}
