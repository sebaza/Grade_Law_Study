"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart2,
  BookOpen,
  Dumbbell,
  GraduationCap,
  History,
  Home,
  LogIn,
  Menu,
  Scale,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/admin/questions", label: "Banco", Icon: BookOpen },
  { href: "/practice", label: "Practicar", Icon: Dumbbell },
  { href: "/exam", label: "Simulacro", Icon: GraduationCap },
  { href: "/history", label: "Historial", Icon: History },
  { href: "/history#estadisticas", label: "Estadísticas", Icon: BarChart2 },
  { href: "/auth/login", label: "Ingresar", Icon: LogIn },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function close() {
    setIsOpen(false);
  }

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
              <p>Preparate. Exponé. Aprobá.</p>
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

        <nav className="nav" aria-label="Navegación principal">
          {navItems.map(({ href, label, Icon }) => {
            const basePath = href.split("#")[0];
            const isActive =
              basePath === "/" ? pathname === "/" : pathname.startsWith(basePath);
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

        <div className="sidebar-footer">
          <div className="avatar">AV</div>
          <div>
            <strong>Estudiante</strong>
            <br />
            Examen de grado
          </div>
        </div>
      </aside>
    </>
  );
}
