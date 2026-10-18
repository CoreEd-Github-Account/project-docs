import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { saveUserPushToken } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pushToken } = body;
    if (pushToken && typeof pushToken === "string") {
      await saveUserPushToken(auth.user.id, pushToken.trim());
      return NextResponse.json({ success: true, saved: true });
    }

    return NextResponse.json({ error: "pushToken string required" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/notifications/push-token error:", error);
    return NextResponse.json(
      { error: "Failed to save push token" },
      { status: 500 }
    );
  }
}
