import { apiPost } from "../../api/client";

export async function sendAIMessage(message, sessionId) {
  try {
    return await apiPost("/ai/chat", {
      message,
      session_id: sessionId,
    });
  } catch (e) {
    return {
      reply: "AI service error",
      cards: [],
    };
  }
}