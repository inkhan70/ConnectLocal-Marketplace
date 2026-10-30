import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifyBearerToken, describeServerError, HttpError } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

function safeName(data: FirebaseFirestore.DocumentData | undefined, fallback: string) {
  return String(data?.businessName || data?.fullName || fallback).slice(0, 160);
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json();
    const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
    if (!targetId || targetId === decoded.uid) throw new HttpError(400, "invalid_target", "Choose another member.");

    const db = getAdminDb();
    const senderRef = db.collection("users").doc(decoded.uid);
    const targetRef = db.collection("users").doc(targetId);
    const [senderSnap, targetSnap] = await Promise.all([senderRef.get(), targetRef.get()]);
    if (!targetSnap.exists) throw new HttpError(404, "target_not_found", "That member is no longer available.");

    const chatId = [decoded.uid, targetId].sort().join("_");
    const chatRef = db.collection("chats").doc(chatId);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(chatRef);
      if (existing.exists) {
        const participants = existing.data()?.participants;
        if (!Array.isArray(participants) || participants.length !== 2 || !participants.includes(decoded.uid) || !participants.includes(targetId)) {
          throw new HttpError(409, "conversation_conflict", "This conversation is unavailable.");
        }
        return;
      }
      transaction.create(chatRef, {
        participants: [decoded.uid, targetId],
        participantProfiles: {
          [decoded.uid]: { name: safeName(senderSnap.data(), decoded.name || "Member"), role: senderSnap.data()?.role || "member" },
          [targetId]: { name: safeName(targetSnap.data(), "Member"), role: targetSnap.data()?.role || "member" },
        },
        lastMessage: "",
        lastMessageTimestamp: null,
        unreadCounts: { [decoded.uid]: 0, [targetId]: 0 },
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ chatId });
  } catch (error) {
    const result = describeServerError(error);
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
}
