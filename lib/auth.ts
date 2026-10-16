import { cookies } from "next/headers";
import { findUserByUsername } from "./db";
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  createJwt,
  verifyJwt,
  type SessionPayload,
} from "./crypto";

export { createJwt, verifyJwt, type SessionPayload };
export const AUTH_COOKIE_NAME = "project_docs_auth";

export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
  };
}

/**
 * Verify credentials strictly against database users table.
 */
export async function authenticateCredentials(
  username?: string,
  password?: string
): Promise<{ id: string; username: string } | null> {
  if (!username?.trim() || !password) return null;
  const cleanUsername = username.trim();

  // Check in database users table
  const user = await findUserByUsername(cleanUsername);
  if (user) {
    const isValid = verifyPassword(password, user.passwordHash);
    if (isValid) {
      return { id: user.id, username: user.username };
    }
  }

  return null;
}

/**
 * Get the currently authenticated user from session cookie
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return { authenticated: false };
    }

    // Verify cryptographic session token
    const payload: SessionPayload | null = verifySessionToken(token);
    if (!payload) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: { id: payload.userId, username: payload.username },
    };
  } catch (error) {
    console.error("Error verifying authenticated user:", error);
    return { authenticated: false };
  }
}

/**
 * Quick check if request is authenticated
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const result = await getAuthenticatedUser();
  return result.authenticated;
}

/**
 * Generate and set session cookie
 */
export async function setAuthSessionCookie(userId: string, username: string): Promise<string> {
  const token = createSessionToken({ userId, username });
  const cookieStore = await cookies();
  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return token;
}

/**
 * Remove session cookie
 */
export async function clearAuthSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}
