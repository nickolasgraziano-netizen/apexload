export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function text(
  value: unknown,
  label: string,
  max: number,
  required = true,
): string {
  if (typeof value !== "string")
    throw new RequestError(`${label} is required.`);
  const result = value.trim();
  if ((required && !result) || result.length > max)
    throw new RequestError(
      `${label} must be ${required ? "1" : "0"}–${max} characters.`,
    );
  return result;
}
export function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
): T {
  if (!choices.includes(value as T))
    throw new RequestError("Invalid selection.");
  return value as T;
}
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new RequestError("Invalid ID.");
  return value;
}
export function email(value: unknown): string {
  const result = text(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new RequestError("Enter a valid email address.");
  return result;
}
export function safeUrl(value: unknown): string {
  const result = text(value ?? "", "Link", 1000, false);
  if (!result) return "";
  try {
    const url = new URL(result);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error();
    return url.href;
  } catch {
    throw new RequestError("Use an HTTPS demonstration link.");
  }
}
export function screenPath(value: unknown): string {
  const path = text(value, "Screen", 200).split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new RequestError("Invalid screen.");
  return path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new RequestError("Request origin is not allowed.", 403);
}
export function imageType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
