"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminKey, clearAdminKey } from "@/lib/adminClient";

const links = [{ href: "/", label: "Bán hàng" }];

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
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      pathname === href
        ? "bg-sky-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-2 flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-slate-800">
          <span className="text-xl">🥤</span>
          <span>
            Water<span className="text-sky-600">Tina</span>
          </span>
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
            className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Đăng xuất admin
          </button>
        ) : (
          <Link
            href="/admin"
            className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            🔒 Admin
          </Link>
        )}
      </div>
    </header>
  );
}
