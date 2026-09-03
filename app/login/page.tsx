"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

const NATIVE_AUTH_CALLBACK_URL = "com.apexload.app://auth/callback";

function getAuthErrorMessage(errorCode: string | null, errorDescription: string | null) {
  const decodedDescription = errorDescription?.replace(/\+/g, " ");

  if (errorCode === "pkce_verifier_missing") {
    return "That Google sign-in attempt expired. Tap Continue with Google to start a fresh sign-in.";
  }

  if (errorCode === "access_denied") {
    return "Google sign-in was canceled. Tap Continue with Google when you're ready to try again.";
  }

  if (errorCode === "otp_expired") {
    return "That email link is invalid or has expired. Request a fresh link and use the newest email.";
  }

  if (decodedDescription?.toLowerCase().includes("expired")) {
    return "That sign-in link expired or was already used. Start a fresh sign-in to continue.";
  }

  return "That sign-in attempt could not be completed. Start a fresh sign-in to continue.";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const appUrlListener = App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(NATIVE_AUTH_CALLBACK_URL)) return;

      setOauthLoading(true);
      await Browser.close().catch(() => {});

      const callbackUrl = new URL(url);
      const errorCode = callbackUrl.searchParams.get("error_code") || callbackUrl.searchParams.get("error");
      const errorDescription = callbackUrl.searchParams.get("error_description");

      if (errorCode || errorDescription) {
        setOauthLoading(false);
        setAuthLinkError(getAuthErrorMessage(errorCode, errorDescription));
        return;
      }

      const code = callbackUrl.searchParams.get("code");
      if (!code) {
        setOauthLoading(false);
        setAuthLinkError(getAuthErrorMessage("callback_failed", null));
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      setOauthLoading(false);
      if (error) {
        setAuthLinkError(
          getAuthErrorMessage(
            error.message.toLowerCase().includes("code verifier") ? "pkce_verifier_missing" : "callback_failed",
            null
          )
        );
        return;
      }

      router.push("/");
      router.refresh();
    });
    const browserFinishedListener = Browser.addListener("browserFinished", () => {
      setOauthLoading(false);
    });

    return () => {
      appUrlListener.then((handle) => handle.remove());
      browserFinishedListener.then((handle) => handle.remove());
    };
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVerified(params.get("verified") === "1");
    setVerificationFailed(params.get("error") === "verification");
    setPasswordReset(params.get("reset") === "1");
    const errorDescription = params.get("error_description");
    const errorCode = params.get("error_code");
    if (params.get("error") === "auth" || errorDescription || errorCode) {
      setAuthLinkError(getAuthErrorMessage(errorCode, errorDescription));
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const origin = window.location.origin;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setNotice("Check your email to verify your account, then come back and sign in.");
    setMode("signin");
    setName("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleGoogleSignIn() {
    setError(null);
    setNotice(null);
    setVerified(false);
    setVerificationFailed(false);
    setPasswordReset(false);
    setAuthLinkError(null);
    setOauthLoading(true);

    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    const supabase = createClient();
    const isNativeApp = Capacitor.isNativePlatform();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: isNativeApp ? NATIVE_AUTH_CALLBACK_URL : `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: isNativeApp,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (isNativeApp && !oauthError) {
      if (data.url) {
        await Browser.open({ url: data.url });
      } else {
        setOauthLoading(false);
        setAuthLinkError(getAuthErrorMessage("callback_failed", null));
      }
      return;
    }

    setOauthLoading(false);
    if (oauthError) {
      setError(
        oauthError.message.toLowerCase().includes("provider")
          ? "Google sign-in is not configured yet."
          : oauthError.message
      );
    }
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
      {verified && (
        <p className="mt-4 rounded-lg border border-copper-500/60 bg-copper-500/10 px-4 py-3 text-center text-sm text-copper-400">
          Email verified. Sign in to start tracking.
        </p>
      )}
      {verificationFailed && (
        <p className="mt-4 rounded-lg border border-tungsten-500/60 bg-tungsten-600/10 px-4 py-3 text-center text-sm text-tungsten-400">
          Verification link failed or expired. Try signing up again or request a new link.
        </p>
      )}
      {passwordReset && (
        <p className="mt-4 rounded-lg border border-copper-500/60 bg-copper-500/10 px-4 py-3 text-center text-sm text-copper-400">
          Password updated. Sign in with your new password.
        </p>
      )}
      {authLinkError && (
        <p className="mt-4 rounded-lg border border-tungsten-500/60 bg-tungsten-600/10 px-4 py-3 text-center text-sm text-tungsten-400">
          {authLinkError}
        </p>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={oauthLoading || loading}
        className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-steel-600 bg-chalk-100 px-4 py-3 font-semibold text-steel-950 active:bg-chalk-300 disabled:opacity-50"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
        >
          <path
            fill="#4285F4"
            d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.1 3.2v2.7h3.4c2-1.8 3.4-4.5 3.4-7.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.9 0 5.3-.9 7.1-2.6l-3.4-2.7c-1 .6-2.2 1-3.7 1-2.8 0-5.1-1.9-6-4.4H2.5v2.8C4.3 20.6 7.9 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M6 14.3c-.2-.6-.3-1.3-.3-2.1s.1-1.5.3-2.1V7.3H2.5C1.8 8.8 1.4 10.4 1.4 12.2s.4 3.4 1.1 4.9L6 14.3z"
          />
          <path
            fill="#EA4335"
            d="M12 5.7c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.3 2.5 14.9 1.5 12 1.5 7.9 1.5 4.3 3.9 2.5 7.3L6 10.1c.9-2.5 3.2-4.4 6-4.4z"
          />
        </svg>
        {oauthLoading ? "Connecting..." : "Continue with Google"}
      </button>

      <div className="mt-6 flex w-full items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-steel-700" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">or</span>
        <div className="h-px flex-1 bg-steel-700" />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
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
        {notice && <p className="text-sm leading-6 text-copper-400">{notice}</p>}

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
          setNotice(null);
          setConfirmPassword("");
        }}
        className="mt-6 text-center font-mono text-sm text-chalk-500"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
      {mode === "signin" && (
        <a href="/forgot-password" className="mt-4 text-center font-mono text-xs uppercase tracking-widest text-copper-400">
          Forgot password?
        </a>
      )}
    </main>
  );
}
