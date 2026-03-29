import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

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

const SALES_COLORS = ["#22c55e", "#f59e0b", "#facc15", "#ef4444"];
const PURCHASE_COLORS = ["#22c55e", "#f59e0b", "#facc15", "#ef4444"];

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
      overdueExposure: num(data.overdue_receivables) + num(data.overdue_payables),
    };
  }, [data]);

  const receivablePayableChart = useMemo(() => {
    if (!data) return [];
    return [
      {
        name: "Receivables",
        value: num(data.receivables),
      },
      {
        name: "Payables",
        value: num(data.payables),
      },
      {
        name: "Overdue AR",
        value: num(data.overdue_receivables),
      },
      {
        name: "Overdue AP",
        value: num(data.overdue_payables),
      },
    ];
  }, [data]);

  const salesStatusChart = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Paid", value: num(data.sales_paid_count) },
      { name: "Pending", value: num(data.sales_pending_count) },
      { name: "Partial", value: num(data.sales_partial_count) },
      { name: "Overdue", value: num(data.sales_overdue_count) },
    ];
  }, [data]);

  const purchaseStatusChart = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Paid", value: num(data.purchase_paid_count) },
      { name: "Pending", value: num(data.purchase_pending_count) },
      { name: "Partial", value: num(data.purchase_partial_count) },
      { name: "Overdue", value: num(data.purchase_overdue_count) },
    ];
  }, [data]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <div style={topWrap}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Dashboard</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Summary of receivables, payables, collections, payments and overdue exposure.
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
          <div style={sectionTitle}>Financial Summary</div>
          <div style={grid}>
            <Card
              title="Total Receivables (AR)"
              value={`₹ ${moneyINR(data.receivables)}`}
              hint="Total sales invoice value"
            />
            <Card
              title="Total Payables (AP)"
              value={`₹ ${moneyINR(data.payables)}`}
              hint="Total purchase bill value"
            />
            <Card
              title="Overdue Receivables"
              value={`₹ ${moneyINR(data.overdue_receivables)}`}
              danger
              hint="Outstanding AR marked overdue"
            />
            <Card
              title="Overdue Payables"
              value={`₹ ${moneyINR(data.overdue_payables)}`}
              danger
              hint="Outstanding AP marked overdue"
            />
          </div>

          <div style={{ height: 14 }} />

          <div style={summaryGrid}>
            <MiniCard
              title="Net Position"
              value={`₹ ${moneyINR(computed.netPosition)}`}
              hint="Receivables minus payables"
            />
            <MiniCard
              title="Total Overdue Exposure"
              value={`₹ ${moneyINR(computed.overdueExposure)}`}
              hint="Combined overdue AR + AP"
            />
            <MiniCard
              title="Today's Receipts"
              value={`₹ ${moneyINR(data.today_receipts)}`}
              hint="Customer collections posted today"
            />
            <MiniCard
              title="Today's Vendor Payments"
              value={`₹ ${moneyINR(data.today_vendor_payments)}`}
              hint="Supplier payments posted today"
            />
          </div>

          <div style={{ height: 18 }} />

          <div style={dualGrid}>
            <div style={panel}>
              <div style={panelTitle}>Sales / AR Status</div>
              <div style={statGrid}>
                <StatTile label="Invoices" value={data.sales_invoice_count} />
                <StatTile label="Pending" value={data.sales_pending_count} />
                <StatTile label="Partial" value={data.sales_partial_count} warn />
                <StatTile label="Paid" value={data.sales_paid_count} ok />
                <StatTile label="Overdue" value={data.sales_overdue_count} danger />
                <StatTile label="Cancelled" value={data.sales_cancelled_count} muted />
              </div>
            </div>

            <div style={panel}>
              <div style={panelTitle}>Purchase / AP Status</div>
              <div style={statGrid}>
                <StatTile label="Bills" value={data.purchase_bill_count} />
                <StatTile label="Pending" value={data.purchase_pending_count} />
                <StatTile label="Partial" value={data.purchase_partial_count} warn />
                <StatTile label="Paid" value={data.purchase_paid_count} ok />
                <StatTile label="Overdue" value={data.purchase_overdue_count} danger />
                <StatTile label="Cancelled" value={data.purchase_cancelled_count} muted />
              </div>
            </div>
          </div>

          <div style={{ height: 22 }} />

          <div style={sectionTitle}>Graphical Analysis</div>

          <div style={chartGrid}>
            <div style={panel}>
              <div style={panelTitle}>Receivables vs Payables</div>
              <div style={chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receivablePayableChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₹ ${moneyINR(value)}`} />
                    <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={panel}>
              <div style={panelTitle}>Sales Status Distribution</div>
              <div style={chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesStatusChart}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      label
                    >
                      {salesStatusChart.map((entry, index) => (
                        <Cell
                          key={`sales-cell-${entry.name}-${index}`}
                          fill={SALES_COLORS[index % SALES_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={panel}>
              <div style={panelTitle}>Purchase Status Distribution</div>
              <div style={chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={purchaseStatusChart}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      label
                    >
                      {purchaseStatusChart.map((entry, index) => (
                        <Cell
                          key={`purchase-cell-${entry.name}-${index}`}
                          fill={PURCHASE_COLORS[index % PURCHASE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
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

function StatTile({ label, value, ok, warn, danger, muted }) {
  let bg = "#fff";
  let border = "#e6e6e6";
  let color = "#111";

  if (ok) {
    bg = "#ecfff1";
    border = "#a6e0b8";
    color = "#116b2f";
  } else if (warn) {
    bg = "#fff8e8";
    border = "#edd28a";
    color = "#8a5a00";
  } else if (danger) {
    bg = "#fff2f2";
    border = "#efb0b0";
    color = "#c40000";
  } else if (muted) {
    bg = "#f0f0f0";
    border = "#d5d5d5";
    color = "#555";
  }

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background: bg,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#666" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color }}>{value ?? 0}</div>
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
  marginBottom: 20,
};

const sectionTitle = {
  fontSize: 14,
  color: "#d7def0",
  fontWeight: 900,
  marginBottom: 10,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const dualGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 14,
};

const chartGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 14,
};

const panel = {
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const panelTitle = {
  fontSize: 14,
  color: "#111",
  fontWeight: 900,
  marginBottom: 12,
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const chartWrap = {
  width: "100%",
  height: 280,
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