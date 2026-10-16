import { NextResponse } from "next/server";
import { getSharedLink } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { expired: true, message: "your link has expired, request again to data owner" },
        { status: 404 }
      );
    }

    const { link, isExpired } = await getSharedLink(id);

    if (!link || isExpired) {
      return NextResponse.json(
        {
          expired: true,
          message: "your link has expired, request again to data owner",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      expired: false,
      link: {
        id: link.id,
        projectId: link.projectId,
        projectName: link.projectName,
        content: link.content,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      },
    });
  } catch (error) {
    console.error("Error retrieving shared link:", error);
    return NextResponse.json(
      {
        expired: true,
        message: "your link has expired, request again to data owner",
      },
      { status: 500 }
    );
  }
}
