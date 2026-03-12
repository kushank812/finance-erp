// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

function moneyINR(n) {
  const x = Number(n || 0);
  return x.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <div style={topWrap}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Dashboard</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Summary of receivables, payables and overdue amounts.
          </p>
        </div>

        <button onClick={load} style={btnGhost} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      {loading && !data ? (
        <div style={{ color: "#b8b8b8" }}>Loading dashboard...</div>
      ) : !data ? (
        <div style={{ color: "#b8b8b8" }}>No dashboard data available.</div>
      ) : (
        <>
          <div style={grid}>
            <Card
              title="Total Receivables (AR)"
              value={`₹ ${moneyINR(data.receivables)}`}
              hint="Total invoiced amount from sales"
            />
            <Card
              title="Total Payables (AP)"
              value={`₹ ${moneyINR(data.payables)}`}
              hint="Total amount from purchase bills"
            />
            <Card
              title="Overdue Receivables"
              value={`₹ ${moneyINR(data.overdue_receivables)}`}
              danger
              hint="Outstanding AR marked as overdue"
            />
            <Card
              title="Overdue Payables"
              value={`₹ ${moneyINR(data.overdue_payables)}`}
              danger
              hint="Outstanding AP marked as overdue"
            />
          </div>

          <div style={{ height: 14 }} />

          <div style={summaryGrid}>
            <MiniCard
              title="Net Position"
              value={`₹ ${moneyINR((data.receivables || 0) - (data.payables || 0))}`}
              hint="Receivables minus payables"
            />
            <MiniCard
              title="Total Overdue Exposure"
              value={`₹ ${moneyINR(
                (data.overdue_receivables || 0) + (data.overdue_payables || 0)
              )}`}
              hint="Combined overdue AR + AP"
            />
          </div>
        </>
      )}
    </div>
  );
}

function Card({ title, value, hint, danger }) {
  return (
    <div
      style={{
        ...card,
        borderColor: danger ? "#ffb3b3" : "#e6e6e6",
        background: danger ? "#fff7f7" : "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>{title}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: danger ? "#a40000" : "#111",
          marginTop: 6,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>{hint}</div>
    </div>
  );
}

function MiniCard({ title, value, hint }) {
  return (
    <div style={{ ...card, background: "#f8f9fb" }}>
      <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#111", marginTop: 6 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>{hint}</div>
    </div>
  );
}

/* ---- styles ---- */

const topWrap = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  marginBottom: 20, // 👈 THIS creates the gap you want
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginTop: 12,
  marginBottom: 12,
};