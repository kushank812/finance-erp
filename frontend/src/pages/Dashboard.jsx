// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

function moneyINR(n) {
  const x = Number(n || 0);
  return x.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function num(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? x : 0;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await apiGet("/dashboard/summary");
      setData(res);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const computed = useMemo(() => {
    if (!data) {
      return {
        netPosition: 0,
        overdueExposure: 0,
      };
    }

    return {
      netPosition: num(data.receivables) - num(data.payables),
      overdueExposure:
        num(data.overdue_receivables) + num(data.overdue_payables),
    };
  }, [data]);

  return (
    <div style={page}>
      {/* HEADER */}
      <div style={header}>
        <div>
          <h1 style={title}>Dashboard</h1>
          <p style={subtitle}>
            Real-time overview of receivables, payables, and financial activity.
          </p>
        </div>

        <button onClick={load} style={btnGhost} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      {/* LOADING */}
      {loading && !data ? (
        <div style={infoText}>Loading dashboard...</div>
      ) : !data ? (
        <div style={infoText}>No dashboard data available.</div>
      ) : (
        <>
          {/* MAIN CARDS */}
          <div style={grid4}>
            <BigCard
              title="Receivables (AR)"
              value={`₹ ${moneyINR(data.receivables)}`}
              hint="Total sales invoices"
            />
            <BigCard
              title="Payables (AP)"
              value={`₹ ${moneyINR(data.payables)}`}
              hint="Total purchase bills"
            />
            <BigCard
              title="Overdue Receivables"
              value={`₹ ${moneyINR(data.overdue_receivables)}`}
              danger
            />
            <BigCard
              title="Overdue Payables"
              value={`₹ ${moneyINR(data.overdue_payables)}`}
              danger
            />
          </div>

          {/* SUMMARY */}
          <div style={grid4}>
            <MiniCard
              title="Net Position"
              value={`₹ ${moneyINR(computed.netPosition)}`}
            />
            <MiniCard
              title="Overdue Exposure"
              value={`₹ ${moneyINR(computed.overdueExposure)}`}
            />
            <MiniCard
              title="Today's Receipts"
              value={`₹ ${moneyINR(data.today_receipts)}`}
            />
            <MiniCard
              title="Today's Payments"
              value={`₹ ${moneyINR(data.today_vendor_payments)}`}
            />
          </div>

          {/* STATUS PANELS */}
          <div style={dualGrid}>
            <StatusPanel
              title="Sales (AR)"
              data={[
                ["Invoices", data.sales_invoice_count],
                ["Pending", data.sales_pending_count],
                ["Partial", data.sales_partial_count],
                ["Paid", data.sales_paid_count],
                ["Overdue", data.sales_overdue_count],
                ["Cancelled", data.sales_cancelled_count],
              ]}
            />

            <StatusPanel
              title="Purchase (AP)"
              data={[
                ["Bills", data.purchase_bill_count],
                ["Pending", data.purchase_pending_count],
                ["Partial", data.purchase_partial_count],
                ["Paid", data.purchase_paid_count],
                ["Overdue", data.purchase_overdue_count],
                ["Cancelled", data.purchase_cancelled_count],
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- COMPONENTS ---------- */

function BigCard({ title, value, hint, danger }) {
  return (
    <div
      style={{
        ...card,
        background: danger ? "#fff5f5" : "#fff",
        borderColor: danger ? "#ffb3b3" : "#e6e6e6",
      }}
    >
      <div style={cardLabel}>{title}</div>
      <div style={{ ...cardValue, color: danger ? "#a40000" : "#111" }}>
        {value}
      </div>
      {hint && <div style={cardHint}>{hint}</div>}
    </div>
  );
}

function MiniCard({ title, value }) {
  return (
    <div style={{ ...card, background: "#f8f9fb" }}>
      <div style={cardLabel}>{title}</div>
      <div style={{ ...cardValue, fontSize: 22 }}>{value}</div>
    </div>
  );
}

function StatusPanel({ title, data }) {
  return (
    <div style={panel}>
      <div style={panelTitle}>{title}</div>

      <div style={statGrid}>
        {data.map(([label, value]) => (
          <div key={label} style={statCard}>
            <div style={statLabel}>{label}</div>
            <div style={statValue}>{value ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const page = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 18,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: 18,
};

const title = {
  margin: 0,
  color: "#fff",
  fontSize: 28,
  fontWeight: 900,
};

const subtitle = {
  marginTop: 6,
  color: "#b8b8b8",
};

const grid4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const dualGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 14,
};

const panel = {
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const panelTitle = {
  fontWeight: 900,
  marginBottom: 10,
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const statCard = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 10,
};

const statLabel = {
  fontSize: 12,
  color: "#666",
};

const statValue = {
  fontSize: 18,
  fontWeight: 900,
};

const card = {
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const cardLabel = {
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
};

const cardValue = {
  fontSize: 26,
  fontWeight: 900,
  marginTop: 6,
};

const cardHint = {
  fontSize: 12,
  color: "#666",
  marginTop: 6,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
};

const infoText = {
  color: "#b8b8b8",
};