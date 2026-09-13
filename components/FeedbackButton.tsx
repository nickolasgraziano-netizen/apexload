"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
export default function FeedbackButton() {
  const path = usePathname(),
    dialog = useRef<HTMLDialogElement>(null);
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    let active = true;
    const db = createClient();
    void db.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        if (active) setEnabled(false);
        return;
      }
      const { data: on } = await db.rpc("apex_feature_enabled", {
        feature: "feedback",
      });
      if (active) setEnabled(on === true);
    });
    return () => {
      active = false;
    };
  }, [path]);
  useEffect(() => {
    dialog.current?.close();
  }, [path]);
  if (
    !enabled ||
    path.startsWith("/auth") ||
    [
      "/login",
      "/forgot-password",
      "/reset-password",
      "/access-paused",
    ].includes(path)
  )
    return null;
  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = new FormData(e.currentTarget);
      data.set("screen", path);
      data.set(
        "platform",
        Capacitor.getPlatform() === "android"
          ? "Android"
          : Capacitor.getPlatform() === "ios"
            ? "iOS"
            : "Web",
      );
      data.set("version", "1.1");
      const file = data.get("screenshot");
      if (file instanceof File && file.size > 3 * 1024 * 1024)
        throw new Error("Choose an image under 3 MB.");
      const r = await fetch("/api/feedback", { method: "POST", body: data });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Feedback could not be sent.");
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSent(false);
          setError("");
          dialog.current?.showModal();
        }}
        className="fixed bottom-24 right-4 z-30 rounded-full border border-steel-600 bg-steel-900 px-4 py-3 text-xs font-semibold shadow-lg"
        aria-label="Report an issue or suggest an improvement"
      >
        Feedback
      </button>
      <dialog ref={dialog} className="feedback-dialog">
        <div className="flex justify-between items-center gap-3">
          <h2 className="apex-title-sm">Help improve ApexLoad</h2>
          <button
            className="admin-button"
            aria-label="Close feedback"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        {sent ? (
          <div role="status">
            <p className="mt-5">Thanks—your feedback has been sent.</p>
            <p className="apex-copy">We’ll review it in the admin inbox.</p>
            <button
              className="admin-primary mt-4"
              onClick={() => dialog.current?.close()}
            >
              Back to workout
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <label className="admin-field">
              What’s on your mind?
              <select name="category">
                <option value="issue">Report an issue</option>
                <option value="idea">Suggest an improvement</option>
              </select>
            </label>
            <label className="admin-field">
              Short title
              <input name="title" required maxLength={120} />
            </label>
            <label className="admin-field">
              Details
              <textarea
                name="description"
                required
                maxLength={4000}
                placeholder="What happened, and what did you expect?"
              />
            </label>
            <label className="admin-field">
              Screenshot (optional, up to 3 MB)
              <input
                type="file"
                name="screenshot"
                accept="image/png,image/jpeg,image/webp"
              />
            </label>
            <p className="apex-copy">
              Includes this screen, platform, and app version. Check screenshots
              for personal details before attaching.
            </p>
            {error && (
              <p role="alert" className="admin-alert">
                {error}
              </p>
            )}
            <button className="admin-primary mt-5 w-full" disabled={busy}>
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
