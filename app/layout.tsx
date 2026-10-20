import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "RenderMonitor — Uptime monitoring", description: "Monitor websites and APIs, inspect uptime history, and measure response times." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
