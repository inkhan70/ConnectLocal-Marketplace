import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifyBearerToken, describeServerError, HttpError } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json();
    const chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!chatId || !text || text.length > 4000) throw new HttpError(400, "invalid_message", "Enter a message up to 4,000 characters.");

    const db = getAdminDb();
    const chatRef = db.collection("chats").doc(chatId);
    const messageRef = chatRef.collection("messages").doc();
    const notificationRef = db.collection("notifications").doc();
    await db.runTransaction(async (transaction) => {
      const chatSnap = await transaction.get(chatRef);
      if (!chatSnap.exists || !chatSnap.data()?.participants?.includes(decoded.uid)) {
        throw new HttpError(403, "not_participant", "You are not a participant in this conversation.");
      }
      const participants = chatSnap.data()?.participants as string[];
      const recipientId = participants.find((id) => id !== decoded.uid);
      if (!recipientId) throw new HttpError(400, "invalid_conversation", "This conversation is invalid.");
      transaction.create(messageRef, { senderId: decoded.uid, text, timestamp: FieldValue.serverTimestamp() });
      transaction.update(chatRef, {
        lastMessage: text,
        lastMessageTimestamp: FieldValue.serverTimestamp(),
        [`unreadCounts.${recipientId}`]: FieldValue.increment(1),
      });
      transaction.create(notificationRef, {
        userId: recipientId,
        type: "chat_message",
        chatId,
        actorId: decoded.uid,
        message: text.slice(0, 140),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = describeServerError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}
