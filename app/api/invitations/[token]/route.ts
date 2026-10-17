import { NextResponse } from "next/server";
import { getInvitationByToken, findUserByUsername, findUserById } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ valid: false, error: "invalid" }, { status: 400 });
    }

    const result = await getInvitationByToken(token);

    if (result.error || !result.invitation) {
      return NextResponse.json({
        valid: false,
        error: result.error || "invalid",
        projectName: result.projectName,
      });
    }

    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get("email")?.trim()?.toLowerCase();
    const checkEmail = (queryEmail || result.invitation.invitedUserEmail || "").trim().toLowerCase();

    let existingUser = null;
    if (checkEmail) {
      existingUser = await findUserByUsername(checkEmail);
    }
    if (!existingUser) {
      const auth = await getAuthenticatedUser();
      if (auth.authenticated && auth.user) {
        existingUser = await findUserById(auth.user.id);
      }
    }

    return NextResponse.json({
      valid: true,
      hasAccount: Boolean(existingUser),
      existingUser: existingUser
        ? {
            username: existingUser.username,
            email: existingUser.email,
            fullName: existingUser.fullName || existingUser.username,
          }
        : null,
      invitation: {
        id: result.invitation.id,
        invitedUserName: result.invitation.invitedUserName,
        invitedUserEmail: result.invitation.invitedUserEmail,
        permissionLevel: result.invitation.permissionLevel,
        projectName: result.projectName,
        inviterName: result.inviterName,
        expiresAt: result.invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("GET /api/invitations/[token] error:", error);
    return NextResponse.json({ valid: false, error: "server_error" }, { status: 500 });
  }
}
