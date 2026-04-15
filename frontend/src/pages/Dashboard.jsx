import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";
import AIAssistantPanel from "../components/ui/AIAssistantPanel";
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
  LineChart,
  Line,
} from "recharts";

function moneyINR(n) {
  const x = Number(n || 0);
  return x.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function compactINR(n) {
  const x = Number(n || 0);
  if (Math.abs(x) >= 10000000) return `${(x / 10000000).toFixed(2)} Cr`;
  if (Math.abs(x) >= 100000) return `${(x / 100000).toFixed(2)} L`;
  if (Math.abs(x) >= 1000) return `${(x / 1000).toFixed(1)} K`;
  return `${x.toFixed(0)}`;
}

function num(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? x : 0;
}

const STATUS_COLORS = {
  Paid: "#22c55e",
  Pending: "#f59e0b",
  Partial: "#facc15",
  Overdue: "#ef4444",
  Cancelled: "#94a3b8",
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const res = await apiGet("/dashboard/summary");
      setData(res || {});
    } catch (e) {
      setErr(String(e?.message || e));
      setData(null);
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
        totalTodayMovement: 0,
      };
    }

    return {
      netPosition: num(data.receivables) - num(data.payables),
      overdueExposure: num(data.overdue_receivables) + num(data.overdue_payables),
      totalTodayMovement: num(data.today_receipts) + num(data.today_vendor_payments),
    };
  }, [data]);

  const exposureChart = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Receivables", value: num(data.receivables) },
      { name: "Payables", value: num(data.payables) },
      { name: "Overdue AR", value: num(data.overdue_receivables) },
      { name: "Overdue AP", value: num(data.overdue_payables) },
    ];
  }, [data]);

  const salesStatusChart = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Paid", value: num(data.sales_paid_count) },
      { name: "Pending", value: num(data.sales_pending_count) },
      { name: "Partial", value: num(data.sales_partial_count) },
      { name: "Overdue", value: num(data.sales_overdue_count) },
      { name: "Cancelled", value: num(data.sales_cancelled_count) },
    ].filter((x) => x.value > 0);
  }, [data]);

  const purchaseStatusSummary = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Bills", value: num(data.purchase_bill_count) },
      { label: "Pending", value: num(data.purchase_pending_count) },
      { label: "Partial", value: num(data.purchase_partial_count) },
      { label: "Paid", value: num(data.purchase_paid_count) },
      { label: "Overdue", value: num(data.purchase_overdue_count) },
      { label: "Cancelled", value: num(data.purchase_cancelled_count) },
    ];
  }, [data]);

  const agingChart = useMemo(() => {
    if (data?.aging_buckets) {
      return [
        { name: "Not Due", value: num(data.aging_buckets.not_due) },
        { name: "0-30", value: num(data.aging_buckets.b0_30) },
        { name: "31-60", value: num(data.aging_buckets.b31_60) },
        { name: "61-90", value: num(data.aging_buckets.b61_90) },
        { name: "90+", value: num(data.aging_buckets.b90_plus) },
      ];
    }

    const overdue = num(data?.overdue_receivables);
    const current = Math.max(num(data?.receivables) - overdue, 0);

    return [
      { name: "Not Due", value: current },
      { name: "0-30", value: 0 },
      { name: "31-60", value: 0 },
      { name: "61-90", value: 0 },
      { name: "90+", value: overdue },
    ];
  }, [data]);

  const monthlyTrend = useMemo(() => {
    if (Array.isArray(data?.monthly_trend) && data.monthly_trend.length > 0) {
      return data.monthly_trend.map((m) => ({
        month: m.month,
        receivables: num(m.receivables),
        payables: num(m.payables),
        receipts: num(m.receipts),
        payments: num(m.payments),
      }));
    }

    return [
      {
        month: "Current",
        receivables: num(data?.receivables),
        payables: num(data?.payables),
        receipts: num(data?.today_receipts),
        payments: num(data?.today_vendor_payments),
      },
    ];
  }, [data]);

  const topCustomers = useMemo(() => {
    if (Array.isArray(data?.top_customers) && data.top_customers.length > 0) {
      return data.top_customers.slice(0, 7).map((c) => ({
        name: c.customer_name || c.customer_code || c.name || "Customer",
        value: num(c.balance || c.outstanding || c.amount),
      }));
    }
    return [];
  }, [data]);

  return (
    <>
      <div style={pageWrap}>
        <div
          className={`dashboard-grid ${aiOpen ? "dashboard-grid-ai-open" : ""}`}
          style={{
            ...dashboardGrid,
            gridTemplateColumns: aiOpen ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)",
          }}
        >
          <main className="dashboard-main" style={mainCol}>
            <div style={topWrap}>
              <div>
                <h2 style={{ margin: 0, color: "#fff" }}>Dashboard</h2>
                <p style={{ marginTop: 6, color: "#b8b8b8" }}>
                  Real-time summary of receivables, payables, collections,
                  payments and risk exposure.
                </p>
              </div>

              <div style={topButtons}>
                <button onClick={load} style={btnGhost} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/ai")}
                  style={btnAi}
                >
                  Open AI
                </button>
              </div>
            </div>

            {err && <div style={msgErr}>{err}</div>}

            {loading && !data ? (
              <div style={{ color: "#b8b8b8" }}>Loading dashboard...</div>
            ) : !data ? (
              <div style={{ color: "#b8b8b8" }}>No dashboard data available.</div>
            ) : (
              <>
                <div style={sectionTitle}>Financial Summary</div>

                <div style={kpiGrid}>
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
                  <MiniCard
                    title="Total Today Movement"
                    value={`₹ ${moneyINR(computed.totalTodayMovement)}`}
                    hint="Receipts plus vendor payments"
                  />
                </div>

                <div style={{ height: 20 }} />

                <div style={dualGrid}>
                  <div style={panel}>
                    <div style={panelTitle}>Sales / AR Status</div>
                    <div style={statGrid}>
                      <StatTile label="Invoices" value={data.sales_invoice_count} />
                      <StatTile label="Pending" value={data.sales_pending_count} />
                      <StatTile label="Partial" value={data.sales_partial_count} warn />
                      <StatTile label="Paid" value={data.sales_paid_count} ok />
                      <StatTile label="Overdue" value={data.sales_overdue_count} danger />
                      <StatTile
                        label="Cancelled"
                        value={data.sales_cancelled_count}
                        muted
                      />
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
                      <StatTile
                        label="Cancelled"
                        value={data.purchase_cancelled_count}
                        muted
                      />
                    </div>
                  </div>
                </div>

                <div style={{ height: 24 }} />

                <div style={sectionTitle}>Graphical Analysis</div>

                <div style={chartGrid}>
                  <ChartCard
                    title="Monthly Financial Trend"
                    subtitle="Receivables, payables, collections and supplier payments"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyTrend}
                        margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <YAxis
                          tickFormatter={(v) => compactINR(v)}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <Tooltip content={<CustomTrendTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Line
                          type="monotone"
                          dataKey="receivables"
                          name="AR"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="payables"
                          name="AP"
                          stroke="#dc2626"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="receipts"
                          name="Receipts"
                          stroke="#16a34a"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="payments"
                          name="Payments"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Financial Exposure"
                    subtitle="Overall financial exposure and overdue comparison"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={exposureChart}
                        margin={{ top: 10, right: 15, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <YAxis
                          tickFormatter={(v) => compactINR(v)}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <Tooltip content={<CustomMoneyTooltip />} />
                        <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Aging Distribution"
                    subtitle="Outstanding receivables grouped by aging bucket"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={agingChart}
                        margin={{ top: 10, right: 15, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <YAxis
                          tickFormatter={(v) => compactINR(v)}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <Tooltip content={<CustomMoneyTooltip />} />
                        <Bar dataKey="value" fill="#7c3aed" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Sales Status Distribution"
                    subtitle="Current invoice mix by payment status"
                  >
                    {salesStatusChart.length === 0 ? (
                      <EmptyChartState text="No sales status data available." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={salesStatusChart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={62}
                            outerRadius={102}
                            paddingAngle={3}
                            stroke="#ffffff"
                            strokeWidth={2}
                          >
                            {salesStatusChart.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomCountTooltip />} />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Top Outstanding Customers"
                    subtitle="Highest pending customer balances"
                  >
                    {topCustomers.length === 0 ? (
                      <EmptyChartState text="Top customer outstanding data not available." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topCustomers}
                          layout="vertical"
                          margin={{ top: 10, right: 20, left: 20, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => compactINR(v)}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            axisLine={{ stroke: "#cbd5e1" }}
                            tickLine={{ stroke: "#cbd5e1" }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }}
                            axisLine={{ stroke: "#cbd5e1" }}
                            tickLine={{ stroke: "#cbd5e1" }}
                          />
                          <Tooltip content={<CustomMoneyTooltip />} />
                          <Bar dataKey="value" fill="#ef4444" radius={[0, 10, 10, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Purchase Status Snapshot"
                    subtitle="Quick AP operational count summary"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={purchaseStatusSummary}
                        margin={{ top: 10, right: 15, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <YAxis
                          tick={{ fill: "#475569", fontSize: 12 }}
                          axisLine={{ stroke: "#cbd5e1" }}
                          tickLine={{ stroke: "#cbd5e1" }}
                        />
                        <Tooltip content={<CustomCountTooltipLabel />} />
                        <Bar dataKey="value" fill="#0f766e" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </>
            )}
          </main>

          {aiOpen ? (
            <aside className="dashboard-ai" style={aiCol}>
              <div style={aiHeaderRow}>
                <div style={aiTitle}>AI Finance Assistant</div>
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  style={aiCloseBtn}
                >
                  ×
                </button>
              </div>

              <AIAssistantPanel
                title="AI Finance Assistant"
                height="calc(100vh - 180px)"
              />
            </aside>
          ) : null}
        </div>
      </div>

      {!aiOpen ? (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          style={floatingAiBtn}
          title="Open AI Assistant"
          aria-label="Open AI Assistant"
        >
          <span style={floatingAiText}>AI</span>
        </button>
      ) : null}

      <style>{responsiveCss}</style>
    </>
  );
}

function Card({ title, value, hint, danger }) {
  return (
    <div
      style={{
        ...card,
        borderColor: danger ? "#fecaca" : "#e5e7eb",
        background: danger ? "#fff7f7" : "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{title}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: danger ? "#b91c1c" : "#111827",
          marginTop: 6,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{hint}</div>
    </div>
  );
}

function MiniCard({ title, value, hint }) {
  return (
    <div style={{ ...card, background: "#f8fafc" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginTop: 6 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{hint}</div>
    </div>
  );
}

function StatTile({ label, value, ok, warn, danger, muted }) {
  let bg = "#fff";
  let border = "#e5e7eb";
  let color = "#111827";

  if (ok) {
    bg = "#ecfdf5";
    border = "#86efac";
    color = "#166534";
  } else if (warn) {
    bg = "#fffbeb";
    border = "#fcd34d";
    color = "#92400e";
  } else if (danger) {
    bg = "#fef2f2";
    border = "#fca5a5";
    color = "#b91c1c";
  } else if (muted) {
    bg = "#f1f5f9";
    border = "#cbd5e1";
    color = "#475569";
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
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color }}>
        {value ?? 0}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={chartPanel}>
      <div style={{ marginBottom: 10 }}>
        <div style={chartTitle}>{title}</div>
        <div style={chartSubtitle}>{subtitle}</div>
      </div>
      <div style={chartBody}>{children}</div>
    </div>
  );
}

function EmptyChartState({ text }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontWeight: 700,
        fontSize: 14,
        textAlign: "center",
        padding: 16,
      }}
    >
      {text}
    </div>
  );
}

function CustomMoneyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0]?.value;

  return (
    <div style={tooltipBox}>
      <div style={tooltipTitle}>{label}</div>
      <div style={tooltipValue}>₹ {moneyINR(value)}</div>
    </div>
  );
}

function CustomTrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={tooltipBox}>
      <div style={tooltipTitle}>{label}</div>
      {payload.map((item) => (
        <div
          key={item.dataKey}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 4,
            fontSize: 13,
            color: "#111827",
            fontWeight: 700,
          }}
        >
          <span>{item.name}:</span>
          <span>₹ {moneyINR(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CustomCountTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];

  return (
    <div style={tooltipBox}>
      <div style={tooltipTitle}>{item.name}</div>
      <div style={tooltipValue}>{item.value}</div>
    </div>
  );
}

function CustomCountTooltipLabel({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];

  return (
    <div style={tooltipBox}>
      <div style={tooltipTitle}>{label}</div>
      <div style={tooltipValue}>{item.value}</div>
    </div>
  );
}

const pageWrap = {
  width: "100%",
  maxWidth: 1700,
  margin: "0 auto",
  padding: "0 12px 18px",
  boxSizing: "border-box",
};

const dashboardGrid = {
  display: "grid",
  gap: 18,
  alignItems: "start",
  transition: "grid-template-columns 0.25s ease",
};

const mainCol = {
  minWidth: 0,
  padding: 18,
  boxSizing: "border-box",
};

const aiCol = {
  width: "100%",
  minWidth: 0,
  maxWidth: 380,
  position: "sticky",
  top: 86,
  alignSelf: "start",
};

const aiHeaderRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

const aiTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 16,
};

const aiCloseBtn = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
};

const topWrap = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  marginBottom: 20,
};

const topButtons = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const sectionTitle = {
  fontSize: 14,
  color: "#d7def0",
  fontWeight: 900,
  marginBottom: 10,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const dualGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 14,
};

const chartGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 14,
};

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const chartPanel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
};

const panelTitle = {
  fontSize: 14,
  color: "#111827",
  fontWeight: 900,
  marginBottom: 12,
};

const chartTitle = {
  fontSize: 14,
  color: "#111827",
  fontWeight: 900,
};

const chartSubtitle = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 4,
};

const chartBody = {
  width: "100%",
  height: 320,
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.05)",
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

const btnAi = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(96,165,250,0.35)",
  background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 10px 22px rgba(37,99,235,0.24)",
};

const floatingAiBtn = {
  position: "fixed",
  right: 20,
  bottom: 20,
  zIndex: 40,
  width: 60,
  height: 60,
  borderRadius: "50%",
  border: "1px solid rgba(96,165,250,0.35)",
  background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 14px 28px rgba(37,99,235,0.28)",
};

const floatingAiText = {
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const msgErr = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  padding: 10,
  borderRadius: 12,
  color: "#b91c1c",
  marginTop: 12,
  marginBottom: 12,
};

const tooltipBox = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
  boxShadow: "0 10px 18px rgba(15, 23, 42, 0.10)",
};

const tooltipTitle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  marginBottom: 4,
};

const tooltipValue = {
  fontSize: 14,
  fontWeight: 900,
  color: "#111827",
};

const responsiveCss = `
@media (max-width: 1200px) {
  .dashboard-grid-ai-open {
    grid-template-columns: minmax(0, 1fr) 340px !important;
  }
}

@media (max-width: 1024px) {
  .dashboard-grid,
  .dashboard-grid-ai-open {
    grid-template-columns: 1fr !important;
  }

  .dashboard-ai {
    position: static !important;
    top: auto !important;
    max-width: 100% !important;
    margin-top: 8px !important;
  }
}

@media (max-width: 640px) {
  body {
    overflow-x: hidden;
  }

  .dashboard-main {
    padding: 12px !important;
  }

  .recharts-legend-wrapper {
    font-size: 11px !important;
  }
}
`;