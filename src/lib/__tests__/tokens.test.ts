import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../tokens";

describe("token utilities", () => {
  it("signs and verifies payloads", () => {
    const token = signToken({ sub: "user-123", scope: ["read"] });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ sub: "user-123" });
  });

  it("returns null for invalid signatures", () => {
    const token = signToken({ sub: "user-123" });
    const tampered = `${token}corruption`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    const token = signToken({ sub: "user-123" });
    const [header, , sig] = token.split(".");
    const malformed = `${header}.not-base64!.${sig}`;
    expect(verifyToken(malformed)).toBeNull();
  });
});
