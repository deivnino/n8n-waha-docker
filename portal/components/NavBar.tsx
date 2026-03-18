"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const NAV_ITEMS = [
  { href: "/qr",        label: "QR",        icon: "📱" },
  { href: "/dashboard", label: "Dashboard",  icon: "📊" },
  { href: "/upload",    label: "Archivos",   icon: "📁" },
  { href: "/settings",  label: "Config",     icon: "⚙️" },
];

function NavBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <nav className="flex bg-slate-900 border-b border-slate-800 px-2 pt-2 pb-1 gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={`${item.href}?token=${token}`}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs transition-colors
              ${active
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function NavBar() {
  return (
    <Suspense fallback={<div className="h-14 bg-slate-900 border-b border-slate-800" />}>
      <NavBarInner />
    </Suspense>
  );
}
