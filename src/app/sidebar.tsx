"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart2,
  BookOpen,
  Dumbbell,
  GraduationCap,
  History,
  Home,
  LogIn,
  LogOut,
  Menu,
  Scale,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ThemeToggle } from "./theme-toggle";

const baseNavItems = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/questions", label: "Banco", Icon: BookOpen },
  { href: "/practice", label: "Practicar", Icon: Dumbbell },
  { href: "/exam", label: "Simulacro", Icon: GraduationCap },
  { href: "/history", label: "Historial y estadísticas", Icon: History },
] as const;

type SidebarUser = { fullName: string; email: string | null };

function initialsFrom(user: SidebarUser) {
  const source = user.fullName?.trim() || user.email || "Estudiante";
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const metaName = data.user.user_metadata?.full_name;
      setUser({
        fullName: typeof metaName === "string" && metaName.trim() ? metaName : data.user.email?.split("@")[0] ?? "Estudiante",
        email: data.user.email ?? null,
      });
      fetch("/api/admin/stats")
        .then((response) => {
          if (!cancelled) setIsAdmin(response.ok);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function close() {
    setIsOpen(false);
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    close();
    router.push("/");
    router.refresh();
  }

  const navItems = [
    ...baseNavItems,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", Icon: BarChart2 } as const] : []),
  ];

  return (
    <>
      <button
        className="hamburger-btn"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>

      {isOpen && (
        <div className="sidebar-overlay" onClick={close} aria-hidden="true" />
      )}

      <aside className={`sidebar${isOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <Scale size={26} strokeWidth={1.5} />
            </div>
            <div>
              <h1>
                Grado
                <br />
                Derecho
              </h1>
              <p>Prepara. Expón. Aprueba.</p>
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-account">
          {user ? (
            <>
              <div className="avatar">{initialsFrom(user)}</div>
              <div className="sidebar-user">
                <strong>{user.fullName}</strong>
                {user.email && <span>{user.email}</span>}
              </div>
              <button className="sidebar-signout" type="button" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut size={18} strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <Link className="nav-item sidebar-login" href="/auth/login" onClick={close}>
              <LogIn size={18} strokeWidth={1.8} />
              Iniciar sesión
            </Link>
          )}
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {navItems.map(({ href, label, Icon }) => {
            const basePath = href.split("#")[0];
            const isActive =
              basePath === "/" || basePath === "/admin"
                ? pathname === basePath
                : pathname.startsWith(basePath);
            return (
              <Link
                key={href}
                className={`nav-item${isActive ? " active" : ""}`}
                href={href}
                onClick={close}
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle inline />
      </aside>
    </>
  );
}
