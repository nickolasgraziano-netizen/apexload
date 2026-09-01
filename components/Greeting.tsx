"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { firstNameFrom } from "@/lib/motivation";

interface Props {
  userId: string;
  displayName: string | null;
  message: string;
}

export default function Greeting({ userId, displayName, message }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", userId);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="" width={28} height={28} unoptimized className="h-7 w-7" />
          <p className="apex-kicker">ApexLoad</p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="apex-input-compact"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-copper-500 px-3 py-2 text-xs font-semibold text-steel-950 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setName(displayName ?? "");
              setEditing(false);
            }}
            className="apex-secondary-button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Image src="/logo-mark.png" alt="" width={28} height={28} unoptimized className="h-7 w-7" />
        <p className="apex-kicker">ApexLoad</p>
      </div>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none text-chalk-100">
        Welcome back, {firstNameFrom(displayName)}{" "}
        <button
          onClick={() => setEditing(true)}
          className="align-middle font-mono text-xs font-normal text-chalk-500 underline"
        >
          edit
        </button>
        <Link
          href="/account"
          className="ml-2 align-middle font-mono text-xs font-normal text-chalk-500 underline"
        >
          account
        </Link>
      </h1>
      <p className="mt-2 max-w-[19rem] text-sm leading-6 text-tungsten-400">{message}</p>
    </div>
  );
}
