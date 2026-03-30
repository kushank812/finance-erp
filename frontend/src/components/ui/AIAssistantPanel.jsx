import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";

function nowTime() {
  try {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function money(n) {
  const value = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

function compactMoney(n) {
  const x = Number(n || 0);
  if (Math.abs(x) >= 10000000) return `${(x / 10000000).toFixed(2)} Cr`;
  if (Math.abs(x) >= 100000) return `${(x / 100000).toFixed(2)} L`;
  if (Math.abs(x) >= 1000) return `${(x / 1000).toFixed(1)} K`;
  return `${x.toFixed(0)}`;
}

function toDateValue(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysOverdueFromDueDate(dueDate, fallbackDate) {
  const due = toDateValue(dueDate) || toDateValue(fallbackDate);
  if (!due) return 0;

  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

const QUICK_PROMPTS = [
  "Show overdue customers",
  "Open aging report",
  "Show vendor dues",
  "Open statement",
  "Open ledger",
  "Show invoices",
  "Show purchase bills",
];

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
        // ignore clipboard failure
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
          <button type="button" style={primaryBtn}>
            Use Later
          </button>
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

export default function AIAssistantPanel({
  title = "AI Finance Assistant",
  height = "calc(100vh - 140px)",
}) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: uid(),
      role: "assistant",
      time: nowTime(),
      text:
        "Welcome. I can help with finance actions like overdue customer summary, vendor dues, aging report navigation, statement navigation, ledger navigation, and basic reminder drafting.\n\nStart with one of the quick prompts below.",
      cards: [
        {
          type: "summary",
          title: "Supported Actions",
          rows: [
            { label: "AR", value: "Overdue / Receivables" },
            { label: "AP", value: "Vendor Dues" },
            { label: "Reports", value: "Aging / Statement / Ledger" },
            { label: "Docs", value: "Invoices / Purchase Bills" },
          ],
        },
      ],
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function buildRealResponse(text) {
    const query = String(text || "").trim().toLowerCase();

    if (!query) {
      return {
        reply:
          "Please type a command like “Show overdue customers”, “Open aging report”, or “Show vendor dues”.",
        cards: [],
      };
    }

    if (query.includes("aging")) {
      navigate("/aging");
      return {
        reply: "Opening Aging Report...",
        cards: [
          {
            type: "summary",
            title: "Navigation",
            rows: [
              { label: "Destination", value: "Aging Report" },
              { label: "Route", value: "/aging" },
            ],
          },
        ],
      };
    }

    if (query.includes("statement")) {
      navigate("/statement");
      return {
        reply: "Opening Statement...",
        cards: [
          {
            type: "summary",
            title: "Navigation",
            rows: [
              { label: "Destination", value: "Statement" },
              { label: "Route", value: "/statement" },
            ],
          },
        ],
      };
    }

    if (query.includes("ledger")) {
      navigate("/ledger");
      return {
        reply: "Opening Ledger...",
        cards: [
          {
            type: "summary",
            title: "Navigation",
            rows: [
              { label: "Destination", value: "Ledger" },
              { label: "Route", value: "/ledger" },
            ],
          },
        ],
      };
    }

    if (query.includes("purchase bill") || query.includes("purchase bills")) {
      navigate("/purchase-bills");
      return {
        reply: "Opening Purchase Bills...",
        cards: [
          {
            type: "summary",
            title: "Navigation",
            rows: [
              { label: "Destination", value: "Purchase Bills" },
              { label: "Route", value: "/purchase-bills" },
            ],
          },
        ],
      };
    }

    if (query.includes("invoice") || query.includes("invoices")) {
      navigate("/sales-invoices");
      return {
        reply: "Opening Sales Invoices...",
        cards: [
          {
            type: "summary",
            title: "Navigation",
            rows: [
              { label: "Destination", value: "Sales Invoices" },
              { label: "Route", value: "/sales-invoices" },
            ],
          },
        ],
      };
    }

    if (query.includes("vendor dues") || query.includes("vendor due") || query.includes("vendor")) {
      const apData = await apiGet("/purchase-invoices/");
      const rows = Array.isArray(apData) ? apData : [];

      const openRows = rows.filter((r) => Number(r.balance || 0) > 0);

      const totalPayable = openRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueThisWeekRows = openRows.filter((r) => {
        const due = toDateValue(r.due_date || r.bill_date);
        if (!due) return false;
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });

      const highest = [...openRows].sort(
        (a, b) => Number(b.balance || 0) - Number(a.balance || 0)
      )[0];

      return {
        reply: "Vendor dues summary ready.",
        cards: [
          {
            type: "summary",
            title: "Vendor Dues Summary",
            rows: [
              { label: "Open vendor bills", value: String(openRows.length) },
              { label: "Total payable", value: money(totalPayable) },
              {
                label: "Due this week",
                value: money(
                  dueThisWeekRows.reduce((sum, r) => sum + Number(r.balance || 0), 0)
                ),
              },
              {
                label: "Highest payable vendor",
                value: highest?.vendor_code || "-",
              },
            ],
          },
        ],
      };
    }

    if (query.includes("top receivable") || query.includes("top receivables")) {
      const arData = await apiGet("/sales-invoices/");
      const rows = Array.isArray(arData) ? arData : [];

      const topRows = rows
        .filter((r) => Number(r.balance || 0) > 0)
        .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
        .slice(0, 5);

      return {
        reply: "Top receivables loaded from live data.",
        cards: [
          {
            type: "list",
            title: "Top Receivables",
            items: topRows.length
              ? topRows.map(
                  (r) =>
                    `${r.customer_code || "CUSTOMER"} — ${money(Number(r.balance || 0))}`
                )
              : ["No open receivables found."],
          },
        ],
      };
    }

    if (query.includes("overdue")) {
      const arData = await apiGet("/sales-invoices/");
      const rows = Array.isArray(arData) ? arData : [];

      const overdueRows = rows
        .map((r) => {
          const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
          return {
            ...r,
            overdueDays,
          };
        })
        .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0);

      const overdueTotal = overdueRows.reduce(
        (sum, r) => sum + Number(r.balance || 0),
        0
      );

      const highest = [...overdueRows].sort(
        (a, b) => Number(b.balance || 0) - Number(a.balance || 0)
      )[0];

      const topCustomers = [...overdueRows]
        .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
        .slice(0, 5)
        .map(
          (r) =>
            `${r.customer_code || "CUSTOMER"} — ${money(Number(r.balance || 0))} (${r.overdueDays} days)`
        );

      return {
        reply:
          overdueRows.length > 0
            ? `Found ${overdueRows.length} overdue invoice(s) from live sales data.`
            : "No overdue customers found in current live sales data.",
        cards: [
          {
            type: "summary",
            title: "Overdue Customer Summary",
            rows: [
              { label: "Invoices overdue", value: String(overdueRows.length) },
              { label: "Total overdue", value: money(overdueTotal) },
              {
                label: "Highest overdue",
                value: highest?.customer_code || "-",
              },
              {
                label: "Largest balance",
                value: highest ? money(Number(highest.balance || 0)) : money(0),
              },
            ],
          },
          ...(topCustomers.length
            ? [
                {
                  type: "list",
                  title: "Top Overdue Customers",
                  items: topCustomers,
                },
              ]
            : []),
        ],
      };
    }

    if (
      query.includes("draft payment reminder") ||
      query.includes("payment reminder") ||
      query.includes("reminder")
    ) {
      const arData = await apiGet("/sales-invoices/");
      const rows = Array.isArray(arData) ? arData : [];

      const overdueRows = rows
        .map((r) => {
          const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
          return {
            ...r,
            overdueDays,
          };
        })
        .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
        .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

      const top = overdueRows[0];

      if (!top) {
        return {
          reply: "No overdue invoice found, so I could not draft a live payment reminder.",
          cards: [],
        };
      }

      const draft = `Dear ${top.customer_code},

This is a gentle reminder that payment of ${money(
        Number(top.balance || 0)
      )} against invoice ${top.invoice_no || "-"} is overdue by ${
        top.overdueDays
      } day(s).

Kindly arrange payment at the earliest and share the payment details with us.

Regards,
Accounts Team`;

      return {
        reply: "Live payment reminder draft created from current overdue invoice data.",
        cards: [
          {
            type: "summary",
            title: "Reminder Source",
            rows: [
              { label: "Customer", value: top.customer_code || "-" },
              { label: "Invoice", value: top.invoice_no || "-" },
              { label: "Balance", value: money(Number(top.balance || 0)) },
              { label: "Days overdue", value: String(top.overdueDays || 0) },
            ],
          },
          {
            type: "message",
            title: "Reminder Draft",
            message: draft,
          },
        ],
      };
    }

    return {
      reply:
        "Command not supported yet. Try: Show overdue customers, Show vendor dues, Open aging report, Open statement, Open ledger, Show invoices, or Show purchase bills.",
      cards: [],
    };
  }

  async function simulateAssistantReply(userText) {
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const result = await buildRealResponse(userText);

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          time: nowTime(),
          text: result.reply,
          cards: result.cards || [],
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          time: nowTime(),
          text: String(e?.message || e || "Something went wrong while processing the command."),
          cards: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(customText) {
    const finalText = String(customText ?? input).trim();
    if (!finalText || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "user",
        time: nowTime(),
        text: finalText,
        cards: [],
      },
    ]);

    setInput("");
    await simulateAssistantReply(finalText);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ ...panelWrap, height }}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>{title}</div>
          <div style={panelSubtitle}>Finance actions, summaries, and reminder drafts</div>
        </div>

        <div style={statusBadge}>
          <span style={statusDot} />
          <span>Ready</span>
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
          {messages.map((msg) => (
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
        <div style={inputWrap}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a finance command..."
            rows={2}
            style={inputStyle}
            disabled={loading}
          />
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
            Send
          </button>
        </div>

        <div style={footerHint}>
          Try: <span style={hintStrong}>Show overdue customers</span>,{" "}
          <span style={hintStrong}>Show vendor dues</span>, or{" "}
          <span style={hintStrong}>Open aging report</span>
        </div>
      </div>
    </div>
  );
}

const panelWrap = {
  width: "100%",
  minWidth: 320,
  maxWidth: 420,
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

const primaryBtn = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  fontWeight: 800,
  cursor: "pointer",
  color: "#06111f",
  background: "linear-gradient(135deg, #67f0d5, #61c3ff)",
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

const panelFooter = {
  borderTop: "1px solid rgba(255,255,255,0.07)",
  padding: 14,
  display: "grid",
  gap: 10,
  background: "rgba(8,12,26,0.88)",
};

const inputWrap = {
  display: "flex",
  gap: 10,
  alignItems: "flex-end",
};

const inputStyle = {
  flex: 1,
  resize: "none",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#ffffff",
  padding: "11px 12px",
  fontSize: 13,
  lineHeight: 1.45,
  outline: "none",
  fontFamily: "inherit",
};

const sendBtn = {
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  minWidth: 84,
  fontWeight: 900,
  color: "#06111f",
  background: "linear-gradient(135deg, #6ceec7, #65b7ff)",
};

const footerHint = {
  fontSize: 12,
  color: "rgba(226,232,255,0.72)",
};

const hintStrong = {
  color: "#ffffff",
  fontWeight: 800,
};