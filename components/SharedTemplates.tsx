"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function SharedTemplates({
  items,
}: {
  items: { id: string; name: string; description: string }[];
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  if (!items.length) return null;
  return (
    <section className="apex-section">
      <h2 className="apex-section-title mb-3">Starter routines</h2>
      {error && (
        <p role="alert" className="apex-copy">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {items.map((t) => (
          <article key={t.id} className="apex-card">
            <h3 className="font-semibold">{t.name}</h3>
            <p className="apex-copy">{t.description}</p>
            <button
              className="admin-button mt-3"
              disabled={!!busy}
              onClick={async () => {
                setBusy(t.id);
                setError("");
                const { data, error } = await createClient().rpc(
                  "copy_shared_workout",
                  { template: t.id },
                );
                if (error) {
                  setError("Unable to copy this routine. Please try again.");
                  setBusy("");
                  return;
                }
                router.push(`/workout/plan/${data}`);
                router.refresh();
              }}
            >
              {busy === t.id ? "Adding…" : "Add to my templates"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
