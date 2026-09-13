"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
type Row = Record<string, any>;
const tabs = [
  ["overview", "Overview"],
  ["feedback", "Feedback"],
  ["users", "Users & invites"],
  ["exercises", "Exercises"],
  ["templates", "Templates"],
  ["content", "App content"],
  ["features", "Feature controls"],
  ["activity", "Activity log"],
];
const names: Record<string, string> = {
  feedback: "In-app feedback",
  shared_templates: "Shared starter routines",
  announcements: "Announcements & encouragement",
};
const date = (v: string) => (v ? new Date(v).toLocaleString() : "Not yet");
const label = (v: string) => v.replaceAll("_", " ");
async function api(section: string, page = 1, signal?: AbortSignal) {
  const r = await fetch(`/api/admin?section=${section}&page=${page}`, {
    cache: "no-store",
    signal,
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || "Unable to load admin data.");
  return b;
}
export default function AdminDashboard() {
  const [tab, setTab] = useState("overview"),
    [userTab, setUserTab] = useState("users"),
    [page, setPage] = useState(1),
    [data, setData] = useState<Row>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [form, setForm] = useState<Row | null>(null),
    [catalog, setCatalog] = useState<Row[]>([]),
    [filter, setFilter] = useState("all"),
    [image, setImage] = useState("");
  const section = tab === "users" ? userTab : tab;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const d = await api(section, page, signal);
        if (!signal?.aborted) setData({ ...d, section });
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [section, page],
  );
  useEffect(() => {
    const c = new AbortController();
    setForm(null);
    setImage("");
    setData({});
    setError("");
    setNotice("");
    void refresh(c.signal);
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    if (tab !== "templates") return;
    const c = new AbortController();
    api("exercises", 1, c.signal)
      .then((d) => setCatalog(d.items))
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [tab]);
  function navigate(v: string) {
    setTab(v);
    setPage(1);
    setForm(null);
  }
  async function mutate(body: Row, message = "Saved.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Unable to save.");
      if (body.action === "screenshot") {
        setImage(result.url);
        return true;
      }
      setForm(null);
      setNotice(message);
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const items: Row[] = data.items ?? [];
  const update = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  const field = (
    key: string,
    title: string,
    kind = "text",
    options?: Row[],
  ) => (
    <label className="admin-field" key={key}>
      {title}
      {kind === "textarea" ? (
        <textarea
          aria-label={title}
          maxLength={key === "admin_note" ? 2000 : 1500}
          value={form?.[key] ?? ""}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : kind === "select" ? (
        <select
          aria-label={title}
          required
          value={form?.[key] ?? ""}
          onChange={(e) => update(key, e.target.value)}
        >
          <option value="" disabled>
            Choose…
          </option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label={title}
          type={kind}
          required={
            !["equipment", "demonstration_url", "message"].includes(key)
          }
          maxLength={kind === "email" ? 254 : kind === "url" ? 1000 : 120}
          min={kind === "number" ? 0 : undefined}
          max={kind === "number" ? 1800 : undefined}
          value={form?.[key] ?? ""}
          onChange={(e) => update(key, e.target.value)}
        />
      )}
    </label>
  );
  const options = (values: string[]) =>
    values.map((value) => ({ value, label: label(value) }));
  const cancel = (
    <button
      type="button"
      className="admin-button"
      onClick={() => setForm(null)}
    >
      Cancel
    </button>
  );
  const submit = (
    <button className="admin-primary" disabled={busy}>
      {busy ? "Saving…" : "Save changes"}
    </button>
  );
  const activity = (rows: Row[]) => (
    <div className="admin-card">
      {!rows.length ? (
        <p className="apex-copy">Admin changes will appear here.</p>
      ) : (
        rows.map((r) => (
          <div className="admin-list-row" key={r.id}>
            <div>
              <p className="capitalize">
                {label(r.entity)} · {label(r.action)}
              </p>
              <p className="apex-copy break-all">{r.entity_id}</p>
              <p className="apex-copy">{date(r.created_at)}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
  return (
    <main className="admin-shell">
      <header className="admin-top">
        <Link href="/" className="font-display text-3xl font-extrabold">
          APEX<span className="text-copper-500">LOAD</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="admin-badge">Admin</span>
          <Link href="/" className="admin-button">
            Back to app →
          </Link>
        </div>
      </header>
      <div className="admin-layout">
        <nav aria-label="Admin sections" className="admin-nav">
          {tabs.map(([id, title]) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              disabled={busy}
              aria-current={tab === id ? "page" : undefined}
            >
              {title}
            </button>
          ))}
        </nav>
        <div className="admin-main">
          <p className="apex-kicker">Your app. Your community.</p>
          <h1 className="apex-title mb-6">
            {tabs.find((t) => t[0] === tab)?.[1]}
          </h1>
          {error && (
            <p className="admin-alert" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="admin-alert" role="status">
              {notice}
            </p>
          )}
          {tab === "users" && (
            <div className="admin-toolbar">
              <button
                className="admin-button"
                onClick={() => {
                  setUserTab("users");
                  setPage(1);
                }}
                aria-pressed={userTab === "users"}
              >
                Members
              </button>
              <button
                className="admin-button"
                onClick={() => {
                  setUserTab("invitations");
                  setPage(1);
                }}
                aria-pressed={userTab === "invitations"}
              >
                Invitations
              </button>
              <button
                className="admin-primary"
                onClick={() =>
                  setForm({
                    action: "invite",
                    name: "",
                    email: "",
                    message: "",
                  })
                }
              >
                Invite / add user
              </button>
            </div>
          )}
          {loading || (data.section !== section && !error) ? (
            <p role="status" className="apex-copy">
              Loading…
            </p>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <p className="apex-copy mb-6">
                    A quick look at your community and what needs attention.
                  </p>
                  <div className="admin-stats">
                    {[
                      ["Members", data.members],
                      ["Workouts · last 7 days", data.workouts],
                      ["Open reports", data.reports],
                      ["Pending invites", data.invitations],
                    ].map(([name, value]) => (
                      <div className="admin-card" key={name}>
                        <p className="apex-section-title">{name}</p>
                        <p className="font-display text-4xl mt-2">
                          {value ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="admin-toolbar mt-5">
                    <button
                      className="admin-primary"
                      onClick={() => navigate("feedback")}
                    >
                      Review feedback
                    </button>
                    <button
                      className="admin-button"
                      onClick={() => navigate("users")}
                    >
                      Manage users
                    </button>
                  </div>
                  <h2 className="apex-section-title my-4">Recent changes</h2>
                  {activity(data.activity ?? [])}
                </>
              )}
              {tab === "feedback" && (
                <>
                  <div className="admin-toolbar">
                    <label className="admin-field !mt-0">
                      Show
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All reports</option>
                        <option value="issue">Issues</option>
                        <option value="idea">Ideas</option>
                      </select>
                    </label>
                  </div>
                  <div className="admin-columns">
                    <div className="space-y-3">
                      {items
                        .filter(
                          (r) => filter === "all" || r.category === filter,
                        )
                        .map((r) => (
                          <button
                            className="admin-card w-full text-left"
                            key={r.id}
                            onClick={() => {
                              setForm({ ...r, action: "feedback" });
                              setImage("");
                            }}
                          >
                            <div className="flex justify-between gap-2">
                              <span className="admin-badge">{r.category}</span>
                              <span className="apex-copy !mt-0 capitalize">
                                {r.status}
                              </span>
                            </div>
                            <h2 className="mt-3 font-semibold break-words">
                              {r.title}
                            </h2>
                            <p className="apex-copy">
                              {r.display_name} · {r.screen}
                            </p>
                          </button>
                        ))}
                      {!items.length && (
                        <p className="apex-copy">
                          No feedback yet. Users can submit reports using the
                          Feedback button.
                        </p>
                      )}
                    </div>
                    {form?.action === "feedback" ? (
                      <form
                        className="admin-card"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void mutate(form);
                        }}
                      >
                        <h2 className="text-xl font-semibold break-words">
                          {form.title}
                        </h2>
                        <p className="apex-copy">
                          {date(form.created_at)} · {form.platform} ·{" "}
                          {form.app_version}
                        </p>
                        <p className="my-5 whitespace-pre-wrap break-words">
                          {form.description}
                        </p>
                        {form.screenshot_path && (
                          <button
                            type="button"
                            className="admin-button"
                            disabled={busy}
                            onClick={() =>
                              void mutate({ action: "screenshot", id: form.id })
                            }
                          >
                            View screenshot
                          </button>
                        )}
                        {image && (
                          <a
                            href={image}
                            target="_blank"
                            rel="noreferrer"
                            className="block mt-3"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image}
                              alt="User-submitted screenshot"
                              className="max-w-full rounded-lg"
                            />
                          </a>
                        )}
                        <div className="admin-fields">
                          {field(
                            "status",
                            "Status",
                            "select",
                            options([
                              "new",
                              "reviewing",
                              "planned",
                              "resolved",
                            ]),
                          )}
                          {field(
                            "priority",
                            "Priority",
                            "select",
                            options(["low", "normal", "high"]),
                          )}
                        </div>
                        {field(
                          "admin_note",
                          "Resolution / admin note",
                          "textarea",
                        )}
                        <div className="admin-toolbar mt-4">
                          {submit}
                          {cancel}
                        </div>
                      </form>
                    ) : (
                      <div className="admin-card">
                        <p className="apex-copy">
                          Select a report to review its details and update its
                          status.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {tab === "users" && (
                <>
                  {form?.action === "invite" && (
                    <form
                      className="admin-card mb-5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(
                          form,
                          "Invitation sent. The recipient chooses their own password.",
                        );
                      }}
                    >
                      <h2 className="text-xl font-semibold">
                        Welcome someone to ApexLoad
                      </h2>
                      <p className="apex-copy">
                        Creates a regular user account and emails a setup link.
                        Admin access is never granted through an invitation.
                      </p>
                      <div className="admin-fields">
                        {field("name", "Name")}
                        {field("email", "Email address", "email")}
                      </div>
                      {field(
                        "message",
                        "Welcome message shown during setup (optional)",
                        "textarea",
                      )}
                      <div className="admin-toolbar mt-4">
                        <button className="admin-primary" disabled={busy}>
                          {busy
                            ? "Sending…"
                            : "Create account & send invitation"}
                        </button>
                        {cancel}
                      </div>
                    </form>
                  )}
                  <div className="admin-card">
                    {!items.length && (
                      <p className="apex-copy">
                        No {userTab === "users" ? "users" : "invitations"} to
                        show.
                      </p>
                    )}
                    {items.map((r) => (
                      <div className="admin-list-row" key={r.id}>
                        <div className="min-w-0">
                          <h2 className="font-semibold break-words">
                            {r.name || r.display_name || r.email}
                          </h2>
                          <p className="apex-copy break-all">{r.email}</p>
                          <span className="admin-badge mt-2">
                            {r.admin
                              ? "Admin"
                              : r.status === "pending" &&
                                  r.expires_at &&
                                  Date.parse(r.expires_at) < Date.now()
                                ? "Expired"
                                : r.status}
                          </span>
                          <p className="apex-copy">
                            {userTab === "users"
                              ? `Last sign-in: ${date(r.last_sign_in_at)}`
                              : `Sent: ${date(r.sent_at)} · Expires: ${date(r.expires_at)}`}
                          </p>
                          {r.delivery_error && (
                            <p className="apex-copy text-tungsten-400">
                              {r.delivery_error}
                            </p>
                          )}
                        </div>
                        <div className="admin-toolbar">
                          {userTab === "users" &&
                            !r.admin &&
                            ["active", "suspended"].includes(r.status) && (
                              <button
                                className="admin-button"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    r.status === "suspended" ||
                                    confirm(
                                      `Pause access for ${r.email}? Their workouts will be preserved.`,
                                    )
                                  )
                                    void mutate(
                                      {
                                        action: "access",
                                        id: r.id,
                                        status:
                                          r.status === "suspended"
                                            ? "active"
                                            : "suspended",
                                      },
                                      "Account access updated.",
                                    );
                                }}
                              >
                                {r.status === "suspended"
                                  ? "Restore access"
                                  : "Pause access"}
                              </button>
                            )}
                          {userTab === "invitations" &&
                            ["pending", "failed"].includes(r.status) && (
                              <>
                                <button
                                  className="admin-button"
                                  disabled={busy}
                                  onClick={() =>
                                    void mutate(
                                      { action: "resend", id: r.id },
                                      "Invitation sent again.",
                                    )
                                  }
                                >
                                  Resend
                                </button>
                                <button
                                  className="admin-button"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Revoke the invitation for ${r.email}?`,
                                      )
                                    )
                                      void mutate(
                                        { action: "revoke", id: r.id },
                                        "Invitation revoked.",
                                      );
                                  }}
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "exercises" && (
                <>
                  <button
                    className="admin-primary mb-5"
                    onClick={() =>
                      setForm({
                        action: "exercise",
                        name: "",
                        muscle_group_id: data.groups?.[0]?.id,
                        equipment: "",
                        instructions: "",
                        demonstration_url: "",
                        default_rest_seconds: 90,
                        is_cardio: false,
                        is_unilateral: false,
                      })
                    }
                  >
                    + Add exercise
                  </button>
                  {form?.action === "exercise" && (
                    <form
                      className="admin-card mb-5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(form, "Global exercise saved.");
                      }}
                    >
                      <h2 className="text-xl">
                        {form.id ? "Edit" : "New"} exercise
                      </h2>
                      <div className="admin-fields">
                        {field("name", "Name")}
                        {field(
                          "muscle_group_id",
                          "Muscle group",
                          "select",
                          (data.groups ?? []).map((g: Row) => ({
                            value: g.id,
                            label: g.name,
                          })),
                        )}
                        {field("equipment", "Equipment")}
                        {field(
                          "default_rest_seconds",
                          "Rest (seconds)",
                          "number",
                        )}
                      </div>
                      {field("instructions", "Coaching cues", "textarea")}
                      {field(
                        "demonstration_url",
                        "Demonstration link (HTTPS)",
                        "url",
                      )}
                      <div className="admin-toolbar mt-4">
                        {["is_cardio", "is_unilateral"].map((k) => (
                          <label className="flex items-center gap-2" key={k}>
                            <input
                              type="checkbox"
                              checked={form[k]}
                              onChange={(e) => update(k, e.target.checked)}
                            />
                            {k === "is_cardio"
                              ? "Cardio"
                              : "One side at a time"}
                          </label>
                        ))}
                      </div>
                      <div className="admin-toolbar mt-4">
                        {submit}
                        {cancel}
                      </div>
                    </form>
                  )}
                  <div className="admin-card">
                    {items.map((r) => (
                      <div className="admin-list-row" key={r.id}>
                        <div>
                          <h2 className="font-semibold">{r.name}</h2>
                          <p className="apex-copy">
                            {
                              data.groups?.find(
                                (g: Row) => g.id === r.muscle_group_id,
                              )?.name
                            }{" "}
                            · {r.equipment || "Equipment not specified"}
                          </p>
                          <p className="apex-copy">{r.instructions}</p>
                        </div>
                        <button
                          className="admin-button"
                          onClick={() => setForm({ ...r, action: "exercise" })}
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "templates" && (
                <>
                  <button
                    className="admin-primary mb-5"
                    onClick={() =>
                      setForm({
                        action: "template",
                        name: "",
                        description: "",
                        exercise_ids: [],
                        published: false,
                      })
                    }
                  >
                    + Create template
                  </button>
                  {form?.action === "template" && (
                    <form
                      className="admin-card mb-5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(form, "Shared template saved.");
                      }}
                    >
                      {field("name", "Template name")}
                      {field("description", "Description", "textarea")}
                      <label className="admin-field">
                        Add exercise
                        <select
                          value=""
                          onChange={(e) =>
                            update("exercise_ids", [
                              ...form.exercise_ids,
                              e.target.value,
                            ])
                          }
                        >
                          <option value="">Choose an exercise…</option>
                          {catalog
                            .filter((x) => !form.exercise_ids.includes(x.id))
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <ol className="my-4 space-y-2">
                        {form.exercise_ids.map((id: string, i: number) => (
                          <li key={id} className="admin-list-row">
                            <span>
                              {i + 1}. {catalog.find((x) => x.id === id)?.name}
                            </span>
                            <div className="admin-toolbar">
                              <button
                                type="button"
                                className="admin-button"
                                disabled={i === 0}
                                aria-label="Move exercise up"
                                onClick={() => {
                                  const ids = [...form.exercise_ids];
                                  [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                                  update("exercise_ids", ids);
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="admin-button"
                                onClick={() =>
                                  update(
                                    "exercise_ids",
                                    form.exercise_ids.filter(
                                      (x: string) => x !== id,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <label className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={form.published}
                          onChange={(e) =>
                            update("published", e.target.checked)
                          }
                        />
                        Published for users
                      </label>
                      <div className="admin-toolbar mt-4">
                        {submit}
                        {cancel}
                      </div>
                    </form>
                  )}
                  <div className="space-y-4">
                    {!items.length && (
                      <p className="apex-copy">
                        Create your first starter routine.
                      </p>
                    )}
                    {items.map((r) => (
                      <article className="admin-card" key={r.id}>
                        <div className="flex justify-between gap-3">
                          <h2 className="text-xl font-semibold">{r.name}</h2>
                          <span className="admin-badge">
                            {r.published ? "Published" : "Draft"}
                          </span>
                        </div>
                        <p className="apex-copy">{r.description}</p>
                        <ol className="my-4 list-decimal pl-5">
                          {r.exercise_ids.map((id: string) => (
                            <li key={id}>
                              {catalog.find((x) => x.id === id)?.name ||
                                "Exercise"}
                            </li>
                          ))}
                        </ol>
                        <div className="admin-toolbar">
                          <button
                            className="admin-button"
                            onClick={() =>
                              setForm({ ...r, action: "template" })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="admin-button"
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                {
                                  ...r,
                                  action: "template",
                                  published: !r.published,
                                },
                                "Template visibility updated.",
                              )
                            }
                          >
                            {r.published ? "Unpublish" : "Publish"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {tab === "content" && (
                <div className="space-y-4">
                  {items.map((r) => (
                    <article className="admin-card" key={r.key}>
                      <h2 className="text-xl capitalize">{r.key}</h2>
                      {form && form.key === r.key ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void mutate(form);
                          }}
                        >
                          {field("title", "Heading")}
                          {field("body", "Message", "textarea")}
                          <label className="flex gap-2 mt-4">
                            <input
                              type="checkbox"
                              checked={form.published}
                              onChange={(e) =>
                                update("published", e.target.checked)
                              }
                            />
                            Show on Home
                          </label>
                          <div className="admin-toolbar mt-4">
                            {submit}
                            {cancel}
                          </div>
                        </form>
                      ) : (
                        <>
                          <span className="admin-badge mt-3">
                            {r.published ? "Published" : "Draft"}
                          </span>
                          <h3 className="font-semibold mt-4">{r.title}</h3>
                          <p className="apex-copy whitespace-pre-wrap">
                            {r.body || "No message yet."}
                          </p>
                          <button
                            className="admin-button mt-4"
                            onClick={() => setForm({ ...r, action: "content" })}
                          >
                            Edit content
                          </button>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {tab === "features" && (
                <div className="admin-card">
                  <p className="apex-copy mb-3">
                    Only implemented features appear here. Changes take effect
                    on the next page load.
                  </p>
                  {items.map((r) => (
                    <div className="admin-list-row" key={r.key}>
                      <h2>{names[r.key]}</h2>
                      <label className="admin-field !mt-0">
                        Available to
                        <select
                          disabled={busy}
                          value={r.audience}
                          aria-label="Available to"
                          onChange={(e) =>
                            void mutate(
                              {
                                action: "feature",
                                key: r.key,
                                audience: e.target.value,
                              },
                              "Feature audience updated.",
                            )
                          }
                        >
                          <option value="off">Off</option>
                          <option value="admin">Admins only</option>
                          <option value="everyone">Everyone</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {tab === "activity" && activity(items)}
              {data.more || page > 1 ? (
                <div className="admin-toolbar mt-5">
                  <button
                    className="admin-button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {page}</span>
                  <button
                    className="admin-button"
                    disabled={!data.more}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
