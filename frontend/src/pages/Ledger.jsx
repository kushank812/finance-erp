// src/pages/Ledger.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  LineChart,
  Line,
} from "recharts";

import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import {
  page,
  stack,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle,
  field,
  labelStyle,
  input,
  tableWrap,
  table,
  th,
  thCenter,
  thRight,
  tr,
  td,
  tdCode,
  tdCenter,
  tdRight,
  emptyTd,
  btnPrimary,
  btnSecondary,
  btnGhost,
  badgeBlue,
  badgeGreen,
  badgeAmber,
  badgeGray,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function moneyCompact(n) {
  const x = Number(n || 0);

  if (Math.abs(x) >= 10000000) return `${(x / 10000000).toFixed(2)} Cr`;
  if (Math.abs(x) >= 100000) return `${(x / 100000).toFixed(2)} L`;
  if (Math.abs(x) >= 1000) return `${(x / 1000).toFixed(1)} K`;
  return `${x.toFixed(0)}`;
}

function isoToDisplay(iso) {
  if (!iso) return "-";
  const s = String(iso).trim();
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return s;
  return `${dd}/${mm}/${yyyy}`;
}

function getStatus(row) {
  return String(row?.status || "").toUpperCase();
}

function isCancelled(row) {
  return getStatus(row) === "CANCELLED";
}

function isOverdue(row) {
  return getStatus(row) === "OVERDUE";
}

function buildStatusOptions() {
  return ["", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"];
}

function getDocNo(row, tab) {
  return tab === "AR" ? row.invoice_no : row.bill_no;
}

function getPartyCode(row, tab) {
  return tab === "AR" ? row.customer_code : row.vendor_code;
}

function getDocDate(row, tab) {
  return tab === "AR" ? row.invoice_date : row.bill_date;
}

function getSettledAmount(row, tab) {
  return tab === "AR" ? row.amount_received : row.amount_paid;
}

function sortLatestFirst(rows, tab) {
  return [...rows].sort((a, b) => {
    const dateA = getDocDate(a, tab) ? new Date(getDocDate(a, tab)).getTime() : 0;
    const dateB = getDocDate(b, tab) ? new Date(getDocDate(b, tab)).getTime() : 0;

    if (dateB !== dateA) return dateB - dateA;

    const noA = String(getDocNo(a, tab) || "");
    const noB = String(getDocNo(b, tab) || "");
    return noB.localeCompare(noA, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

const PIE_COLORS = {
  Active: "#22c55e",
  Overdue: "#ef4444",
  Cancelled: "#9ca3af",
};

export default function Ledger() {
  const nav = useNavigate();
  const location = useLocation();

  const [arRows, setArRows] = useState([]);
  const [apRows, setApRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState("AR");

  const [arFilters, setArFilters] = useState({
    q: "",
    status: "",
  });

  const [apFilters, setApFilters] = useState({
    q: "",
    status: "",
  });

  async function load() {
    setErr("");
    setLoading(true);

    try {
      const [ar, ap] = await Promise.all([
        apiGet("/sales-invoices/"),
        apiGet("/purchase-invoices/"),
      ]);

      const safeAr = Array.isArray(ar) ? ar : [];
      const safeAp = Array.isArray(ap) ? ap : [];

      setArRows(sortLatestFirst(safeAr, "AR"));
      setApRows(sortLatestFirst(safeAp, "AP"));
    } catch (e) {
      setErr(String(e.message || e));
      setArRows([]);
      setApRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.key]);

  const activeFilters = tab === "AR" ? arFilters : apFilters;
  const setActiveFilters = tab === "AR" ? setArFilters : setApFilters;
  const rawRows = tab === "AR" ? arRows : apRows;

  const filteredRows = useMemo(() => {
    const q = String(activeFilters.q || "").trim().toLowerCase();
    const status = String(activeFilters.status || "").toUpperCase();

    const rows = rawRows.filter((r) => {
      const numberText = String(getDocNo(r, tab) || "").toLowerCase();
      const partyCode = String(getPartyCode(r, tab) || "").toLowerCase();
      const rowStatus = getStatus(r);

      const qMatch =
        !q ||
        numberText.includes(q) ||
        partyCode.includes(q) ||
        String(r.grand_total || "").toLowerCase().includes(q) ||
        String(r.balance || "").toLowerCase().includes(q);

      const statusMatch = !status || rowStatus === status;

      return qMatch && statusMatch;
    });

    return sortLatestFirst(rows, tab);
  }, [rawRows, activeFilters, tab]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        const grand = Number(r.grand_total || 0);
        const balance = Number(r.balance || 0);
        const settled = Number(getSettledAmount(r, tab) || 0);

        acc.totalDocs += 1;
        acc.activeDocs += isCancelled(r) ? 0 : 1;
        acc.cancelledDocs += isCancelled(r) ? 1 : 0;
        acc.overdueDocs += isOverdue(r) ? 1 : 0;

        acc.totalAmount += grand;
        acc.settledAmount += settled;
        acc.balanceAmount += balance;
        acc.overdueBalance += isOverdue(r) ? balance : 0;

        return acc;
      },
      {
        totalDocs: 0,
        activeDocs: 0,
        cancelledDocs: 0,
        overdueDocs: 0,
        totalAmount: 0,
        settledAmount: 0,
        balanceAmount: 0,
        overdueBalance: 0,
      }
    );
  }, [filteredRows, tab]);

  const barData = useMemo(() => {
    return [
      {
        name: "Total",
        value: Number(summary.totalAmount || 0),
      },
      {
        name: tab === "AR" ? "Received" : "Paid",
        value: Number(summary.settledAmount || 0),
      },
      {
        name: "Balance",
        value: Number(summary.balanceAmount || 0),
      },
    ];
  }, [summary, tab]);

  const pieData = useMemo(() => {
    return [
      { name: "Active", value: Number(summary.activeDocs || 0) },
      { name: "Overdue", value: Number(summary.overdueDocs || 0) },
      { name: "Cancelled", value: Number(summary.cancelledDocs || 0) },
    ].filter((x) => x.value > 0);
  }, [summary]);

  const monthlyTrend = useMemo(() => {
    const map = {};

    filteredRows.forEach((r) => {
      const d = getDocDate(r, tab);
      if (!d) return;

      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!map[key]) {
        map[key] = {
          month: key,
          total: 0,
          settled: 0,
          balance: 0,
        };
      }

      map[key].total += Number(r.grand_total || 0);
      map[key].settled += Number(getSettledAmount(r, tab) || 0);
      map[key].balance += Number(r.balance || 0);
    });

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredRows, tab]);

  function onResetFilters() {
    if (tab === "AR") {
      setArFilters({ q: "", status: "" });
    } else {
      setApFilters({ q: "", status: "" });
    }
  }

  function openDocument(row) {
    if (tab === "AR") {
      nav(`/sales-invoice-view/${encodeURIComponent(row.invoice_no)}`);
    } else {
      nav(`/purchase/view/${encodeURIComponent(row.bill_no)}`);
    }
  }

  function openPartyDocument() {
    if (tab === "AR") {
      nav("/sales-invoices");
    } else {
      nav("/purchase-bills");
    }
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="LEDGER"
        title="Accounts Ledger"
        subtitle="Track receivables and payables, review balances, and open related documents."
        actions={
          <>
            <button
              type="button"
              onClick={load}
              style={btnGhost}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button type="button" onClick={openPartyDocument} style={btnPrimary}>
              {tab === "AR" ? "Open Invoices" : "Open Purchase Bills"}
            </button>
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {loading ? <AlertBox kind="info" message="Loading ledger..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Ledger Mode</h2>
            <p style={cardSubtitle}>
              Switch between Accounts Receivable and Accounts Payable.
            </p>
          </div>

          <div style={tabWrap}>
            <button
              type="button"
              onClick={() => setTab("AR")}
              style={tab === "AR" ? tabActiveBlue : tabButton}
            >
              Accounts Receivable
            </button>

            <button
              type="button"
              onClick={() => setTab("AP")}
              style={tab === "AP" ? tabActiveGreen : tabButton}
            >
              Accounts Payable
            </button>
          </div>
        </div>

        <div style={filterGrid}>
          <div style={field}>
            <label style={labelStyle}>
              Search {tab === "AR" ? "Invoice / Customer" : "Bill / Vendor"}
            </label>
            <input
              value={activeFilters.q}
              onChange={(e) =>
                setActiveFilters((prev) => ({ ...prev, q: e.target.value }))
              }
              placeholder={
                tab === "AR"
                  ? "Invoice no / customer code / amount"
                  : "Bill no / vendor code / amount"
              }
              style={input}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>Status</label>
            <select
              value={activeFilters.status}
              onChange={(e) =>
                setActiveFilters((prev) => ({ ...prev, status: e.target.value }))
              }
              style={input}
            >
              {buildStatusOptions().map((status) => (
                <option key={status || "ALL"} value={status}>
                  {status || "ALL"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={filterActions}>
          <button type="button" onClick={onResetFilters} style={btnSecondary}>
            Reset Filters
          </button>
        </div>
      </section>

      <div style={summaryGrid}>
        <SummaryCard
          title={tab === "AR" ? "Total Invoices" : "Total Bills"}
          value={summary.totalDocs}
          badge={badgeBlue}
        />
        <SummaryCard
          title="Active Documents"
          value={summary.activeDocs}
          badge={badgeGreen}
        />
        <SummaryCard
          title="Cancelled"
          value={summary.cancelledDocs}
          badge={badgeGray}
        />
        <SummaryCard
          title="Overdue"
          value={summary.overdueDocs}
          badge={badgeAmber}
        />
        <SummaryCard title="Total Amount" value={money(summary.totalAmount)} />
        <SummaryCard
          title={tab === "AR" ? "Received" : "Paid"}
          value={money(summary.settledAmount)}
        />
        <SummaryCard
          title="Outstanding Balance"
          value={money(summary.balanceAmount)}
        />
        <SummaryCard
          title="Overdue Balance"
          value={money(summary.overdueBalance)}
        />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Ledger Analysis</h2>
            <p style={cardSubtitle}>
              Visual overview of totals, settlements, balances, and document distribution.
            </p>
          </div>
        </div>

        <div style={chartGrid}>
          <div style={chartCard}>
            <div style={chartHeading}>Monthly Movement</div>
            <div style={chartSubHeading}>
              Track billed value, settled value, and balance trend over time.
            </div>

            <div style={chartWrap}>
              {monthlyTrend.length === 0 ? (
                <div style={emptyChartText}>No trend data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyTrend}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => moneyCompact(v)} />
                    <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="settled"
                      name={tab === "AR" ? "Received" : "Paid"}
                      stroke="#16a34a"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Balance"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={chartCard}>
            <div style={chartHeading}>Amount Distribution</div>
            <div style={chartSubHeading}>
              Compare total amount, settled amount, and outstanding balance.
            </div>

            <div style={chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => moneyCompact(v)} />
                  <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCard}>
            <div style={chartHeading}>Document Status Distribution</div>
            <div style={chartSubHeading}>
              See how many documents are active, overdue, or cancelled.
            </div>

            <div style={chartWrap}>
              {pieData.length === 0 ? (
                <div style={emptyChartText}>No status data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={3}
                      label
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {tab === "AR" ? "Receivables Ledger" : "Payables Ledger"}
            </h2>
            <p style={cardSubtitle}>
              {loading
                ? "Loading ledger records..."
                : `${filteredRows.length} record(s) shown`}
            </p>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={th}>{tab === "AR" ? "Invoice No" : "Bill No"}</th>
                <th style={th}>{tab === "AR" ? "Customer" : "Vendor"}</th>
                <th style={th}>Date</th>
                <th style={th}>Due Date</th>
                <th style={thRight}>Grand Total</th>
                <th style={thRight}>{tab === "AR" ? "Received" : "Paid"}</th>
                <th style={thRight}>Balance</th>
                <th style={thCenter}>Status</th>
                <th style={thCenter}>Action</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="9" style={emptyTd}>
                    No ledger records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const docNo = getDocNo(row, tab);
                  const partyCode = getPartyCode(row, tab);
                  const dateValue = getDocDate(row, tab);
                  const settled = getSettledAmount(row, tab);
                  const status = getStatus(row);

                  return (
                    <tr key={docNo} style={tr}>
                      <td style={tdCode}>{docNo}</td>
                      <td style={td}>{partyCode || "-"}</td>
                      <td style={td}>{isoToDisplay(dateValue)}</td>
                      <td style={td}>{isoToDisplay(row.due_date)}</td>
                      <td style={tdRight}>{money(row.grand_total)}</td>
                      <td style={tdRight}>{money(settled)}</td>
                      <td style={tdRight}>{money(row.balance)}</td>
                      <td style={tdCenter}>
                        <span style={statusBadge(status)}>{status}</span>
                      </td>
                      <td style={tdCenter}>
                        <button
                          type="button"
                          onClick={() => openDocument(row)}
                          style={btnPrimary}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={footNote}>
          {tab === "AR"
            ? "Receivables ledger is built from sales invoices and receipt activity."
            : "Payables ledger is built from purchase bills and vendor payment activity."}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, badge }) {
  return (
    <div style={summaryCard}>
      <div style={summaryHead}>
        <div style={summaryTitle}>{title}</div>
        {badge ? <span style={badge}>LIVE</span> : null}
      </div>
      <div style={summaryValue}>{value}</div>
    </div>
  );
}

function statusBadge(status) {
  const s = String(status || "").toUpperCase();

  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  };

  if (s === "PAID") {
    return {
      ...base,
      background: "#ecfff1",
      color: "#116b2f",
      border: "1px solid #a6e0b8",
    };
  }

  if (s === "PARTIAL") {
    return {
      ...base,
      background: "#fff8e8",
      color: "#8a5a00",
      border: "1px solid #edd28a",
    };
  }

  if (s === "OVERDUE") {
    return {
      ...base,
      background: "#fff2f2",
      color: "#c40000",
      border: "1px solid #efb0b0",
    };
  }

  if (s === "CANCELLED") {
    return {
      ...base,
      background: "#f0f0f0",
      color: "#555",
      border: "1px solid #d5d5dd",
    };
  }

  return {
    ...base,
    background: "#eef4ff",
    color: "#0b5cff",
    border: "1px solid #b7cbff",
  };
}

const tabWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const tabButton = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const tabActiveBlue = {
  ...tabButton,
  background: "#eef4ff",
  color: "#0b5cff",
  border: "1px solid #b7cbff",
};

const tabActiveGreen = {
  ...tabButton,
  background: "#ecfff1",
  color: "#116b2f",
  border: "1px solid #a6e0b8",
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const filterActions = {
  display: "flex",
  justifyContent: "flex-end",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryCard = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
};

const summaryHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const summaryTitle = {
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
};

const summaryValue = {
  marginTop: 8,
  fontSize: 22,
  fontWeight: 900,
  color: "#111",
};

const chartGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 14,
};

const chartCard = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
};

const chartHeading = {
  fontSize: 14,
  fontWeight: 900,
  color: "#111",
};

const chartSubHeading = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 4,
};

const chartWrap = {
  width: "100%",
  height: 300,
  marginTop: 10,
};

const emptyChartText = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748b",
  fontWeight: 700,
};

const footNote = {
  marginTop: 12,
  fontSize: 12,
  color: "#666",
};