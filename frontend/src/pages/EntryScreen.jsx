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

function SectionStatCard({ title, desc, pillText, pillStyle }) {
  return (
    <div style={sectionStatCard}>
      <div style={sectionStatHead}>
        <div style={sectionStatTitle}>{title}</div>
        {pillText ? <span style={pillStyle}>{pillText}</span> : null}
      </div>
      <div style={sectionStatDesc}>{desc}</div>
    </div>
  );
}

function QuickActionCard({
  title,
  desc,
  action,
  onClick,
  badgeText,
  badgeStyle,
  tone = "primary",
}) {
  const buttonStyle =
    tone === "secondary" ? btnSecondary : tone === "ghost" ? btnGhost : btnPrimary;

  return (
    <div style={quickCard}>
      <div style={quickTop}>
        <div style={quickHeaderRow}>
          <h3 style={quickTitle}>{title}</h3>
          {badgeText ? <span style={badgeStyle}>{badgeText}</span> : null}
        </div>
        <p style={quickDesc}>{desc}</p>
      </div>

      <button onClick={onClick} style={buttonStyle} type="button">
        {action}
      </button>
    </div>
  );
}

function ShortcutButton({ label, subtext, onClick }) {
  return (
    <button type="button" onClick={onClick} style={shortcutBtn}>
      <div style={shortcutLabel}>{label}</div>
      <div style={shortcutSubtext}>{subtext}</div>
    </button>
  );
}

function WorkflowItem({ step, title, desc }) {
  return (
    <div style={workflowItem}>
      <div style={workflowStep}>{step}</div>
      <div>
        <div style={workflowTitle}>{title}</div>
        <div style={workflowDesc}>{desc}</div>
      </div>
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
          <div style={headerActions}>
            <button onClick={() => nav("/dashboard")} style={btnSecondary} type="button">
              Open Dashboard
            </button>
            <button onClick={() => nav("/ai")} style={btnPrimary} type="button">
              Open AI Workspace
            </button>
          </div>
        }
      />

      <div style={sectionStatGrid}>
        <SectionStatCard
          title="Accounts Receivable"
          desc="Create invoices, record receipts, and monitor customer collections."
          pillText="AR"
          pillStyle={badgeBlue}
        />
        <SectionStatCard
          title="Accounts Payable"
          desc="Create purchase bills, record vendor payments, and control payables."
          pillText="AP"
          pillStyle={badgeGreen}
        />
        <SectionStatCard
          title="Reports & Review"
          desc="Check ledger, aging, statements, and operational follow-up from one workflow."
          pillText="REPORTS"
          pillStyle={badgeAmber}
        />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Primary Transactions</h2>
            <p style={cardSubtitle}>
              These are the main finance actions users perform every day.
            </p>
          </div>
        </div>

        <div style={quickGrid}>
          <QuickActionCard
            title="Create Sales Invoice"
            desc="Create a customer invoice, add item lines, calculate totals, and generate receivables."
            action="Create Invoice"
            onClick={() => nav("/billing")}
            badgeText="AR"
            badgeStyle={badgeBlue}
          />

          <QuickActionCard
            title="Record Customer Receipt"
            desc="Capture customer payment against open invoices and reduce outstanding balance."
            action="Create Receipt"
            onClick={() => nav("/receipt/new")}
            badgeText="AR"
            badgeStyle={badgeBlue}
          />

          <QuickActionCard
            title="Create Purchase Bill"
            desc="Enter supplier bill details to create payables and update purchase-side records."
            action="Create Bill"
            onClick={() => nav("/purchase/new")}
            badgeText="AP"
            badgeStyle={badgeGreen}
          />

          <QuickActionCard
            title="Record Vendor Payment"
            desc="Post payment to vendors and reduce open payable balances properly."
            action="Pay Vendor"
            onClick={() => nav("/purchase/pay")}
            badgeText="AP"
            badgeStyle={badgeGreen}
          />
        </div>
      </section>

      <div style={twoColGrid}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>Document Access</h2>
              <p style={cardSubtitle}>
                Open your saved transaction documents and review existing records.
              </p>
            </div>
          </div>

          <div style={shortcutGrid}>
            <ShortcutButton
              label="Sales Invoices"
              subtext="Open invoice list, view status, and print records."
              onClick={() => nav("/sales-invoices")}
            />
            <ShortcutButton
              label="Receipts"
              subtext="Open customer receipt records and verify collections."
              onClick={() => nav("/receipts")}
            />
            <ShortcutButton
              label="Purchase Bills"
              subtext="Review supplier bills and payable records."
              onClick={() => nav("/purchase-bills")}
            />
            <ShortcutButton
              label="Vendor Payments"
              subtext="Review recorded vendor payments and payment history."
              onClick={() => nav("/vendor-payments")}
            />
          </div>
        </section>

        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>Reporting & Analysis</h2>
              <p style={cardSubtitle}>
                Open finance reports to monitor balances, due amounts, and follow-up priorities.
              </p>
            </div>
          </div>

          <div style={shortcutGrid}>
            <ShortcutButton
              label="Ledger"
              subtext="Track receivable and payable movement with balances."
              onClick={() => nav("/ledger")}
            />
            <ShortcutButton
              label="Aging Report"
              subtext="Analyze overdue buckets and collection urgency."
              onClick={() => nav("/aging")}
            />
            <ShortcutButton
              label="Statement"
              subtext="Review party-wise account statement and transaction trail."
              onClick={() => nav("/statement")}
            />
            <ShortcutButton
              label="Dashboard"
              subtext="See high-level KPIs, counts, and balance summaries."
              onClick={() => nav("/dashboard")}
            />
          </div>
        </section>
      </div>

      <div style={twoColGrid}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>Masters</h2>
              <p style={cardSubtitle}>
                Maintain clean master records before creating transactions.
              </p>
            </div>
          </div>

          <div style={shortcutGrid}>
            <ShortcutButton
              label="Customer Master"
              subtext="Create and maintain customer details."
              onClick={() => nav("/customers")}
            />
            <ShortcutButton
              label="Item Master"
              subtext="Maintain items, rates, and related product data."
              onClick={() => nav("/items")}
            />
            <ShortcutButton
              label="Vendor Master"
              subtext="Create and maintain supplier details."
              onClick={() => nav("/vendors")}
            />
            <ShortcutButton
              label="AI Workspace"
              subtext="Ask questions, generate summaries, and explore finance insights."
              onClick={() => nav("/ai")}
            />
          </div>
        </section>

        <section style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>Recommended Workflow</h2>
              <p style={cardSubtitle}>
                Use this sequence to operate the project smoothly during demo or daily work.
              </p>
            </div>
          </div>

          <div style={workflowList}>
            <WorkflowItem
              step="1"
              title="Maintain master data"
              desc="Create customer, vendor, and item records first so transaction entry stays clean."
            />
            <WorkflowItem
              step="2"
              title="Create finance transactions"
              desc="Enter invoices and purchase bills, then record receipts and vendor payments."
            />
            <WorkflowItem
              step="3"
              title="Review documents"
              desc="Open saved invoices, receipts, bills, and payments to verify statuses and balances."
            />
            <WorkflowItem
              step="4"
              title="Check reports and AI insights"
              desc="Open ledger, aging, statement, dashboard, and AI workspace for analysis and follow-up."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

const headerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const sectionStatGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const sectionStatCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 16,
};

const sectionStatHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const sectionStatTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};

const sectionStatDesc = {
  color: "#b8b8b8",
  marginTop: 8,
  lineHeight: 1.5,
  fontSize: 13,
};

const quickGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const quickCard = {
  background: "#ffffff",
  border: "1px solid #e6e6e6",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 14,
  minHeight: 210,
};

const quickTop = {
  display: "grid",
  gap: 8,
};

const quickHeaderRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const quickTitle = {
  margin: 0,
  color: "#111",
  fontWeight: 900,
  lineHeight: 1.3,
  fontSize: 18,
};

const quickDesc = {
  margin: 0,
  color: "#555",
  lineHeight: 1.5,
  fontSize: 14,
};

const twoColGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const shortcutGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const shortcutBtn = {
  border: "1px solid #d9dee7",
  background: "#fff",
  borderRadius: 16,
  padding: 14,
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(0,0,0,0.05)",
  display: "grid",
  gap: 6,
};

const shortcutLabel = {
  color: "#111827",
  fontWeight: 900,
  fontSize: 15,
  lineHeight: 1.3,
};

const shortcutSubtext = {
  color: "#5b6472",
  fontSize: 13,
  lineHeight: 1.45,
};

const workflowList = {
  display: "grid",
  gap: 12,
};

const workflowItem = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: 12,
  alignItems: "start",
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 14,
};

const workflowStep = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 16,
  boxShadow: "0 10px 20px rgba(37,99,235,0.25)",
};

const workflowTitle = {
  color: "#111827",
  fontWeight: 900,
  fontSize: 15,
  lineHeight: 1.3,
};

const workflowDesc = {
  color: "#5b6472",
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 4,
};