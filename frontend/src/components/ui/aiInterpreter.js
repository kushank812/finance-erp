import { extractEntities } from "./aiEntityExtractor";
import { parseIntent } from "./aiIntentParser";
import { includesAny, normalizeText } from "./aiUtils";
import { mergeEntitiesWithMemory } from "./aiConversationMemory";

function isShortFollowUp(text) {
  const q = normalizeText(text);
  if (!q) return false;

  return (
    q.split(" ").length <= 6 ||
    includesAny(q, [
      "only for",
      "just for",
      "for customer",
      "for vendor",
      "top 5",
      "top 10",
      "last month",
      "this month",
      "today",
      "yesterday",
      "show more",
      "open it",
      "open that",
      "what about",
      "and bills",
      "and receipts",
      "and payments",
    ])
  );
}

function inferIntentFromPhrases(text, baseIntent) {
  const q = normalizeText(text);

  if (
    includesAny(q, [
      "who should i pay first",
      "which vendors should i pay first",
      "vendor priority",
      "payment priority",
      "supplier priority",
    ])
  ) {
    return "payment_priority";
  }

  if (
    includesAny(q, [
      "who should i collect from first",
      "which customers should i collect from first",
      "collection priority",
      "customer priority",
    ])
  ) {
    return "collection_priority";
  }

  if (
    includesAny(q, [
      "what customers still owe",
      "who owes me",
      "money pending from customers",
      "customer outstanding",
      "receivable from customers",
    ])
  ) {
    return "customer_dues";
  }

  if (
    includesAny(q, [
      "what vendors do i need to pay",
      "money i need to pay vendors",
      "vendor outstanding",
      "payable to vendors",
    ])
  ) {
    return "vendor_dues";
  }

  if (
    includesAny(q, [
      "not yet paid invoices",
      "unpaid invoices",
      "open invoices",
      "outstanding invoices",
    ])
  ) {
    return "invoice_search";
  }

  if (
    includesAny(q, [
      "unpaid bills",
      "open bills",
      "outstanding bills",
    ])
  ) {
    return "bill_search";
  }

  return baseIntent;
}

function applyFollowUpRules(text, parsedIntent, parsedEntities, memory) {
  const q = normalizeText(text);
  const previousIntent = memory?.lastIntent || null;

  let intent = parsedIntent;
  let entities = { ...parsedEntities };

  const shortFollowUp = isShortFollowUp(q);

  if (intent === "unknown" && shortFollowUp && previousIntent) {
    intent = previousIntent;
  }

  if (includesAny(q, ["only for customer", "for customer", "customer"])) {
    if (
      previousIntent &&
      includesAny(previousIntent, ["overdue", "invoice_search", "customer_dues"])
    ) {
      intent = previousIntent;
    }
  }

  if (includesAny(q, ["only for vendor", "for vendor", "vendor", "supplier"])) {
    if (
      previousIntent &&
      includesAny(previousIntent, ["bill_search", "vendor_dues", "payment_priority"])
    ) {
      intent = previousIntent;
    }
  }

  if (includesAny(q, ["top 5", "top 10", "top 3", "last month", "this month", "today"])) {
    if (previousIntent && intent === "unknown") {
      intent = previousIntent;
    }
  }

  if (includesAny(q, ["and receipts"])) {
    intent = "receipt_search";
  }

  if (includesAny(q, ["and payments", "vendor payments"])) {
    intent = "vendor_payment_search";
  }

  if (includesAny(q, ["and bills"])) {
    intent = "bill_search";
  }

  if (includesAny(q, ["and invoices"])) {
    intent = "invoice_search";
  }

  entities = mergeEntitiesWithMemory(entities, memory);

  if (entities.flags?.paidOnly && entities.flags?.unpaidOnly) {
    entities.flags.paidOnly = false;
  }

  return { intent, entities };
}

function computeConfidence(intent, text, memory) {
  const q = normalizeText(text);

  if (!intent || intent === "unknown") return 0.2;
  if (includesAny(q, ["dashboard", "ledger", "aging", "statement"])) return 0.95;
  if (includesAny(q, ["invoice", "bill", "receipt", "payment", "customer", "vendor"])) return 0.88;
  if (isShortFollowUp(q) && memory?.lastIntent) return 0.82;

  return 0.75;
}

export function interpretFinanceQuery(text, memory = {}) {
  const extractedEntities = extractEntities(text);
  let intent = parseIntent(text);

  intent = inferIntentFromPhrases(text, intent);

  const resolved = applyFollowUpRules(text, intent, extractedEntities, memory);

  return {
    intent: resolved.intent,
    entities: resolved.entities,
    confidence: computeConfidence(resolved.intent, text, memory),
    rewrittenQuery: normalizeText(text),
  };
}