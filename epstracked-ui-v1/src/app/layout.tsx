import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "EpsTracked — Document Analysis Dashboard",
  description:
    "Interactive dashboard for exploring extracted events, entities, and trafficking indicators from the Epstein document corpus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex" style={{ background: "#0a0a0f", color: "#e4e4ef", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
