function createEmptyMemory() {
  return {
    lastIntent: null,
    lastEntities: {},
    lastQuery: "",
    history: [],
  };
}

const memoryStore = new Map();

function normalizeSessionId(sessionId) {
  return String(sessionId || "default").trim() || "default";
}

export function getConversationMemory(sessionId = "default") {
  const key = normalizeSessionId(sessionId);

  if (!memoryStore.has(key)) {
    memoryStore.set(key, createEmptyMemory());
  }

  return memoryStore.get(key);
}

export function clearConversationMemory(sessionId = "default") {
  const key = normalizeSessionId(sessionId);
  memoryStore.set(key, createEmptyMemory());
}

export function updateConversationMemory(sessionId = "default", payload = {}) {
  const key = normalizeSessionId(sessionId);
  const current = getConversationMemory(key);

  const next = {
    ...current,
    ...payload,
  };

  next.history = Array.isArray(current.history) ? [...current.history] : [];

  if (payload.historyEntry) {
    next.history.push(payload.historyEntry);
  }

  if (next.history.length > 20) {
    next.history = next.history.slice(next.history.length - 20);
  }

  memoryStore.set(key, next);
  return next;
}

export function mergeEntitiesWithMemory(entities = {}, memory = {}) {
  const previous = memory?.lastEntities || {};
  const currentFlags = entities?.flags || {};
  const previousFlags = previous?.flags || {};

  return {
    ...previous,
    ...entities,
    flags: {
      ...previousFlags,
      ...currentFlags,
    },
  };
}