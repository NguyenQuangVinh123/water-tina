"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminKey, clearAdminKey } from "@/lib/adminClient";

const links = [
  { href: "/", label: "Bán hàng" },
  { href: "/orders", label: "Đơn hàng" },
];

const adminLinks = [
  { href: "/analytics", label: "Phân tích" },
  { href: "/products", label: "Sản phẩm" },
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
    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
      pathname === href
        ? "bg-sky-600 text-white"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-2 text-lg font-bold text-sky-700">
          🥤 WaterTina
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {all.map((l) => (
            <Link key={l.href} href={l.href} className={cls(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
        {admin ? (
          <button
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Đăng xuất admin
          </button>
        ) : (
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            🔒 Admin
          </Link>
        )}
      </div>
    </header>
  );
}
