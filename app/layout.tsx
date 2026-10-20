import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Render Keepalive Monitor",
  description:
    "Scheduled health checks and uptime history for Render web services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
