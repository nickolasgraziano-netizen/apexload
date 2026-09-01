"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  displayName: string | null;
}

interface Identity {
  provider: string;
  id: string;
}

export default function AccountSettings({ email, displayName }: Props) {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasGoogle = identities.some((identity) => identity.provider === "google");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "linked") {
      setNotice("Google is now linked to this ApexLoad account.");
    }

    const supabase = createClient();
    supabase.auth.getUserIdentities().then(({ data, error: identityError }) => {
      if (identityError) {
        setError(identityError.message);
      } else {
        setIdentities((data?.identities ?? []) as Identity[]);
      }
      setLoading(false);
    });
  }, []);

  async function linkGoogle() {
    setError(null);
    setNotice(null);
    setLinking(true);

    const supabase = createClient();
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          "/account?google=linked"
        )}`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    setLinking(false);
    if (linkError) {
      setError(
        linkError.message.toLowerCase().includes("manual")
          ? "Manual identity linking must be enabled in Supabase before Google can be linked."
          : linkError.message
      );
    }
  }

  return (
    <section className="apex-section flex flex-col gap-4">
      <div className="apex-card-soft">
        <p className="apex-section-title">Signed in as</p>
        <p className="mt-2 text-lg font-semibold text-chalk-100">
          {displayName || "ApexLoad user"}
        </p>
        <p className="mt-1 text-sm text-chalk-500">{email}</p>
      </div>

      <div className="apex-card-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="apex-section-title">Google login</p>
            <p className="mt-2 text-lg font-semibold text-chalk-100">
              {loading ? "Checking..." : hasGoogle ? "Linked" : "Not linked"}
            </p>
            <p className="mt-1 text-sm leading-6 text-chalk-500">
              Link Google while signed in here so future Google logins use this same account and
              keep your saved workouts.
            </p>
          </div>
          <span className={hasGoogle ? "apex-chip-hot" : "apex-chip"}>
            {hasGoogle ? "Active" : "Off"}
          </span>
        </div>

        {notice && <p className="mt-4 text-sm leading-6 text-copper-400">{notice}</p>}
        {error && <p className="mt-4 text-sm leading-6 text-tungsten-400">{error}</p>}

        <button
          type="button"
          onClick={linkGoogle}
          disabled={loading || linking || hasGoogle}
          className="mt-5 w-full rounded-lg bg-copper-500 px-4 py-3 font-semibold text-steel-950 disabled:opacity-50"
        >
          {hasGoogle ? "Google linked" : linking ? "Opening Google..." : "Link Google account"}
        </button>
      </div>
    </section>
  );
}
