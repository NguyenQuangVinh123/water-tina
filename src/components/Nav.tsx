"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminKey, clearAdminKey } from "@/lib/adminClient";

const links = [{ href: "/", label: "Bán hàng" }];

const adminLinks = [
  { href: "/analytics", label: "Phân tích" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/toppings", label: "Topping" },
];

export default function Nav() {
  const [admin, setAdmin] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setAdmin(!!getAdminKey());
  }, [pathname]);

  const logout = () => {
    clearAdminKey();
    setAdmin(false);
    router.push("/");
  };

  const all = admin ? [...links, ...adminLinks] : links;

  const cls = (href: string) =>
    `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      pathname === href
        ? "bg-sky-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-base font-extrabold tracking-tight text-slate-800 sm:text-lg"
        >
          <span className="text-lg sm:text-xl">🥤</span>
          <span className="hidden sm:inline">
            Water<span className="text-sky-600">Tina</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {all.map((l) => (
            <Link key={l.href} href={l.href} className={cls(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
        {admin ? (
          <button
            onClick={logout}
            className="shrink-0 whitespace-nowrap rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:px-3.5 sm:py-1.5"
          >
            <span className="sm:hidden">Thoát</span>
            <span className="hidden sm:inline">Đăng xuất admin</span>
          </button>
        ) : (
          <Link
            href="/admin"
            className="shrink-0 whitespace-nowrap rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 sm:px-3.5 sm:py-1.5"
          >
            🔒 Admin
          </Link>
        )}
      </div>
    </header>
  );
}
