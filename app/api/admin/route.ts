import { NextRequest } from "next/server";
import { requireAdmin, check, failure } from "@/lib/admin/server";
import {
  RequestError,
  text,
  choice,
  uuid,
  email,
  safeUrl,
  sameOrigin,
} from "@/lib/admin/validation";
export const dynamic = "force-dynamic";
const sections = [
  "overview",
  "feedback",
  "users",
  "invitations",
  "exercises",
  "templates",
  "content",
  "features",
  "activity",
] as const;
export async function GET(request: NextRequest) {
  try {
    const { db } = await requireAdmin();
    const section = choice(
      request.nextUrl.searchParams.get("section") || "overview",
      sections,
    );
    const page = Math.max(
      1,
      Math.min(
        10000,
        Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1),
      ),
    );
    if (section === "overview") {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const queries = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }),
        db
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .gte("ended_at", since),
        db
          .from("feedback_reports")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved"),
        db
          .from("admin_invitations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString()),
        db
          .from("admin_activity")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      queries.forEach((r) => check(r.error));
      return Response.json({
        members: queries[0].count,
        workouts: queries[1].count,
        reports: queries[2].count,
        invitations: queries[3].count,
        activity: queries[4].data,
      });
    }
    if (section === "users") {
      const { data, error } = await db.auth.admin.listUsers({
        page,
        perPage: 30,
      });
      check(error);
      const ids = data.users.map((u) => u.id);
      const [a, m] = await Promise.all([
        db.from("account_access").select("user_id,status").in("user_id", ids),
        db.from("admin_members").select("user_id").in("user_id", ids),
      ]);
      check(a.error);
      check(m.error);
      return Response.json({
        items: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          name:
            u.user_metadata?.display_name || u.user_metadata?.full_name || "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          status: a.data?.find((x) => x.user_id === u.id)?.status || "active",
          admin: m.data?.some((x) => x.user_id === u.id),
        })),
        more: data.users.length === 30,
      });
    }
    if (section === "exercises") {
      const [ex, g] = await Promise.all([
        db.from("exercises").select("*").is("owner_id", null).order("name"),
        db
          .from("muscle_groups")
          .select("id,name")
          .is("owner_id", null)
          .order("name"),
      ]);
      check(ex.error);
      check(g.error);
      return Response.json({ items: ex.data, groups: g.data });
    }
    const table = {
      feedback: "feedback_reports",
      invitations: "admin_invitations",
      templates: "shared_workout_templates",
      content: "app_content",
      features: "app_features",
      activity: "admin_activity",
    }[section];
    const { data, error } = await db
      .from(table)
      .select("*")
      .order(["content", "features"].includes(section) ? "key" : "created_at", {
        ascending: ["content", "features"].includes(section),
      })
      .range((page - 1) * 30, page * 30 - 1);
    check(error);
    if (section === "feedback") {
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      const p = await db
        .from("profiles")
        .select("id,display_name")
        .in("id", ids);
      check(p.error);
      return Response.json({
        items: (data ?? []).map((r) => ({
          ...r,
          display_name:
            p.data?.find((x) => x.id === r.user_id)?.display_name || "User",
        })),
        more: data?.length === 30,
      });
    }
    return Response.json({ items: data, more: data?.length === 30 });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const { db, user } = await requireAdmin();
    const b = await request.json();
    const action = text(b.action, "Action", 50);
    const stamp = { updated_by: user.id, updated_at: new Date().toISOString() };
    if (action === "feedback") {
      const result = await db
        .from("feedback_reports")
        .update({
          ...stamp,
          status: choice(b.status, ["new", "reviewing", "planned", "resolved"]),
          priority: choice(b.priority, ["low", "normal", "high"]),
          admin_note: text(b.admin_note ?? "", "Note", 2000, false),
        })
        .eq("id", uuid(b.id))
        .select("id")
        .single();
      check(result.error);
      return Response.json(result.data);
    }
    if (action === "screenshot") {
      const result = await db
        .from("feedback_reports")
        .select("screenshot_path")
        .eq("id", uuid(b.id))
        .single();
      check(result.error);
      if (!result.data?.screenshot_path)
        throw new RequestError("No screenshot attached.", 404);
      const signed = await db.storage
        .from("feedback-screenshots")
        .createSignedUrl(result.data.screenshot_path, 300);
      check(signed.error);
      return Response.json({ url: signed.data?.signedUrl });
    }
    if (action === "access") {
      const id = uuid(b.id);
      const status = choice(b.status, ["active", "suspended"]);
      const a = await db
        .from("admin_members")
        .select("user_id")
        .eq("user_id", id)
        .maybeSingle();
      check(a.error);
      if (a.data || id === user.id)
        throw new RequestError("Admin accounts cannot be paused here.");
      const c = await db
        .from("account_access")
        .select("status")
        .eq("user_id", id)
        .maybeSingle();
      check(c.error);
      if (c.data && ["pending", "revoked"].includes(c.data.status))
        throw new RequestError("Manage this account through its invitation.");
      const r = await db
        .from("account_access")
        .upsert({ user_id: id, status, ...stamp });
      check(r.error);
      return Response.json({ ok: true });
    }
    if (action === "exercise") {
      const group = uuid(b.muscle_group_id);
      const g = await db
        .from("muscle_groups")
        .select("id")
        .eq("id", group)
        .is("owner_id", null)
        .maybeSingle();
      check(g.error);
      if (!g.data) throw new RequestError("Choose a global muscle group.");
      const rest = Number(b.default_rest_seconds);
      if (!Number.isInteger(rest) || rest < 0 || rest > 1800)
        throw new RequestError("Rest must be 0–1800 seconds.");
      const row = {
        name: text(b.name, "Name", 120),
        muscle_group_id: group,
        equipment: text(b.equipment ?? "", "Equipment", 100, false),
        instructions: text(b.instructions ?? "", "Instructions", 2000, false),
        demonstration_url: safeUrl(b.demonstration_url),
        default_rest_seconds: rest,
        is_cardio: b.is_cardio === true,
        is_unilateral: b.is_unilateral === true,
        updated_by: user.id,
      };
      const query = b.id
        ? db
            .from("exercises")
            .update({ ...row, sub_muscle_id: null })
            .eq("id", uuid(b.id))
            .is("owner_id", null)
        : db
            .from("exercises")
            .insert({ ...row, owner_id: null, is_custom: false });
      const r = await query.select("id").single();
      check(r.error);
      return Response.json(r.data);
    }
    if (action === "template") {
      if (
        !Array.isArray(b.exercise_ids) ||
        b.exercise_ids.length < 1 ||
        b.exercise_ids.length > 50
      )
        throw new RequestError("Choose 1–50 exercises.");
      const ids = b.exercise_ids.map(uuid);
      if (new Set(ids).size !== ids.length)
        throw new RequestError("Choose each exercise once.");
      const ex = await db
        .from("exercises")
        .select("id")
        .in("id", ids)
        .is("owner_id", null);
      check(ex.error);
      if (ex.data?.length !== ids.length)
        throw new RequestError("Use exercises from the global catalog.");
      const row = {
        name: text(b.name, "Name", 120),
        description: text(b.description ?? "", "Description", 1500, false),
        exercise_ids: ids,
        published: b.published === true,
        ...stamp,
      };
      const query = b.id
        ? db.from("shared_workout_templates").update(row).eq("id", uuid(b.id))
        : db.from("shared_workout_templates").insert(row);
      const r = await query.select("id").single();
      check(r.error);
      return Response.json(r.data);
    }
    if (action === "content") {
      const r = await db.from("app_content").upsert({
        key: choice(b.key, ["announcement", "encouragement"]),
        title: text(b.title ?? "", "Title", 120, false),
        body: text(b.body, "Message", 1500, b.published === true),
        published: b.published === true,
        ...stamp,
      });
      check(r.error);
      return Response.json({ ok: true });
    }
    if (action === "feature") {
      const r = await db
        .from("app_features")
        .update({
          audience: choice(b.audience, ["off", "admin", "everyone"]),
          ...stamp,
        })
        .eq(
          "key",
          choice(b.key, ["feedback", "shared_templates", "announcements"]),
        );
      check(r.error);
      return Response.json({ ok: true });
    }
    if (action === "invite" || action === "resend") {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL || "https://apexload-azure.vercel.app";
      let invitation: any;
      if (action === "resend") {
        const r = await db
          .from("admin_invitations")
          .select("*")
          .eq("id", uuid(b.id))
          .single();
        check(r.error);
        invitation = r.data;
        if (!["pending", "failed"].includes(invitation.status))
          throw new RequestError("This invitation cannot be resent.");
        if (
          invitation.sent_at &&
          Date.now() - Date.parse(invitation.sent_at) < 60000
        )
          throw new RequestError("Wait one minute before resending.", 429);
      } else {
        const r = await db
          .from("admin_invitations")
          .insert({
            email: email(b.email),
            display_name: text(b.name, "Name", 100),
            message: text(b.message ?? "", "Message", 1000, false),
            ...stamp,
          })
          .select()
          .single();
        if (r.error?.code === "23505")
          throw new RequestError(
            "There is already a pending invitation for this email.",
          );
        check(r.error);
        invitation = r.data;
      }
      // Failed deliveries may be retried; the auth trigger must still gate newly created users.
      if (invitation.status === "failed") {
        const r = await db
          .from("admin_invitations")
          .update({ status: "sending", ...stamp })
          .eq("id", invitation.id);
        check(r.error);
      }
      // A recipient may have verified the first email without finishing setup.
      // Send an implicit magic link for that pending account rather than trying
      // to invite an already-confirmed Auth user again.
      const redirectTo = `${origin}/auth/callback?next=/auth/setup`;
      const { data, error } = invitation.user_id
        ? await db.auth.signInWithOtp({
            email: invitation.email,
            options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
          })
        : await db.auth.admin.inviteUserByEmail(invitation.email, {
            data: {
              display_name: invitation.display_name,
              apex_invitation_id: invitation.id,
            },
            redirectTo,
          });
      if (error) {
        const r = await db
          .from("admin_invitations")
          .update({
            status: invitation.status === "pending" ? "pending" : "failed",
            delivery_error:
              "Check SMTP settings, email address, and whether the account already exists.",
            ...stamp,
          })
          .eq("id", invitation.id);
        check(r.error);
        throw new RequestError(
          "Invitation could not be emailed. Check the email address, existing account, and Supabase SMTP settings.",
          502,
        );
      }
      const id = invitation.user_id || data.user?.id;
      if (!id) throw new Error("Invitation returned no user");
      const gate = await db
        .from("account_access")
        .select("status")
        .eq("user_id", id)
        .maybeSingle();
      check(gate.error);
      if (!gate.data || gate.data.status !== "pending")
        throw new RequestError(
          "This account is not awaiting invitation setup.",
        );
      const r = await db
        .from("admin_invitations")
        .update({
          user_id: id,
          status: "pending",
          sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          delivery_error: null,
          ...stamp,
        })
        .eq("id", invitation.id)
        .in("status", ["sending", "pending"])
        .select("id")
        .single();
      check(r.error);
      return Response.json({ ok: true });
    }
    if (action === "revoke") {
      const r = await db.rpc("revoke_apex_invitation", {
        invitation_id: uuid(b.id),
        actor: user.id,
      });
      check(r.error);
      return Response.json({ ok: true });
    }
    throw new RequestError("Unknown action.");
  } catch (e) {
    return failure(e);
  }
}
