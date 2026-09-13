import { NextRequest } from "next/server";
import { requireUser, serviceClient, failure, check } from "@/lib/admin/server";
import {
  RequestError,
  choice,
  text,
  screenPath,
  imageType,
  sameOrigin,
} from "@/lib/admin/validation";
export async function POST(request: NextRequest) {
  let stored: string | null = null;
  try {
    sameOrigin(request);
    const { user, client } = await requireUser();
    const enabled = await client.rpc("apex_feature_enabled", {
      feature: "feedback",
    });
    check(enabled.error);
    if (!enabled.data)
      throw new RequestError("Feedback is currently unavailable.", 403);
    if (Number(request.headers.get("content-length")) > 4 * 1024 * 1024)
      throw new RequestError("Screenshot must be under 3 MB.", 413);
    const db = serviceClient();
    const recent = await db
      .from("feedback_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());
    check(recent.error);
    if ((recent.count ?? 0) >= 10)
      throw new RequestError(
        "You can submit up to 10 reports per hour. Please try again later.",
        429,
      );
    const form = await request.formData();
    const row = {
      user_id: user.id,
      category: choice(form.get("category"), ["issue", "idea"]),
      title: text(form.get("title"), "Title", 120),
      description: text(form.get("description"), "Details", 4000),
      screen: screenPath(form.get("screen")),
      platform: choice(form.get("platform"), ["Android", "iOS", "Web"]),
      app_version: text(form.get("version"), "Version", 40),
    };
    const file = form.get("screenshot");
    if (file instanceof File && file.size > 0) {
      if (file.size > 3 * 1024 * 1024)
        throw new RequestError("Screenshot must be under 3 MB.", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = imageType(bytes);
      if (!type) throw new RequestError("Choose a PNG, JPEG, or WebP image.");
      stored = `${user.id}/${crypto.randomUUID()}.${type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp"}`;
      const upload = await db.storage
        .from("feedback-screenshots")
        .upload(stored, bytes, { contentType: type, upsert: false });
      check(upload.error);
    }
    const result = await db
      .from("feedback_reports")
      .insert({ ...row, screenshot_path: stored })
      .select("id")
      .single();
    check(result.error);
    if (!result.data) throw new Error("Report not saved");
    return Response.json({ id: result.data.id });
  } catch (e) {
    if (stored)
      await serviceClient()
        .storage.from("feedback-screenshots")
        .remove([stored])
        .catch(() => {});
    return failure(e);
  }
}
