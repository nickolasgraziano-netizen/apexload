"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: authError } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Image
        src="/logo.png"
        alt="ApexLoad"
        width={220}
        height={144}
        priority
        unoptimized
        className="h-auto w-[220px]"
      />
      <h1 className="mt-4 text-center font-display text-3xl font-extrabold text-chalk-100">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
        {mode === "signup" && (
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
          />
        </label>
        {mode === "signup" && (
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Confirm password
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
            />
          </label>
        )}

        {error && <p className="text-sm text-copper-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-copper-500 px-4 py-3 font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
        >
          {loading ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setConfirmPassword("");
        }}
        className="mt-6 text-center font-mono text-sm text-chalk-500"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
