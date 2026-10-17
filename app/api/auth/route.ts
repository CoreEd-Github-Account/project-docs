import { NextResponse } from "next/server";
import {
  authenticateCredentials,
  getAuthenticatedUser,
  setAuthSessionCookie,
  clearAuthSessionCookie,
} from "@/lib/auth";
import {
  findUserByUsername,
  findUserById,
  createUser,
  resetUserPassword,
} from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (auth.authenticated && auth.user) {
    try {
      const user = await findUserById(auth.user.id);
      return NextResponse.json({
        ...auth,
        user: {
          id: auth.user.id,
          username: auth.user.username,
          fullName: user?.fullName || undefined,
          email: user?.email || undefined,
          avatarUrl: user?.avatarUrl || undefined,
        },
      });
    } catch (err) {
      console.error("GET /api/auth error fetching user details:", err);
    }
  }
  return NextResponse.json(auth);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || "login";

    // 1. REGISTRATION
    if (action === "register") {
      const { username, password, email, recoveryKey } = body;
      if (!username?.trim() || !password) {
        return NextResponse.json(
          { error: "Username and password are required" },
          { status: 400 }
        );
      }

      const cleanUsername = username.trim();
      if (cleanUsername.length < 3) {
        return NextResponse.json(
          { error: "Username must be at least 3 characters" },
          { status: 400 }
        );
      }

      if (password.length < 4) {
        return NextResponse.json(
          { error: "Password must be at least 4 characters" },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingUser = await findUserByUsername(cleanUsername);
      if (existingUser) {
        return NextResponse.json(
          { error: "Username already taken. Please choose another or sign in." },
          { status: 409 }
        );
      }

      const passwordHash = hashPassword(password);
      const newUser = await createUser(
        cleanUsername,
        email?.trim() || undefined,
        passwordHash,
        recoveryKey?.trim() || undefined
      );

      // Auto login after registration
      await setAuthSessionCookie(newUser.id, newUser.username);

      return NextResponse.json({
        success: true,
        authenticated: true,
        user: { id: newUser.id, username: newUser.username },
      });
    }

    // 2. PASSWORD RESET
    if (action === "reset") {
      const { username, newPassword, recoveryKey } = body;
      if (!username?.trim() || !newPassword) {
        return NextResponse.json(
          { error: "Username/Email and new password are required" },
          { status: 400 }
        );
      }

      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: "New password must be at least 4 characters" },
          { status: 400 }
        );
      }

      const user = await findUserByUsername(username.trim());
      if (!user) {
        return NextResponse.json(
          { error: "Account not found with this username or email" },
          { status: 404 }
        );
      }

      // If user had a recovery key set, verify it
      if (user.recoveryKey && user.recoveryKey.trim()) {
        if (!recoveryKey || recoveryKey.trim() !== user.recoveryKey.trim()) {
          return NextResponse.json(
            { error: "Invalid security recovery key for this account" },
            { status: 403 }
          );
        }
      }

      const newHash = hashPassword(newPassword);
      const success = await resetUserPassword(username.trim(), newHash, recoveryKey);
      if (!success) {
        return NextResponse.json(
          { error: "Failed to reset password. Please check your credentials." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Password reset successful. Please sign in with your new password.",
      });
    }

    // 3. LOGIN (DEFAULT)
    const { username, password } = body;
    const user = await authenticateCredentials(username, password);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    await setAuthSessionCookie(user.id, user.username);

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error("Auth POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearAuthSessionCookie();
    return NextResponse.json({ success: true, authenticated: false });
  } catch (error) {
    console.error("Auth logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
