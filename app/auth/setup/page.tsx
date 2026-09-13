"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
export default function Setup() {
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [welcome, setWelcome] = useState("");
  useEffect(() => {
    const db = createClient();
    void (async () => {
      try {
        const hash = new URLSearchParams(location.hash.slice(1));
        if (hash.get("access_token") && hash.get("refresh_token")) {
          const r = await db.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          history.replaceState(null, "", location.pathname);
          if (r.error)
            throw new Error(
              "This link is invalid or expired. Ask the administrator for a fresh invitation.",
            );
        }
        const { data } = await db.auth.getUser();
        if (!data.user)
          throw new Error("Open the setup link from your invitation email.");
        const info = await db.rpc("apex_invitation_info");
        if (info.error || !info.data)
          throw new Error(
            "This invitation is expired, revoked, or already accepted. Try signing in or ask the administrator for help.",
          );
        setWelcome(info.data.message);
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    if (data.get("password") !== data.get("confirm")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const db = createClient();
      const updated = await db.auth.updateUser({
        password: String(data.get("password")),
      });
      if (updated.error) throw updated.error;
      const result = await db.rpc("accept_apex_invitation");
      if (result.error)
        throw new Error(
          "This invitation expired, was revoked, or is already accepted. Try signing in or ask the administrator for help.",
        );
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="apex-page">
      <p className="apex-kicker">Welcome to ApexLoad</p>
      <h1 className="apex-title">Set up your account</h1>
      <p className="apex-copy">
        Choose a password to use on the website and Android app.
      </p>
      {welcome && (
        <p className="apex-card mt-4 whitespace-pre-wrap">{welcome}</p>
      )}
      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {done ? (
        <>
          <p className="mt-6" role="status">
            Your account is ready.
          </p>
          <Link href="/" className="admin-primary inline-block mt-5">
            Open ApexLoad
          </Link>
          <p className="apex-copy">
            On Android, open your installed ApexLoad app and sign in with the
            same email and password. Ask the administrator for the Android
            installer if you don’t have it yet.
          </p>
        </>
      ) : ready ? (
        <form onSubmit={submit}>
          <label className="admin-field">
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <label className="admin-field">
            Confirm password
            <input
              name="confirm"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="admin-primary mt-5" disabled={busy}>
            {busy ? "Saving…" : "Finish setup"}
          </button>
        </form>
      ) : !error ? (
        <p className="apex-copy">Checking your invitation…</p>
      ) : null}
      <Link href="/login" className="block mt-6 text-copper-400">
        Back to sign in
      </Link>
    </main>
  );
}
