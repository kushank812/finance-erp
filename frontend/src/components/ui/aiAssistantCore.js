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

export const STORAGE_KEY = "finance_ai_workspace_chats_v9";

export const QUICK_PROMPTS = [
  "Summarize dashboard",
  "Show overdue invoices",
  "Show customer dues",
  "Which vendors should I pay first",
  "Which customers should I collect from first",
  "Open ledger",
];

export { uid, nowTime, getSpeechRecognition, trimTitle, fetchFinanceSnapshot };

export function createWelcomeMessages(currentUser = null) {
  const roleText = currentUser?.role ? ` (${currentUser.role})` : "";

  return [
    {
      id: uid(),
      role: "assistant",
      time: nowTime(),
      text:
        `Welcome to AI Finance Assistant${roleText}. ` +
        "You can ask about dashboard summary, overdue invoices, receivables, payables, priorities, receipts, bills, invoices, or tell me to open a screen.",
      cards: [],
    },
  ];
}

export function createNewChat(currentUser = null) {
  const chatId = uid();
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

  const memory = getConversationMemory(sessionId);

  const interpreted = interpretFinanceQuery(finalText, memory);
  const intent = interpreted.intent;
  const entities = interpreted.entities;

  const result = await routeAI(intent, entities, navigate, currentUser);

  updateConversationMemory(sessionId, {
    lastIntent: intent,
    lastEntities: entities,
    lastQuery: finalText,
    historyEntry: {
      query: finalText,
      interpretedIntent: intent,
      entities,
      confidence: interpreted.confidence,
      timestamp: new Date().toISOString(),
    },
  });

  return result;
}