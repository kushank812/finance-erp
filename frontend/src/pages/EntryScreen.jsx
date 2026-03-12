// src/pages/EntryScreen.jsx
import { useNavigate } from "react-router-dom";

function ActionCard({ title, desc, action, onClick }) {
  return (
    <div style={card}>
      <div>
        <h3 style={cardTitle}>{title}</h3>
        <p style={cardDesc}>{desc}</p>
      </div>

      <button onClick={onClick} style={btnPrimary}>
        {action}
      </button>
    </div>
  );
}

function QuickStat({ title, desc }) {
  return (
    <div style={statCard}>
      <div style={statTitle}>{title}</div>
      <div style={statDesc}>{desc}</div>
    </div>
  );
}

export default function EntryScreen() {
  const nav = useNavigate();

  return (
    <div style={page}>
      <div style={heroWrap}>
        <div>
          <h2 style={title}>Billing & Accounting Entry</h2>
          <p style={subtitle}>
            Manage receivables, payables, masters, and reports from one place.
          </p>
        </div>

        <button onClick={() => nav("/dashboard")} style={btnGhostDark}>
          Open Dashboard
        </button>
      </div>

      <div style={statGrid}>
        <QuickStat title="Accounts Receivable" desc="Create bills and collect receipts." />
        <QuickStat title="Accounts Payable" desc="Create purchase bills and record vendor payments." />
        <QuickStat title="Reports" desc="Use Ledger and Aging to track balances." />
      </div>

      <div style={{ height: 18 }} />

      <div style={sectionHead}>
        <h3 style={sectionTitle}>Transactions</h3>
        <div style={sectionSub}>Choose what you want to do next.</div>
      </div>

      <div style={grid}>
        <ActionCard
          title="Create New Bill (Invoice)"
          desc="Bill the customer for items and create Accounts Receivable."
          action="Create Bill"
          onClick={() => nav("/billing/new")}
        />
        <ActionCard
          title="Create New Receipt"
          desc="Receive payment from customer and reduce receivable balance."
          action="Create Receipt"
          onClick={() => nav("/receipt/new")}
        />
        <ActionCard
          title="Create Purchase Bill"
          desc="Record supplier bill and create Accounts Payable."
          action="Purchase Bill"
          onClick={() => nav("/purchase/new")}
        />
        <ActionCard
          title="Vendor Payment"
          desc="Pay vendor and reduce payable balance."
          action="Pay Vendor"
          onClick={() => nav("/purchase/pay")}
        />
        <ActionCard
          title="Open Accounts Ledger"
          desc="View receivable and payable schedules with balances."
          action="Open Ledger"
          onClick={() => nav("/ledger")}
        />
        <ActionCard
          title="Aging Report"
          desc="Break open balances into aging buckets for better follow-up."
          action="Open Aging"
          onClick={() => nav("/aging")}
        />
      </div>

      <div style={{ height: 18 }} />

      <div style={mastersCard}>
        <div style={sectionHead}>
          <div>
            <h3 style={{ margin: 0, color: "#111" }}>Masters</h3>
            <p style={{ margin: "6px 0 0 0", color: "#555" }}>
              Maintain customer, item, and vendor master data.
            </p>
          </div>
        </div>

        <div style={toolbarWrap}>
          <button onClick={() => nav("/customers")} style={btnGhost}>
            Customer Master
          </button>
          <button onClick={() => nav("/items")} style={btnGhost}>
            Item Master
          </button>
          <button onClick={() => nav("/vendors")} style={btnGhost}>
            Vendor Master
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- styles ---- */

const page = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 14,
};

const heroWrap = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 12,
  flexWrap: "wrap",
};

const title = {
  margin: 0,
  color: "#fff",
  fontWeight: 950,
};

const subtitle = {
  marginTop: 6,
  marginBottom: 0,
  color: "#b8b8b8",
  maxWidth: 680,
  lineHeight: 1.5,
};

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle = {
  margin: 0,
  color: "#fff",
  fontWeight: 900,
};

const sectionSub = {
  color: "#9aa4b2",
  fontSize: 13,
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const statCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 16,
};

const statTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const statDesc = {
  color: "#b8b8b8",
  marginTop: 8,
  lineHeight: 1.4,
  fontSize: 13,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 14,
  minHeight: 190,
};

const cardTitle = {
  margin: 0,
  color: "#111",
  fontWeight: 900,
  lineHeight: 1.3,
};

const cardDesc = {
  marginTop: 8,
  marginBottom: 0,
  color: "#555",
  lineHeight: 1.45,
};

const btnPrimary = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const mastersCard = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 18,
  padding: 16,
};

const toolbarWrap = {
  display: "flex",
  gap: 10,
  marginTop: 12,
  flexWrap: "wrap",
  alignItems: "end",
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
  color: "#111",
};

const btnGhostDark = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer",
  fontWeight: 800,
  color: "#fff",
};