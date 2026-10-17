import { NextResponse } from "next/server";
import { setAuthSessionCookie, getAuthenticatedUser } from "@/lib/auth";
import {
  getInvitationByToken,
  acceptProjectInvitation,
  findUserByUsername,
  findUserById,
  createUser,
  updateUserProfile,
} from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, username, email } = body;

    if (!token || !token.trim()) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
    }

    // 1. Validate invitation token
    const invCheck = await getInvitationByToken(token.trim());
    if (invCheck.error || !invCheck.invitation) {
      const msgMap: Record<string, string> = {
        expired: "This invitation link has expired.",
        already_accepted: "This invitation link has already been used.",
        revoked: "This invitation link has been revoked.",
        invalid: "Invalid invitation link.",
      };
      return NextResponse.json(
        { error: msgMap[invCheck.error || "invalid"] || "Invalid invitation." },
        { status: 400 }
      );
    }

    const invitation = invCheck.invitation;
    const invitedEmail = (invitation.invitedUserEmail || "").trim().toLowerCase();

    // 2. Validate email match if the inviter specified an email address
    const submittedEmail = (email || "").trim().toLowerCase();
    if (invitedEmail && submittedEmail && submittedEmail !== invitedEmail) {
      return NextResponse.json(
        { error: `The email must match the invited address: ${invitedEmail}` },
        { status: 400 }
      );
    }

    const cleanEmail = invitedEmail || submittedEmail;

    // 3. Check if user already exists in database users table
    let user = cleanEmail ? await findUserByUsername(cleanEmail) : null;
    if (!user && username) {
      user = await findUserByUsername(username.trim().toLowerCase());
    }
    if (!user) {
      const auth = await getAuthenticatedUser();
      if (auth.authenticated && auth.user) {
        user = await findUserById(auth.user.id);
      }
    }

    // 4. If user does NOT have an account in database, password is required to create account
    if (!user) {
      if (!password || password.length < 4) {
        return NextResponse.json(
          { error: "Please choose a password with at least 4 characters to create your account." },
          { status: 400 }
        );
      }

      const newPasswordHash = hashPassword(password);

      // Pick a clean username
      let candidateUsername = (username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (!candidateUsername || candidateUsername.length < 3) {
        const namePart = (invitation.invitedUserName || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        const emailPart = cleanEmail ? cleanEmail.split("@")[0].replace(/[^a-z0-9_]/g, "") : "";
        candidateUsername = namePart || emailPart || "friend";
        if (candidateUsername.length < 3) candidateUsername += "123";
      }

      // Check username conflict
      const existingUserWithUsername = await findUserByUsername(candidateUsername);
      if (existingUserWithUsername) {
        candidateUsername = `${candidateUsername}_${Math.random().toString(36).substring(2, 6)}`;
      }

      user = await createUser(
        candidateUsername,
        cleanEmail || undefined,
        newPasswordHash
      );

      // Set full name if provided
      if (invitation.invitedUserName) {
        await updateUserProfile(user.id, {
          fullName: invitation.invitedUserName,
        });
      }
    }
    // Note: If user already had an account, their existing password is preserved and NOT touched!

    // 5. Accept Invitation & Add User to Project Members in DB
    const acceptResult = await acceptProjectInvitation(token.trim(), user.id);
    if (!acceptResult.success) {
      return NextResponse.json(
        { error: acceptResult.error || "Failed to accept invitation." },
        { status: 400 }
      );
    }

    // 6. Establish authenticated session
    await setAuthSessionCookie(user.id, user.username);

    return NextResponse.json({
      success: true,
      message: "Welcome to the project!",
      projectId: invitation.projectId,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("POST /api/invitations/accept error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while accepting the invitation." },
      { status: 500 }
    );
  }
}
