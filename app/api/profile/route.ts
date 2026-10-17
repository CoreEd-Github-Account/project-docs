import { NextResponse } from "next/server";
import { getAuthenticatedUser, setAuthSessionCookie } from "@/lib/auth";
import { getUserProfile, updateUserProfile, findUserById } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/crypto";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getUserProfile(auth.user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      username,
      email,
      fullName,
      bio,
      avatarUrl,
      recoveryKey,
      currentPassword,
      newPassword,
    } = body;

    let newPasswordHash: string | undefined = undefined;

    // Handle password change if requested
    if (newPassword && newPassword.trim()) {
      const cleanNewPassword = newPassword.trim();
      if (cleanNewPassword.length < 4) {
        return NextResponse.json(
          { error: "New password must be at least 4 characters long." },
          { status: 400 }
        );
      }

      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change password." },
          { status: 400 }
        );
      }

      const currentUser = await findUserById(auth.user.id);
      if (!currentUser) {
        return NextResponse.json({ error: "User account not found." }, { status: 404 });
      }

      const isValidPassword = verifyPassword(currentPassword, currentUser.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      newPasswordHash = hashPassword(cleanNewPassword);
    }

    const result = await updateUserProfile(auth.user.id, {
      username: username !== undefined ? String(username) : undefined,
      email: email !== undefined ? String(email) : undefined,
      fullName: fullName !== undefined ? String(fullName) : undefined,
      bio: bio !== undefined ? String(bio) : undefined,
      avatarUrl: avatarUrl !== undefined ? String(avatarUrl) : undefined,
      recoveryKey: recoveryKey !== undefined ? String(recoveryKey) : undefined,
      newPasswordHash,
    });

    if (!result.success || !result.user) {
      return NextResponse.json(
        { error: result.error || "Failed to update profile." },
        { status: 400 }
      );
    }

    // If username was updated, refresh session cookie with the new username
    if (result.user.username && result.user.username !== auth.user.username) {
      await setAuthSessionCookie(auth.user.id, result.user.username);
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated & live synced with database table.",
      profile: result.user,
    });
  } catch (error) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while saving profile." },
      { status: 500 }
    );
  }
}
