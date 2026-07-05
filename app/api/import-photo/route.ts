import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const EXTRACTION_SYSTEM_PROMPT = `You are reading a photo of a page from someone's handwritten weightlifting log book. Extract the workout into structured JSON.

Use your best judgment to interpret shorthand and abbreviations (e.g. "BP" = Bench Press, "3x8" = 3 sets of 8 reps, "DB" = Dumbbell). Assume weights are in pounds unless a unit says otherwise. If you can't confidently read a value, omit it rather than guessing. Only set "difficulty" to easy/moderate/difficult/failed when there's a clear signal (a checkmark, a note like "easy" or "failed", circled/starred sets, etc.) — otherwise leave it null.

Respond with ONLY valid JSON, no other text, matching exactly this shape:
{
  "date": "YYYY-MM-DD" or null if no date is visible,
  "entries": [
    {
      "exerciseName": string,
      "sets": [ { "reps": number, "weight": number or null, "difficulty": "easy" | "moderate" | "difficult" | "failed" | null } ]
    }
  ],
  "notes": string — anything ambiguous, illegible, or that didn't fit the structure, so the person can double-check it
}`;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Photo import isn't configured yet — this project needs an ANTHROPIC_API_KEY." },
      { status: 501 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = file.type || "image/jpeg";

  const anthropic = new Anthropic({ apiKey });

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: base64 },
            },
            { type: "text", text: "Extract this workout log page." },
          ],
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: "The extraction request failed. Try again, or enter this page manually." },
      { status: 502 }
    );
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No readable response from the model." }, { status: 502 });
  }

  let parsed;
  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
  } catch {
    return NextResponse.json(
      { error: "Couldn't parse the extracted data. Try a clearer photo, or enter it manually." },
      { status: 502 }
    );
  }

  return NextResponse.json(parsed);
}
