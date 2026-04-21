"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  Users,
  AlertTriangle,
  FileText,
  BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/narrative", label: "Narrative", icon: BookOpen },
  { href: "/events", label: "Events", icon: List },
  { href: "/entities", label: "Entities", icon: Users },
  { href: "/flagged", label: "Flagged", icon: AlertTriangle },
  { href: "/threads", label: "Threads", icon: FileText },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar — logo only */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 border-b flex items-center"
        style={{
          background: "#12121a",
          borderColor: "#2a2a3e",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ background: "linear-gradient(135deg, #6366f1, #ef4444)" }}
          >
            ET
          </div>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
              EpsTracked
            </h1>
          </div>
        </Link>
      </header>

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{
          background: "#12121a",
          borderColor: "#2a2a3e",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
                style={{
                  color: isActive ? "#a5b4fc" : "#9999b5",
                }}
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
