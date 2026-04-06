import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AIHistorySidebar from "./AIHistorySidebar";
import {
  STORAGE_KEY,
  QUICK_PROMPTS,
  uid,
  nowTime,
  getSpeechRecognition,
  createWelcomeMessages,
  createNewChat,
  trimTitle,
  buildAIResponse,
  fetchFinanceSnapshot,
  buildDailyFinanceSummary,
} from "./aiAssistantCore";

function AssistantCard({ card }) {
  if (!card) return null;

  if (card.type === "summary") {
    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={cardGrid}>
          {(card.rows || []).map((row, index) => (
            <div key={`${row.label}_${index}`} style={statTile}>
              <div style={statLabel}>{row.label}</div>
              <div style={statValue}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.type === "list") {
    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {(card.items || []).map((item, index) => (
            <div key={`${item}_${index}`} style={listItem}>
              <span style={listDot} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.type === "message") {
    async function copyDraft() {
      try {
        await navigator.clipboard.writeText(card.message || "");
      } catch {
        // ignore
      }
    }

    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={messageDraftBox}>
          <pre style={messageDraftText}>{card.message}</pre>
        </div>
        <div style={actionRow}>
          <button type="button" style={secondaryBtn} onClick={copyDraft}>
            Copy Draft
          </button>
        </div>
      </div>
    );
  }

  if (card.type === "table") {
    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {(card.columns || []).map((col) => (
                  <th key={col} style={thStyle}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(card.rows || []).length > 0 ? (
                card.rows.map((row, index) => (
                  <tr key={`row_${index}`}>
                    {(row || []).map((cell, cellIndex) => (
                      <td key={`cell_${index}_${cellIndex}`} style={tdStyle}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={tdStyle} colSpan={(card.columns || []).length || 1}>
                    No rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          borderRadius: 16,
          padding: "10px 12px",
          whiteSpace: "pre-wrap",
          lineHeight: 1.45,
          fontSize: 13,
          border: isUser
            ? "1px solid rgba(64, 206, 255, 0.28)"
            : "1px solid rgba(255,255,255,0.08)",
          background: isUser
            ? "linear-gradient(135deg, rgba(39,190,255,0.22), rgba(90,120,255,0.18))"
            : "rgba(255,255,255,0.04)",
          color: "#f5f7ff",
          boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12, opacity: 0.9 }}>
          {isUser ? "You" : "AI Assistant"}
        </div>

        <div>{msg.text}</div>

        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            opacity: 0.7,
            textAlign: "right",
          }}
        >
          {msg.time}
        </div>

        {Array.isArray(msg.cards) && msg.cards.length > 0 ? (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {msg.cards.map((card, index) => (
              <AssistantCard key={`${card.title || "card"}_${index}`} card={card} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MicIcon({ active = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 15.5C9.93 15.5 8.25 13.82 8.25 11.75V7.75C8.25 5.68 9.93 4 12 4C14.07 4 15.75 5.68 15.75 7.75V11.75C15.75 13.82 14.07 15.5 12 15.5Z"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
      />
      <path
        d="M18.25 11.75C18.25 15.2 15.45 18 12 18C8.55 18 5.75 15.2 5.75 11.75"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 18V21"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9.5 21H14.5"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21 3L10 14"
        stroke="#07121f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3L14 21L10 14L3 10L21 3Z"
        stroke="#07121f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AIWorkspace({ currentUser = null }) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || chats[0] || null,
    [chats, activeChatId]
  );

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      }
    } catch {
      // ignore
    }

    const first = createNewChat(currentUser);
    setChats([first]);
    setActiveChatId(first.id);
  }, [currentUser]);

  useEffect(() => {
    if (!Array.isArray(chats) || chats.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // ignore
    }
  }, [chats]);

  useEffect(() => {
    const RecognitionClass = getSpeechRecognition();
    setSpeechSupported(Boolean(RecognitionClass));

    if (!RecognitionClass) return;

    const recognition = new RecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError("");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript.trim());
    };

    recognition.onerror = (event) => {
      const errorCode = event?.error || "";

      if (errorCode === "not-allowed") {
        setSpeechError("Microphone permission denied.");
      } else if (errorCode === "no-speech") {
        setSpeechError("No speech detected. Please try again.");
      } else if (errorCode === "audio-capture") {
        setSpeechError("No microphone detected.");
      } else {
        setSpeechError("Voice recognition failed. Please try again.");
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat, loading]);

  function updateChat(chatId, updater) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const next = typeof updater === "function" ? updater(chat) : chat;
        return {
          ...next,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }

  function ensureActiveChat() {
    if (activeChat) return activeChat.id;

    const fresh = createNewChat(currentUser);
    setChats([fresh]);
    setActiveChatId(fresh.id);
    return fresh.id;
  }

  async function loadAutoInsights(chatId) {
    try {
      const snapshot = await fetchFinanceSnapshot();
      const result = buildDailyFinanceSummary(snapshot);

      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text:
          "I checked your latest dashboard, receivables, payables, receipts, vendor payments, and masters. Here is the automatic finance summary.",
        cards: result.cards || [],
      });
    } catch {
      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text:
          "I could not load automatic finance insights right now, but you can still ask for dashboard summary, overdue customers, recent receipts, recent vendor payments, master summary, reports, invoice search, bill search, or reminders.",
        cards: [],
      });
    }
  }

  function handleNewChat() {
    const fresh = createNewChat(currentUser);
    setChats((prev) => [fresh, ...prev]);
    setActiveChatId(fresh.id);
    setInput("");
    inputRef.current?.focus();
    loadAutoInsights(fresh.id);
  }

  function handleDeleteChat(chatId) {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);

      if (filtered.length === 0) {
        const fresh = createNewChat(currentUser);
        setActiveChatId(fresh.id);
        setTimeout(() => loadAutoInsights(fresh.id), 0);
        return [fresh];
      }

      if (chatId === activeChatId) {
        setActiveChatId(filtered[0].id);
      }

      return filtered;
    });
  }

  function appendMessageToChat(chatId, message) {
    updateChat(chatId, (chat) => {
      const nextMessages = [...(chat.messages || []), message];

      let nextTitle = chat.title;
      const userMessages = nextMessages.filter((m) => m.role === "user");

      if ((chat.title === "New Chat" || !chat.title) && userMessages.length > 0) {
        nextTitle = trimTitle(userMessages[0].text);
      }

      return {
        ...chat,
        title: nextTitle,
        messages: nextMessages,
      };
    });
  }

  function startListening() {
    setSpeechError("");

    if (!recognitionRef.current) {
      setSpeechError("Voice recognition is not supported in this browser.");
      return;
    }

    if (loading) return;

    try {
      recognitionRef.current.start();
      inputRef.current?.focus();
    } catch {
      // ignore
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  }

  async function handleSend(customText) {
    const chatId = ensureActiveChat();
    const finalText = String(customText ?? input).trim();

    if (!finalText || loading) return;

    if (isListening) {
      stopListening();
    }

    appendMessageToChat(chatId, {
      id: uid(),
      role: "user",
      time: nowTime(),
      text: finalText,
      cards: [],
    });

    setInput("");
    setLoading(true);

    try {
      const result = await buildAIResponse(finalText, navigate, currentUser);

      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text: result.reply,
        cards: result.cards || [],
      });
    } catch (e) {
      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text: String(e?.message || e || "Something went wrong while processing the command."),
        cards: [],
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    if (
      activeChat &&
      Array.isArray(activeChat.messages) &&
      activeChat.messages.length <= createWelcomeMessages(currentUser).length
    ) {
      loadAutoInsights(activeChat.id);
    }
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div style={workspaceGrid} className="ai-workspace-grid">
        <div className="ai-history-col" style={historyCol}>
          <AIHistorySidebar
            chats={chats}
            activeChatId={activeChat?.id}
            onSelectChat={setActiveChatId}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
          />
        </div>

        <div className="ai-chat-col" style={chatCol}>
          <div style={panelWrap}>
            <div style={panelHeader}>
              <div>
                <div style={panelTitle}>{activeChat?.title || "AI Finance Assistant"}</div>
                <div style={panelSubtitle}>
                  {currentUser?.role === "VIEWER"
                    ? "Read-only AI summaries, reports, search, reminders, and safe navigation"
                    : "Live finance summaries, reports, search, reminders, and navigation"}
                </div>
              </div>

              <div style={statusBadge}>
                <span style={statusDot} />
                <span>{currentUser?.role === "VIEWER" ? "Read Only" : "Ready"}</span>
              </div>
            </div>

            <div ref={scrollRef} style={panelBody}>
              <div style={promptSection}>
                <div style={sectionLabel}>Quick actions</div>
                <div style={chipsWrap}>
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      style={chipBtn}
                      onClick={() => handleSend(prompt)}
                      disabled={loading}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {(activeChat?.messages || []).map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {loading ? (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={loadingBubble}>
                      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                        AI Assistant
                      </div>
                      <div style={typingRow}>
                        <span style={typingDot} />
                        <span style={typingDot} />
                        <span style={typingDot} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={panelFooter}>
              <div
                style={{
                  ...inputShell,
                  ...(isListening ? inputShellListening : null),
                }}
              >
                <div style={inputArea}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={isListening ? "Speak your finance command..." : "Ask your finance question"}
                    style={inputStyle}
                    disabled={loading}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>

                <div style={rightActions}>
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={!speechSupported || loading}
                    title={
                      !speechSupported
                        ? "Voice recognition not supported"
                        : isListening
                        ? "Stop voice input"
                        : "Start voice input"
                    }
                    style={{
                      ...(isListening ? micBtnActive : micBtn),
                      opacity: !speechSupported || loading ? 0.5 : 1,
                      cursor: !speechSupported || loading ? "not-allowed" : "pointer",
                    }}
                  >
                    <MicIcon active={isListening} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!canSend}
                    style={{
                      ...sendBtn,
                      opacity: canSend ? 1 : 0.55,
                      cursor: canSend ? "pointer" : "not-allowed",
                    }}
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>

              {speechError ? <div style={speechErrorText}>{speechError}</div> : null}

              <div style={footerHint}>
                Try: <span style={hintStrong}>Generate receivables report</span>,{" "}
                <span style={hintStrong}>Find invoice INV0001</span>, or{" "}
                <span style={hintStrong}>Show unpaid purchase bills</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{responsiveCss}</style>
    </>
  );
}

const workspaceGrid = {
  display: "grid",
  gridTemplateColumns: "320px minmax(0, 1fr)",
  gap: 18,
  alignItems: "stretch",
  minHeight: "calc(100vh - 220px)",
};

const historyCol = {
  minWidth: 0,
  minHeight: 0,
};

const chatCol = {
  minWidth: 0,
  minHeight: 0,
};

const panelWrap = {
  width: "100%",
  minHeight: "calc(100vh - 220px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 22,
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(12,18,36,0.98) 0%, rgba(14,19,42,0.96) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
  color: "#f5f7ff",
};

const panelHeader = {
  padding: "14px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  background:
    "linear-gradient(135deg, rgba(37,205,207,0.18), rgba(111,82,255,0.18))",
};

const panelTitle = {
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const panelSubtitle = {
  fontSize: 12,
  color: "rgba(235,240,255,0.78)",
  marginTop: 2,
};

const statusBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const statusDot = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#49e58e",
  boxShadow: "0 0 12px rgba(73,229,142,0.9)",
};

const panelBody = {
  flex: 1,
  overflowY: "auto",
  padding: 14,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(73,157,255,0.08), transparent 30%), radial-gradient(circle at bottom right, rgba(94,224,193,0.08), transparent 28%)",
};

const promptSection = {
  display: "grid",
  gap: 10,
};

const sectionLabel = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.9,
  fontWeight: 900,
  color: "rgba(220,228,255,0.72)",
};

const chipsWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#ecf2ff",
  padding: "9px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const loadingBubble = {
  maxWidth: "70%",
  borderRadius: 16,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const typingRow = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const typingDot = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "rgba(255,255,255,0.85)",
};

const cardBox = {
  borderRadius: 16,
  padding: 12,
  background: "rgba(9, 17, 34, 0.68)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const cardTitle = {
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 10,
  color: "#dce7ff",
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const statTile = {
  borderRadius: 14,
  padding: "10px 11px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const statLabel = {
  fontSize: 11,
  color: "rgba(223,230,255,0.72)",
  marginBottom: 6,
};

const statValue = {
  fontSize: 14,
  fontWeight: 900,
  color: "#ffffff",
  lineHeight: 1.3,
};

const listItem = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 13,
  color: "#eef3ff",
  lineHeight: 1.45,
};

const listDot = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#55d4ff",
  marginTop: 6,
  flex: "0 0 auto",
};

const messageDraftBox = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 10,
};

const messageDraftText = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: "inherit",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#f4f7ff",
};

const actionRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const secondaryBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  padding: "9px 12px",
  fontWeight: 800,
  cursor: "pointer",
  color: "#edf2ff",
  background: "rgba(255,255,255,0.05)",
};

const tableWrap = {
  width: "100%",
  overflowX: "auto",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
};

const tableStyle = {
  width: "100%",
  minWidth: 560,
  borderCollapse: "collapse",
  background: "rgba(255,255,255,0.02)",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 900,
  color: "#dce7ff",
  background: "rgba(255,255,255,0.05)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#eef3ff",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};

const panelFooter = {
  borderTop: "1px solid rgba(255,255,255,0.07)",
  padding: 14,
  display: "grid",
  gap: 10,
  background: "rgba(8,12,26,0.88)",
};

const inputShell = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 999,
  border: "1px solid rgba(102, 130, 255, 0.22)",
  background:
    "linear-gradient(180deg, rgba(18,26,52,0.96) 0%, rgba(14,21,44,0.96) 100%)",
  padding: "8px 10px 8px 14px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(71,107,255,0.05)",
  minHeight: 58,
};

