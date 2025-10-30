Set-Content -Path ".\src\lib\tokens.ts" -Value @'
import crypto from "crypto";

const secret = process.env.LEXYHUB_JWT_SECRET || "change-me";

export function signToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): any | null {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  const data = `${header}.${body}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (expected !== sig) return null;
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}
'@
