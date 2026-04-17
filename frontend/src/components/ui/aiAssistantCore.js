import { uid, nowTime, getSpeechRecognition, trimTitle } from "./aiUtils";
import { parseIntent } from "./aiIntentParser";
import { extractEntities } from "./aiEntityExtractor";
import { routeAI } from "./aiRouter";
import { fetchFinanceSnapshot } from "./aiSnapshotService";
import { buildDailyFinanceSummary as buildDailyFinanceSummaryFromBuilders } from "./aiResponseBuilders";

export const STORAGE_KEY = "finance_ai_workspace_chats_v8";

export const QUICK_PROMPTS = [
  "Summarize dashboard",
  "Show overdue invoices",
  "Show customer dues",
  "Which vendors should I pay first",
  "Show receipts from last 30 days",
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
        "You can ask about dashboard summary, overdue invoices, receivables, payables, payment priority, receipts, bills, invoices, or tell me to open a screen.",
      cards: [],
    },
  ];
}

export function createNewChat(currentUser = null) {
  return {
    id: uid(),
    title: "New Chat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: createWelcomeMessages(currentUser),
  };
}

export function buildDailyFinanceSummary(snapshot) {
  return buildDailyFinanceSummaryFromBuilders(snapshot);
}

export async function buildAIResponse(text, navigate = () => {}, currentUser = null) {
  const finalText = String(text || "").trim();

  if (!finalText) {
    return {
      reply: "Type something.",
      cards: [],
    };
  }

  const entities = extractEntities(finalText);
  const intent = parseIntent(finalText);

  return routeAI(intent, entities, navigate, currentUser);
}