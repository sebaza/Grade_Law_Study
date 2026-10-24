"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(Boolean(data.user)));
  }, []);

  async function authenticate(mode: "login" | "signup") {
    setIsLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const action = mode === "login"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });

    const { error } = await action;
    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setIsLoggedIn(true);
    setMessage(mode === "login" ? "Sesión iniciada. Entrando..." : "Usuario creado. Si se exige confirmación, revisa tu correo.");

    if (mode === "login") {
      const adminResponse = await fetch("/api/admin/stats").catch(() => null);
      router.push(adminResponse?.ok ? "/admin" : "/practice");
      router.refresh();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await authenticate("login");
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setMessage("Sesión cerrada.");
    router.refresh();
  }

  return (
    <main className="auth-shell book-auth-shell">
      <section className="auth-card auth-book-card">
        <Link className="back-link" href="/">← Volver al inicio</Link>
        <p className="auth-book-kicker">Acceso a tu progreso</p>
        <h1>Inicia sesión o crea tu cuenta</h1>
        <p className="auth-card-intro">
          Inicia sesión para continuar con tu progreso, o crea una cuenta para guardar tus intentos,
          porcentajes, preguntas dominadas y preguntas para repaso.
        </p>

        <form className="auth-form auth-book-form" onSubmit={submit} aria-busy={isLoading}>
          <label>
            Correo
            <input type="email" name="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Contraseña
            <input type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          </label>

          <div className="practice-actions">
            <button className="auth-signin-action" type="submit" disabled={isLoading}>{isLoading ? "Procesando..." : "Iniciar sesión"}</button>
            <button className="secondary auth-signup-action" type="button" disabled={isLoading} onClick={(event) => {
              if (event.currentTarget.form?.reportValidity()) void authenticate("signup");
            }}>
              Crear una cuenta
            </button>
            {isLoggedIn && <button className="secondary" type="button" onClick={signOut}>Cerrar sesión</button>}
          </div>
          <p className="auth-signup-hint">¿Aún no tienes cuenta? Usa «Crear una cuenta»; se validarán estos mismos datos.</p>
        </form>

        {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
      </section>
    </main>
  );
}