const inputShellListening = {
  border: "1px solid rgba(111, 192, 255, 0.4)",
  boxShadow:
    "0 0 0 1px rgba(111,192,255,0.08) inset, 0 0 24px rgba(63,136,255,0.10)",
};

const inputArea = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  boxShadow: "none",
  WebkitBoxShadow: "none",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  background: "transparent",
  backgroundColor: "transparent",
  color: "#ffffff",
  fontSize: 16,
  lineHeight: 1.4,
  fontFamily: "inherit",
  height: 24,
  padding: 0,
  margin: 0,
  borderRadius: 0,
};

const rightActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "0 0 auto",
};

const micBtn = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
};

const micBtnActive = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, rgba(255,97,97,0.88), rgba(255,143,92,0.82))",
  boxShadow: "0 10px 20px rgba(255,90,90,0.20)",
};

const sendBtn = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #6ceec7, #65b7ff)",
  boxShadow: "0 10px 20px rgba(101,183,255,0.22)",
};

const speechErrorText = {
  fontSize: 12,
  color: "#ffb3b3",
  fontWeight: 700,
};

const footerHint = {
  fontSize: 12,
  color: "rgba(226,232,255,0.72)",
};

const hintStrong = {
  color: "#ffffff",
  fontWeight: 800,
};

const responsiveCss = `
@media (max-width: 1100px) {
  .ai-workspace-grid {
    grid-template-columns: 1fr !important;
  }

  .ai-history-col {
    order: 2;
  }

  .ai-chat-col {
    order: 1;
  }
}

@media (max-width: 640px) {
  .ai-workspace-grid {
    gap: 12px !important;
  }
}
`;