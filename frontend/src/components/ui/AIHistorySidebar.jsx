function formatWhen(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  try {
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();

    if (sameDay) {
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

function getPreview(chat) {
  const msgs = Array.isArray(chat?.messages) ? chat.messages : [];
  const last = [...msgs].reverse().find((m) => m?.role === "user" || m?.role === "assistant");
  return last?.text || "No messages yet";
}

export default function AIHistorySidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}) {
  return (
    <aside style={sidebarWrap}>
      <div style={headerWrap}>
        <div>
          <div style={title}>Chats</div>
          <div style={subtitle}>ChatGPT-style history</div>
        </div>

        <button type="button" onClick={onNewChat} style={newBtn}>
          + New Chat
        </button>
      </div>

      <div style={listWrap}>
        {Array.isArray(chats) && chats.length > 0 ? (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;

            return (
              <div
                key={chat.id}
                style={{
                  ...chatItem,
                  ...(isActive ? chatItemActive : null),
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  style={chatMainBtn}
                >
                  <div style={chatTitle}>{chat.title || "New Chat"}</div>
                  <div style={chatPreview}>{getPreview(chat)}</div>
                  <div style={chatMeta}>{formatWhen(chat.updatedAt || chat.createdAt)}</div>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteChat(chat.id)}
                  style={deleteBtn}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            );
          })
        ) : (
          <div style={emptyState}>
            No chat history yet.
            <br />
            Start a new AI conversation.
          </div>
        )}
      </div>
    </aside>
  );
}

const sidebarWrap = {
  width: "100%",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  borderRadius: 22,
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(13,18,34,0.98), rgba(10,14,28,0.98))",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
  minHeight: 0,
};

const headerWrap = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const title = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 18,
};

const subtitle = {
  color: "rgba(220,228,255,0.70)",
  fontSize: 12,
  marginTop: 3,
};

const newBtn = {
  border: "1px solid rgba(109,157,255,0.35)",
  background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const listWrap = {
  flex: 1,
  overflowY: "auto",
  padding: 12,
  display: "grid",
  gap: 10,
};

const chatItem = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "stretch",
  gap: 8,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
  padding: 8,
};

const chatItemActive = {
  background: "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(99,102,241,0.18))",
  border: "1px solid rgba(120,162,255,0.34)",
};

const chatMainBtn = {
  border: "none",
  background: "transparent",
  textAlign: "left",
  padding: 4,
  cursor: "pointer",
  color: "#fff",
  minWidth: 0,
};

const chatTitle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chatPreview = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.4,
  color: "rgba(224,232,255,0.72)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const chatMeta = {
  marginTop: 8,
  fontSize: 11,
  color: "rgba(200,210,240,0.60)",
  fontWeight: 700,
};

const deleteBtn = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 20,
  lineHeight: 1,
  alignSelf: "start",
};

const emptyState = {
  color: "rgba(220,228,255,0.72)",
  fontSize: 13,
  lineHeight: 1.6,
  textAlign: "center",
  padding: 24,
};