import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client";

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

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const QUICK_PROMPTS = [
  "Show overdue customers",
  "Who should I follow up first",
  "Generate reminder",
  "What should I do today",
  "Show biggest risks",
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

export default function AIAssistantPanel({
  title = "AI Finance Assistant",
  height = "calc(100vh - 140px)",
}) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const bootedRef = useRef(false);
  const recognitionRef = useRef(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [messages, setMessages] = useState([
    {
      id: uid(),
      role: "assistant",
      time: nowTime(),
      text:
        "Welcome. I can help with finance actions like overdue customer summary, follow-up priority, vendor dues, aging report navigation, statement navigation, ledger navigation, and payment reminder drafting.",
      cards: [
        {
          type: "summary",
          title: "Supported Actions",
          rows: [
            { label: "AR", value: "Overdue / Follow-up / Receivables" },
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
  }, [messages, loading]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    async function loadAutoInsights() {
      try {
        const [dashboardData, arData, apData] = await Promise.all([
          apiGet("/dashboard/summary"),
          apiGet("/sales-invoices/"),
          apiGet("/purchase-invoices/"),
        ]);

        const salesRows = Array.isArray(arData) ? arData : [];
        const purchaseRows = Array.isArray(apData) ? apData : [];

        const overdueInvoices = salesRows
          .map((r) => {
            const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
            return { ...r, overdueDays };
          })
          .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
          .sort((a, b) => {
            if (Number(b.overdueDays || 0) !== Number(a.overdueDays || 0)) {
              return Number(b.overdueDays || 0) - Number(a.overdueDays || 0);
            }
            return Number(b.balance || 0) - Number(a.balance || 0);
          });

        const top3 = overdueInvoices.slice(0, 3);
        const oldest60Plus = overdueInvoices.filter(
          (r) => Number(r.overdueDays || 0) > 60
        );
        const oldest90Plus = overdueInvoices.filter(
          (r) => Number(r.overdueDays || 0) > 90
        );

        const purchaseOpen = purchaseRows.filter((r) => Number(r.balance || 0) > 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueThisWeek = purchaseOpen.filter((r) => {
          const due = toDateValue(r.due_date || r.bill_date);
          if (!due) return false;
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7;
        });

        const overdueAmount =
          Number(dashboardData?.overdue_receivables || 0) ||
          overdueInvoices.reduce((sum, r) => sum + Number(r.balance || 0), 0);

        const highestInvoice = overdueInvoices[0];
        const topCustomer = top3[0]?.customer_code || "-";

        const autoCards = [
          {
            type: "summary",
            title: "Today's AI Insights",
            rows: [
              { label: "Overdue amount", value: money(overdueAmount) },
              { label: "Overdue invoices", value: String(overdueInvoices.length) },
              { label: "Top follow-up customer", value: topCustomer },
              { label: "Vendor bills due this week", value: String(dueThisWeek.length) },
            ],
          },
        ];

        if (top3.length > 0) {
          autoCards.push({
            type: "list",
            title: "Top 3 Follow-up Customers",
            items: top3.map(
              (r, index) =>
                `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                  r.invoice_no || "-"
                } | ${money(Number(r.balance || 0))} | ${r.overdueDays} days overdue`
            ),
          });
        }

        if (highestInvoice) {
          autoCards.push({
            type: "summary",
            title: "Highest Risk Invoice",
            rows: [
              { label: "Customer", value: highestInvoice.customer_code || "-" },
              { label: "Invoice", value: highestInvoice.invoice_no || "-" },
              { label: "Balance", value: money(Number(highestInvoice.balance || 0)) },
              { label: "Overdue days", value: String(highestInvoice.overdueDays || 0) },
            ],
          });
        }

        autoCards.push({
          type: "list",
          title: "AI Warnings",
          items: [
            overdueInvoices.length > 0
              ? `${overdueInvoices.length} overdue invoice(s) need follow-up.`
              : "No overdue invoices right now.",
            oldest60Plus.length > 0
              ? `${oldest60Plus.length} invoice(s) are overdue beyond 60 days.`
              : "No invoices overdue beyond 60 days.",
            oldest90Plus.length > 0
              ? `${oldest90Plus.length} invoice(s) are overdue beyond 90 days.`
              : "No invoices overdue beyond 90 days.",
            dueThisWeek.length > 0
              ? `${dueThisWeek.length} vendor bill(s) are due this week.`
              : "No vendor bills due this week.",
          ],
        });

        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            time: nowTime(),
            text:
              "I checked the latest dashboard, receivables, and payables data. Here are today's automatic AI insights.",
            cards: autoCards,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            time: nowTime(),
            text:
              "I could not load automatic AI insights right now, but you can still use commands like Show overdue customers, Who should I follow up first, or Generate reminder.",
            cards: [],
          },
        ]);
      }
    }

    loadAutoInsights();
  }, []);

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
      // ignore duplicate start
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

  async function buildRealResponse(text) {
    const query = String(text || "").trim().toLowerCase();

    if (!query) {
      return {
        reply:
          "Please type a command like Show overdue customers, Who should I follow up first, Generate reminder, What should I do today, Open aging report, or Show vendor dues.",
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

    if (
      query.includes("what should i do today") ||
      query.includes("what should i do") ||
      query.includes("today") ||
      query.includes("biggest risks") ||
      query.includes("risk")
    ) {
      const [arData, apData] = await Promise.all([
        apiGet("/sales-invoices/"),
        apiGet("/purchase-invoices/"),
      ]);

      const salesRows = Array.isArray(arData) ? arData : [];
      const purchaseRows = Array.isArray(apData) ? apData : [];

      const overdueRows = salesRows
        .map((r) => {
          const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
          return { ...r, overdueDays };
        })
        .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
        .sort((a, b) => {
          if (Number(b.overdueDays || 0) !== Number(a.overdueDays || 0)) {
            return Number(b.overdueDays || 0) - Number(a.overdueDays || 0);
          }
          return Number(b.balance || 0) - Number(a.balance || 0);
        });

      const top3 = overdueRows.slice(0, 3);
      const highest = overdueRows[0];

      const purchaseOpen = purchaseRows.filter((r) => Number(r.balance || 0) > 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueThisWeek = purchaseOpen.filter((r) => {
        const due = toDateValue(r.due_date || r.bill_date);
        if (!due) return false;
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });

      return {
        reply: "Here is what you should focus on today.",
        cards: [
          {
            type: "summary",
            title: "Today's Priorities",
            rows: [
              { label: "Overdue invoices", value: String(overdueRows.length) },
              { label: "Top follow-up cases", value: String(top3.length) },
              { label: "Vendor bills due this week", value: String(dueThisWeek.length) },
              {
                label: "Highest risk balance",
                value: highest ? money(Number(highest.balance || 0)) : money(0),
              },
            ],
          },
          ...(top3.length
            ? [
                {
                  type: "list",
                  title: "Focus First",
                  items: top3.map(
                    (r, index) =>
                      `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                        r.invoice_no || "-"
                      } | ${money(Number(r.balance || 0))} | ${
                        r.overdueDays
                      } days overdue`
                  ),
                },
              ]
            : []),
        ],
      };
    }

    if (
      query.includes("follow up") ||
      query.includes("follow-up") ||
      query.includes("priority") ||
      query.includes("who should i follow up first")
    ) {
      const arData = await apiGet("/sales-invoices/");
      const rows = Array.isArray(arData) ? arData : [];

      const overdueRows = rows
        .map((r) => {
          const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
          return { ...r, overdueDays };
        })
        .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
        .sort((a, b) => {
          if (Number(b.overdueDays || 0) !== Number(a.overdueDays || 0)) {
            return Number(b.overdueDays || 0) - Number(a.overdueDays || 0);
          }
          return Number(b.balance || 0) - Number(a.balance || 0);
        });

      const topPriority = overdueRows.slice(0, 5);

      return {
        reply:
          topPriority.length > 0
            ? "Here are the top customers/invoices you should follow up first."
            : "No overdue follow-up cases found right now.",
        cards: [
          {
            type: "summary",
            title: "Follow-up Priority",
            rows: [
              { label: "Overdue invoices", value: String(overdueRows.length) },
              { label: "Priority list", value: String(topPriority.length) },
              {
                label: "Highest overdue days",
                value: topPriority[0] ? String(topPriority[0].overdueDays) : "0",
              },
              {
                label: "Highest balance",
                value: topPriority[0]
                  ? money(Number(topPriority[0].balance || 0))
                  : money(0),
              },
            ],
          },
          ...(topPriority.length
            ? [
                {
                  type: "list",
                  title: "Top Follow-up Targets",
                  items: topPriority.map(
                    (r, index) =>
                      `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                        r.invoice_no || "-"
                      } | ${money(Number(r.balance || 0))} | ${
                        r.overdueDays
                      } days overdue`
                  ),
                },
              ]
            : []),
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

    if (query.includes("overdue")) {
      const arData = await apiGet("/sales-invoices/");
      const rows = Array.isArray(arData) ? arData : [];

      const overdueRows = rows
        .map((r) => {
          const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
          return { ...r, overdueDays };
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
              { label: "Highest overdue", value: highest?.customer_code || "-" },
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
      query.includes("generate reminder") ||
      query.includes("draft payment reminder") ||
      query.includes("payment reminder") ||
      query.includes("reminder")
    ) {
      const arData = await apiGet("/sales-invoices/");
      const rows = Array.isArray(arData) ? arData : [];

      const overdueRows = rows
        .map((r) => {
          const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
          return { ...r, overdueDays };
        })
        .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
        .sort((a, b) => {
          if (Number(b.overdueDays || 0) !== Number(a.overdueDays || 0)) {
            return Number(b.overdueDays || 0) - Number(a.overdueDays || 0);
          }
          return Number(b.balance || 0) - Number(a.balance || 0);
        });

      const top = overdueRows[0];

      if (!top) {
        return {
          reply: "No overdue invoice found, so I could not generate a live reminder.",
          cards: [],
        };
      }

      const whatsappMsg = `Hi ${top.customer_code},

Your payment of ${money(Number(top.balance || 0))} for invoice ${
        top.invoice_no || "-"
      } is overdue by ${top.overdueDays} day(s).

Please arrange payment soon and share the payment details.

Regards,
Accounts Team`;

      const emailMsg = `Subject: Payment Reminder – Invoice ${top.invoice_no || "-"}

Dear ${top.customer_code},

This is a reminder that your payment of ${money(
        Number(top.balance || 0)
      )} against invoice ${top.invoice_no || "-"} is overdue by ${
        top.overdueDays
      } day(s).

Kindly arrange the payment at the earliest and share the payment details with us.

Regards,
Accounts Team`;

      return {
        reply: "Reminder generated with WhatsApp and Email formats.",
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
            title: "WhatsApp Reminder",
            message: whatsappMsg,
          },
          {
            type: "message",
            title: "Email Reminder",
            message: emailMsg,
          },
        ],
      };
    }

    return {
      reply:
        "Command not supported yet. Try: Show overdue customers, Who should I follow up first, Generate reminder, What should I do today, Show biggest risks, Show vendor dues, Open aging report, Open statement, Open ledger, Show invoices, or Show purchase bills.",
      cards: [],
    };
  }

  async function simulateAssistantReply(userText) {
    setLoading(true);

    try {
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

    if (isListening) {
      stopListening();
    }

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
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ ...panelWrap, height }}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>{title}</div>
          <div style={panelSubtitle}>Finance actions, summaries, reminders, and auto insights</div>
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
        <div
          style={{
            ...inputShell,
            ...(isListening ? inputShellListening : null),
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              isListening
                ? "Speak your finance command..."
                : "Ask anything"
            }
            style={inputStyle}
            disabled={loading}
          />

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
          Try: <span style={hintStrong}>What should I do today</span>,{" "}
          <span style={hintStrong}>Who should I follow up first</span>, or{" "}
          <span style={hintStrong}>Generate reminder</span>
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

const inputShell = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  padding: "8px 10px 8px 16px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  minHeight: 58,
};

const inputShellListening = {
  border: "1px solid rgba(111, 192, 255, 0.28)",
  boxShadow:
    "0 0 0 1px rgba(111,192,255,0.06) inset, 0 0 20px rgba(63,136,255,0.08)",
};

const inputStyle = {
  flex: 1,
  border: "none",
  background: "transparent",
  color: "#ffffff",
  fontSize: 15,
  lineHeight: 1.4,
  outline: "none",
  fontFamily: "inherit",
  height: 24,
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