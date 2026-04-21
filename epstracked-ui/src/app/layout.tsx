import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "EpsTracked — Document Analysis Dashboard",
  description:
    "Interactive dashboard for exploring extracted events, entities, and trafficking indicators from the Epstein document corpus.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full flex"
        style={{
          background: "#0a0a0f",
          color: "#e4e4ef",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <Sidebar />
        <MobileNav />
        <main className="flex-1 md:ml-64 min-h-screen pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:pt-0 pb-20 md:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}
