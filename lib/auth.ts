import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "project_docs_auth";
export const AUTH_TOKEN_VALUE = "valid_session_taha_docs_2026";

export const DEFAULT_CREDENTIALS = {
  username: process.env.AUTH_USERNAME || "admin",
  password: process.env.AUTH_PASSWORD || "taha2026!",
};

export function verifyCredentials(username?: string, password?: string): boolean {
  if (!username || !password) return false;
  return (
    username === DEFAULT_CREDENTIALS.username &&
    password === DEFAULT_CREDENTIALS.password
  );
}

export function isRequestAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") || "";
  return cookieHeader.includes(`${AUTH_COOKIE_NAME}=${AUTH_TOKEN_VALUE}`);
}

export async function isServerAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME);
  return token?.value === AUTH_TOKEN_VALUE;
}
