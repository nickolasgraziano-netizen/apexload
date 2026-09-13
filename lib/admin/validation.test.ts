import { describe, it, expect } from "vitest";
import {
  choice,
  email,
  imageType,
  safeUrl,
  sameOrigin,
  screenPath,
  text,
  uuid,
} from "./validation";
describe("admin input boundaries", () => {
  it("rejects an admin role hidden in a normal feature selection", () => {
    expect(() => choice("owner", ["off", "admin", "everyone"])).toThrow();
  });
  it("accepts HTTPS demo links but rejects executable and credential URLs", () => {
    expect(safeUrl("https://example.com/video")).toBe(
      "https://example.com/video",
    );
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,test",
      "http://example.com",
      "https://user:pass@example.com",
    ])
      expect(() => safeUrl(value)).toThrow();
  });
  it("rejects cross-origin mutations and missing origins", () => {
    for (const origin of ["https://evil.example", null])
      expect(() =>
        sameOrigin(
          new Request("https://apexload-azure.vercel.app/api/admin", {
            headers: origin ? { origin } : {},
          }),
        ),
      ).toThrow();
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/admin", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
  it("removes query parameters and workout IDs from feedback context", () => {
    expect(
      screenPath("/workout/508dce3c-0047-4268-bcaa-ebe8adba4896?token=secret"),
    ).toBe("/workout/:id");
    expect(() => screenPath("//example.com")).toThrow();
  });
  it("validates email, UUIDs, and whitespace-only input", () => {
    expect(email(" Nick@Example.com ")).toBe("nick@example.com");
    expect(() => email("bad email")).toThrow();
    expect(() => uuid("not-an-id")).toThrow();
    expect(() => text("   ", "Name", 10)).toThrow();
  });
  it("does not trust upload file extensions or MIME strings", () => {
    expect(
      imageType(new TextEncoder().encode('<svg onload="alert(1)">')),
    ).toBeNull();
    expect(imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    );
    expect(imageType(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
  });
});
