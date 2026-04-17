import {
  uid,
  nowTime,
  getSpeechRecognition,
  trimTitle,
} from "./aiUtils";

import { routeAI } from "./aiRouter";
import { fetchFinanceSnapshot } from "./aiSnapshotService";
import { buildDailyFinanceSummary as buildDailyFinanceSummaryFromBuilders } from "./aiResponseBuilders";

import {
  clearConversationMemory,
  getConversationMemory,
  updateConversationMemory,
} from "./aiConversationMemory";

import { interpretFinanceQuery } from "./aiInterpreter";
import { interpretWithLLM } from "./aiLLMService"; // 🔥 IMPORTANT

/* ================= CONFIG ================= */

export const STORAGE_KEY = "finance_ai_workspace_chats_v10";

export const QUICK_PROMPTS = [
  "Summarize dashboard",
  "Show overdue invoices",
  "Show customer dues",
  "Which vendors should I pay first",
  "Which customers should I collect from first",
  "Open ledger",
];

export { uid, nowTime, getSpeechRecognition, trimTitle, fetchFinanceSnapshot };

/* ================= UI ================= */

export function createWelcomeMessages(currentUser = null) {
  const roleText = currentUser?.role ? ` (${currentUser.role})` : "";

  return [
    {
      id: uid(),
      role: "assistant",
      time: nowTime(),
      text:
        `Welcome to AI Finance Assistant${roleText}.\n\n` +
        "You can ask things like:\n" +
        "• Show unpaid invoices\n" +
        "• Which vendors should I pay first\n" +
        "• What customers still owe money\n" +
        "• Open ledger",
      cards: [],
    },
  ];
}

export function createNewChat(currentUser = null) {
  const chatId = uid();

  // 🔥 Reset memory per chat
  clearConversationMemory(chatId);

  return {
    id: chatId,
    title: "New Chat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: createWelcomeMessages(currentUser),
  };
}

export function buildDailyFinanceSummary(snapshot) {
  return buildDailyFinanceSummaryFromBuilders(snapshot);
}

/* ================= CORE ================= */

export async function buildAIResponse(
  text,
  navigate = () => {},
  currentUser = null,
  sessionId = "default"
) {
  const finalText = String(text || "").trim();

  if (!finalText) {
    return {
      reply: "Type something.",
      cards: [],
    };
  }

  // 🔥 STEP 1: MEMORY
  const memory = getConversationMemory(sessionId);

  let intent = "unknown";
  let entities = {};
  let confidence = 0;

  /* ================= LLM LAYER ================= */

  try {
    const llm = await interpretWithLLM(finalText);

    if (llm && llm.intent && llm.intent !== "unknown") {
      intent = llm.intent;
      entities = llm.entities || {};
      confidence = llm.confidence || 0.8;
    }
  } catch {
    // ignore LLM failure
  }

  /* ================= FALLBACK ================= */

  if (!intent || intent === "unknown") {
    const local = interpretFinanceQuery(finalText, memory);

    intent = local.intent;
    entities = local.entities;
    confidence = local.confidence || 0.6;
  }

  /* ================= SAFETY ================= */

  // prevent invalid intent execution
  if (!intent || intent === "unknown") {
    return {
      reply:
        "I couldn’t clearly understand that.\n\nTry asking:\n• Show overdue invoices\n• Customer dues\n• Vendor payments\n• Open ledger",
      cards: [],
    };
  }

  /* ================= ROUTER ================= */

  const result = await routeAI(intent, entities, navigate, currentUser);

  /* ================= MEMORY UPDATE ================= */

  updateConversationMemory(sessionId, {
    lastIntent: intent,
    lastEntities: entities,
    lastQuery: finalText,
    historyEntry: {
      query: finalText,
      intent,
      entities,
      confidence,
      timestamp: new Date().toISOString(),
    },
  });

  return result;
}