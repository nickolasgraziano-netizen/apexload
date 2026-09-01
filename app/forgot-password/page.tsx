"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function friendlyResetError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit")) {
    return "Too many reset emails were requested. Wait a few minutes, then try again.";
  }
  return message;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(friendlyResetError(resetError.message));
      return;
    }

    setNotice("If that email is registered, a password reset link is on the way.");
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
        Reset password
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm leading-6 text-chalk-500">
        Enter your email and we&apos;ll send you a secure link to choose a new password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
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

        {error && <p className="text-sm text-copper-400">{error}</p>}
        {notice && <p className="text-sm leading-6 text-copper-400">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-copper-500 px-4 py-3 font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <Link href="/login" className="mt-6 text-center font-mono text-sm text-chalk-500">
        Back to sign in
      </Link>
    </main>
  );
}
