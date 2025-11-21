import { createChatNotification } from "@/lib/notification-utils";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatRoomId, senderId, messageContent, recipientId } =
      await request.json();

    if (!chatRoomId || !senderId || !messageContent || !recipientId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Don't send notification to the sender
    if (senderId === recipientId) {
      return NextResponse.json({ success: true });
    }

    // Create the chat notification
    const notification = await createChatNotification(
      chatRoomId,
      senderId,
      messageContent
    );

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Error creating chat notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
