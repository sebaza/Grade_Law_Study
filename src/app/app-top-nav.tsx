"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Dumbbell, GraduationCap, History, Home, Scale } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const studentNavItems = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/practice", label: "Practicar", Icon: Dumbbell },
  { href: "/exam", label: "Simulacro", Icon: GraduationCap },
  { href: "/questions", label: "Banco", Icon: BookOpen },
  { href: "/history", label: "Historial", Icon: History },
] as const;

export function AppTopNav() {
  const pathname = usePathname();

  return (
    <header className="app-top-nav">
      <Link className="top-nav-brand" href="/">
        <span className="top-nav-mark"><Scale size={20} strokeWidth={1.7} /></span>
        <span>Grado Derecho</span>
      </Link>

      <nav className="top-nav-links" aria-label="Navegaci?n principal del estudiante">
        {studentNavItems.map(({ href, label, Icon }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

          return (
            <Link className={`top-nav-link${isActive ? " active" : ""}`} href={href} key={href}>
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="top-nav-actions">
        <ThemeToggle inline />
      </div>
    </header>
  );
}
