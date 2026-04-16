import { useNavigate } from "react-router-dom";
import AIWorkspace from "../components/ui/AIWorkspace";

export default function AIWorkspacePage({ currentUser = null }) {
  const navigate = useNavigate();

  return (
    <div style={pageWrap}>
      <div style={topBar}>
        <div>
          <h2 style={title}>AI Workspace</h2>
          <p style={subtitle}>
            Full AI finance assistant with chat history, reminders, follow-up support,
            report navigation, and live finance insights.
          </p>
        </div>

        <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
          Back to Dashboard
        </button>
      </div>

      <AIWorkspace currentUser={currentUser} />
    </div>
  );
}

const pageWrap = {
  width: "100%",
  maxWidth: 1500,
  margin: "0 auto",
  padding: "0 0 18px",
  boxSizing: "border-box",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const title = {
  margin: 0,
  color: "#fff",
  fontWeight: 900,
  fontSize: 30,
};

const subtitle = {
  margin: "8px 0 0",
  color: "#b8c2d9",
  fontSize: 15,
  lineHeight: 1.5,
};

const backBtn = {
  padding: "11px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};