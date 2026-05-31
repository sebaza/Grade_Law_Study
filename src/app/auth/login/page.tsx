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
    setMessage(mode === "login" ? "Sesión iniciada. Redirigiendo a práctica..." : "Usuario creado. Si Supabase exige confirmación, revisá tu correo.");

    if (mode === "login") {
      router.push("/practice");
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
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="back-link" href="/">← Volver al inicio</Link>
        <h1>Ingreso de estudiante</h1>
        <p>
          Para la práctica real necesitamos identificar a la estudiante: así se guardan intentos,
          porcentajes, preguntas dominadas y preguntas para repaso.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label>
            Correo
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          </label>

          <div className="practice-actions">
            <button type="submit" disabled={isLoading}>{isLoading ? "Procesando..." : "Entrar"}</button>
            <button className="secondary" type="button" disabled={isLoading} onClick={() => authenticate("signup")}>
              Crear cuenta
            </button>
            {isLoggedIn && <button className="secondary" type="button" onClick={signOut}>Cerrar sesión</button>}
          </div>
        </form>

        {message && <p className="auth-message">{message}</p>}
      </section>
    </main>
  );
}
