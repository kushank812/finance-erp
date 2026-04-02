// src/pages/EntryScreen.jsx
import { useNavigate } from "react-router-dom";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import {
  page,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle,
  btnPrimary,
  btnSecondary,
  btnGhost,
  badgeBlue,
  badgeGreen,
  badgeAmber,
} from "../components/ui/uiStyles";

function ActionCard({ title, desc, action, onClick, badge }) {
  return (
    <div style={actionCard}>
      <div style={actionTop}>
        <div style={actionHeaderRow}>
          <h3 style={actionTitle}>{title}</h3>
          {badge ? <span style={badge}>{action}</span> : null}
        </div>
        <p style={actionDesc}>{desc}</p>
      </div>

      <button onClick={onClick} style={btnPrimary} type="button">
        {action}
      </button>
    </div>
  );
}

function QuickStat({ title, desc, badge }) {
  return (
    <div style={statCard}>
      <div style={statHead}>
        <div style={statTitle}>{title}</div>
        {badge ? <span style={badge}>LIVE</span> : null}
      </div>
      <div style={statDesc}>{desc}</div>
    </div>
  );
}

export default function EntryScreen() {
  const nav = useNavigate();

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="ENTRY"
        title="Billing & Accounting Entry"
        subtitle="Manage receivables, payables, masters, and reports from one place."
        actions={
          <button onClick={() => nav("/dashboard")} style={btnSecondary} type="button">
            Open Dashboard
          </button>
        }
      />

      <div style={statGrid}>
        <QuickStat
          title="Accounts Receivable"
          desc="Create bills and collect receipts."
          badge={badgeBlue}
        />
        <QuickStat
          title="Accounts Payable"
          desc="Create purchase bills and record vendor payments."
          badge={badgeGreen}
        />
        <QuickStat
          title="Reports"
          desc="Use Ledger and Aging to track balances."
          badge={badgeAmber}
        />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Transactions</h2>
            <p style={cardSubtitle}>Choose what you want to do next.</p>
          </div>
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
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Masters</h2>
            <p style={cardSubtitle}>
              Maintain customer, item, and vendor master data.
            </p>
          </div>
        </div>

        <div style={mastersRow}>
          <button onClick={() => nav("/customers")} style={btnGhost} type="button">
            Customer Master
          </button>
          <button onClick={() => nav("/items")} style={btnGhost} type="button">
            Item Master
          </button>
          <button onClick={() => nav("/vendors")} style={btnGhost} type="button">
            Vendor Master
          </button>
        </div>
      </section>
    </div>
  );
}

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const statCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 16,
};

const statHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const statTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const statDesc = {
  color: "#b8b8b8",
  marginTop: 8,
  lineHeight: 1.45,
  fontSize: 13,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const actionCard = {
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

const actionTop = {
  display: "grid",
  gap: 8,
};

const actionHeaderRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const actionTitle = {
  margin: 0,
  color: "#111",
  fontWeight: 900,
  lineHeight: 1.3,
};

const actionDesc = {
  margin: 0,
  color: "#555",
  lineHeight: 1.45,
};

const mastersRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "end",
};