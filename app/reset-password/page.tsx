"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=1");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Image
        src="/logo.png"
        alt="ApexLoad"
        width={200}
        height={131}
        priority
        unoptimized
        className="h-auto w-[200px]"
      />
      <h1 className="mt-4 text-center font-display text-3xl font-extrabold text-chalk-100">
        Choose new password
      </h1>

      {checkingSession ? (
        <p className="mt-6 text-sm text-chalk-500">Checking reset link...</p>
      ) : !hasSession ? (
        <div className="mt-6 rounded-lg border border-tungsten-500/60 bg-tungsten-600/10 px-4 py-3 text-center">
          <p className="text-sm leading-6 text-tungsten-400">
            This reset link is missing, invalid, or expired.
          </p>
          <Link href="/forgot-password" className="mt-3 inline-block font-mono text-xs uppercase tracking-widest text-copper-400">
            Send a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              New password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Confirm password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
            />
          </label>

          {error && <p className="text-sm text-copper-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-copper-500 px-4 py-3 font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save new password"}
          </button>
        </form>
      )}
    </main>
  );
}
