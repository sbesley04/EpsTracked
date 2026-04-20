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
import { getSummary } from "@/lib/data";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/narrative", label: "Narrative", icon: BookOpen },
  { href: "/events", label: "Events", icon: List },
  { href: "/entities", label: "Entities", icon: Users },
  { href: "/flagged", label: "Flagged", icon: AlertTriangle },
  { href: "/threads", label: "Threads", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const summary = getSummary();

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col border-r z-30"
      style={{ background: "#12121a", borderColor: "#2a2a3e" }}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b" style={{ borderColor: "#2a2a3e" }}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #6366f1, #ef4444)" }}
          >
            ET
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "#e4e4ef" }}>
              EpsTracked
            </h1>
            <p className="text-xs" style={{ color: "#9999b5" }}>
              Document Analysis
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? "rgba(99, 102, 241, 0.12)" : "transparent",
                color: isActive ? "#a5b4fc" : "#9999b5",
              }}
            >
              <Icon size={18} />
              {item.label}
              {item.label === "Flagged" && (
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
                >
                  {summary.flaggedEvents.toLocaleString()}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-6 py-4 border-t text-xs"
        style={{ borderColor: "#2a2a3e", color: "#9999b5" }}
      >
        <p>
          {summary.totalEvents.toLocaleString()} events ·{" "}
          {summary.totalEntities.toLocaleString()} entities
        </p>
        <p className="mt-1">{summary.totalThreads.toLocaleString()} threads</p>
      </div>
    </aside>
  );
}
