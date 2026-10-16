import crypto from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_SECRET ||
  "project-docs-jwt-secret-key-taha-2026-production-super-secret";

/**
 * Hash a plain-text password using salt + scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored salt:hash string
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  sub?: string;
  userId: string;
  username: string;
  iat?: number; // seconds
  exp: number; // unix timestamp in seconds
}

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT",
};

/**
 * Create a standard RFC 7519 HS256 JSON Web Token (JWT)
 */
export function createJwt(payload: { userId: string; username: string }): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expInSeconds = nowInSeconds + 60 * 60 * 24 * 30; // 30 days expiration

  const fullPayload: SessionPayload = {
    sub: payload.userId,
    userId: payload.userId,
    username: payload.username,
    iat: nowInSeconds,
    exp: expInSeconds,
  };

  const headerB64 = Buffer.from(JSON.stringify(JWT_HEADER)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export const createSessionToken = createJwt;

/**
 * Verify a standard RFC 7519 HS256 JSON Web Token (JWT) and return decoded claims
 */
export function verifyJwt(token: string): SessionPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    if (!headerB64 || !payloadB64 || !signature) return null;

    // 1. Verify Header
    const headerStr = Buffer.from(headerB64, "base64url").toString("utf-8");
    const header = JSON.parse(headerStr);
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    // 2. Verify Cryptographic Signature
    const unsignedToken = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(unsignedToken)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    // 3. Verify Payload Claims and Expiration
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(payloadStr);

    const userId = payload.userId || payload.sub;
    if (!userId || !payload.exp) return null;

    const currentSeconds = Math.floor(Date.now() / 1000);
    // Support exp in seconds (standard JWT) or milliseconds
    const expInSeconds = payload.exp > 10000000000 ? Math.floor(payload.exp / 1000) : payload.exp;
    if (currentSeconds > expInSeconds) {
      return null;
    }

    return {
      sub: userId,
      userId,
      username: payload.username,
      iat: payload.iat,
      exp: expInSeconds,
    };
  } catch {
    return null;
  }
}

export const verifySessionToken = verifyJwt;
