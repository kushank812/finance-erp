// src/pages/Aging.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../api/client";
import AppDateInput from "../components/ui/AppDateInput";
import { formatDateForDisplay, toISODate, todayISO } from "../utils/date";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
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

function compactMoney(n) {
  const x = Number(n || 0);

  if (Math.abs(x) >= 10000000) return `${(x / 10000000).toFixed(2)} Cr`;
  if (Math.abs(x) >= 100000) return `${(x / 100000).toFixed(2)} L`;
  if (Math.abs(x) >= 1000) return `${(x / 1000).toFixed(1)} K`;
  return `${x.toFixed(0)}`;
}

function isoToDisplay(value) {
  return formatDateForDisplay(value) || "-";
}

function toSafeIso(value) {
  return toISODate(value) || "";
}

function daysBetween(dateISOa, dateISOb) {
  const a = toSafeIso(dateISOa);
  const b = toSafeIso(dateISOb);

  if (!a || !b) return 0;

  const start = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function bucketFromDaysOverdue(days) {
  if (days <= 0) return "Not Due";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function sortRowsByOverdueDays(list) {
  return [...list].sort((a, b) => {
    const overdueA = Number(a?.daysOverdue || 0);
    const overdueB = Number(b?.daysOverdue || 0);

    if (overdueB !== overdueA) return overdueB - overdueA;

    const dueA = a?.dueDate ? new Date(`${a.dueDate}T00:00:00`).getTime() : 0;
    const dueB = b?.dueDate ? new Date(`${b.dueDate}T00:00:00`).getTime() : 0;

    if (dueA !== dueB) return dueA - dueB;

    const docA = String(a?.docNo || "");
    const docB = String(b?.docNo || "");
    return docA.localeCompare(docB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const header = Object.keys(rows[0] || {});
  const lines = [
    header.join(","),
    ...rows.map((r) => header.map((h) => esc(r[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Aging() {
  const location = useLocation();

  const [tab, setTab] = useState("AR");
  const [asOf, setAsOf] = useState(todayISO());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [onlyOpen, setOnlyOpen] = useState(true);

  const [ar, setAr] = useState([]);
  const [ap, setAp] = useState([]);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);

    try {
      const [arData, apData] = await Promise.all([
        apiGet("/sales-invoices/"),
        apiGet("/purchase-invoices/"),
      ]);

      setAr(Array.isArray(arData) ? arData : []);
      setAp(Array.isArray(apData) ? apData : []);
    } catch (e) {
      setErr(String(e.message || e));
      setAr([]);
      setAp([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.key]);

  const rows = useMemo(() => {
    const src = tab === "AR" ? ar : ap;
    const qq = q.trim().toLowerCase();
    const wantedStatus = normalizeStatus(status);
    const asOfIso = toSafeIso(asOf) || todayISO();

    const mapped = src.map((r) => {
      const docNo = tab === "AR" ? r.invoice_no : r.bill_no;
      const party = tab === "AR" ? r.customer_code : r.vendor_code;

      const rawDocDate = tab === "AR" ? r.invoice_date : r.bill_date;
      const docDate = toSafeIso(rawDocDate);
      const dueDate = toSafeIso(r.due_date || rawDocDate);

      const bal = Number(r.balance || 0);
      const effectiveBaseDate = dueDate || docDate || asOfIso;

      const dOver = daysBetween(effectiveBaseDate, asOfIso);
      const daysOverdue = Math.max(0, dOver);
      const bucket = bucketFromDaysOverdue(dOver);
      const rowStatus = normalizeStatus(r.status);

      return {
        docNo: String(docNo || ""),
        party: String(party || ""),
        docDate,
        dueDate,
        daysOverdue,
        bucket,
        balance: bal,
        status: rowStatus,
        remark: r.remark || "",
      };
    });

    const filtered = mapped.filter((r) => {
      if (onlyOpen && !(r.balance > 0)) return false;
      if (wantedStatus !== "ALL" && r.status !== wantedStatus) return false;

      const matches =
        !qq ||
        String(r.docNo).toLowerCase().includes(qq) ||
        String(r.party).toLowerCase().includes(qq) ||
        String(r.remark).toLowerCase().includes(qq);

      return matches;
    });

    return sortRowsByOverdueDays(filtered);
  }, [tab, ar, ap, q, status, onlyOpen, asOf]);

  const totals = useMemo(() => {
    const t = {
      "Not Due": 0,
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0,
      overdueTotal: 0,
      recordCount: rows.length,
      overdueCount: 0,
    };

    for (const r of rows) {
      const bal = Number(r.balance || 0);
      t[r.bucket] += bal;
      t.total += bal;

      if (r.daysOverdue > 0) {
        t.overdueTotal += bal;
        t.overdueCount += 1;
      }
    }

    return t;
  }, [rows]);

  const chartData = useMemo(() => {
    return [
      { name: "Not Due", value: Number(totals["Not Due"] || 0) },
      { name: "0-30", value: Number(totals["0-30"] || 0) },
      { name: "31-60", value: Number(totals["31-60"] || 0) },
      { name: "61-90", value: Number(totals["61-90"] || 0) },
      { name: "90+", value: Number(totals["90+"] || 0) },
    ];
  }, [totals]);

  const bucketPercentData = useMemo(() => {
    const total = Number(totals.total || 0);

    return [
      {
        name: "Not Due",
        percent: total ? (Number(totals["Not Due"]) / total) * 100 : 0,
      },
      {
        name: "0-30",
        percent: total ? (Number(totals["0-30"]) / total) * 100 : 0,
      },
      {
        name: "31-60",
        percent: total ? (Number(totals["31-60"]) / total) * 100 : 0,
      },
      {
        name: "61-90",
        percent: total ? (Number(totals["61-90"]) / total) * 100 : 0,
      },
      {
        name: "90+",
        percent: total ? (Number(totals["90+"]) / total) * 100 : 0,
      },
    ];
  }, [totals]);

  function exportCSV() {
    const out = rows.map((r) => ({
      Type: tab,
      DocNo: r.docNo,
      Party: r.party,
      DocDate: isoToDisplay(r.docDate),
      DueDate: isoToDisplay(r.dueDate),
      DaysOverdue: r.daysOverdue,
      Bucket: r.bucket,
      Balance: money(r.balance),
      Status: r.status,
      Remark: r.remark,
    }));

    if (out.length === 0) return;
    downloadCSV(`${tab}_aging_${toSafeIso(asOf) || todayISO()}.csv`, out);
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="AGING"
        title="Aging Report"
        subtitle={
          tab === "AR"
            ? "Customer outstanding aging as of selected date."
            : "Vendor outstanding aging as of selected date."
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setTab("AR")}
              style={tab === "AR" ? tabActiveBlue : tabButton}
            >
              AR Aging
            </button>

            <button
              type="button"
              onClick={() => setTab("AP")}
              style={tab === "AP" ? tabActiveGreen : tabButton}
            >
              AP Aging
            </button>

            <button
              type="button"
              onClick={load}
              style={btnGhost}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {loading ? <AlertBox kind="info" message="Loading aging report..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Filters</h2>
            <p style={cardSubtitle}>
              Break open balances into aging buckets as of a selected date.
            </p>
          </div>
        </div>

        <div style={filterGrid}>
          <div style={field}>
            <label style={labelStyle}>As of Date</label>
            <AppDateInput value={asOf} onChange={setAsOf} style={input} />
          </div>

          <div style={field}>
            <label style={labelStyle}>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "AR"
                  ? "invoice / customer / remark"
                  : "bill / vendor / remark"
              }
              style={input}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={input}
            >
              <option value="ALL">ALL</option>
              <option value="PENDING">PENDING</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div style={checkboxWrap}>
            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => setOnlyOpen(e.target.checked)}
              />
              Only Open (balance {">"} 0)
            </label>
          </div>
        </div>

        <div style={filterActions}>
          <button
            type="button"
            onClick={exportCSV}
            style={rows.length === 0 ? disabledLike(btnPrimary) : btnPrimary}
            disabled={rows.length === 0}
          >
            Export CSV
          </button>

          <button type="button" onClick={() => window.print()} style={btnSecondary}>
            Print
          </button>
        </div>
      </section>

      <div style={summaryGrid}>
        <Bucket title="Not Due" value={money(totals["Not Due"])} badge={badgeBlue} />
        <Bucket title="0–30" value={money(totals["0-30"])} badge={badgeGreen} />
        <Bucket title="31–60" value={money(totals["31-60"])} badge={badgeAmber} />
        <Bucket title="61–90" value={money(totals["61-90"])} badge={badgeGray} />
        <Bucket title="90+" value={money(totals["90+"])} danger />
        <Bucket title="Total" value={money(totals.total)} strong />
      </div>

      <div style={{ height: 14 }} />

      <div style={summaryGrid}>
        <Bucket title="Open Records" value={totals.recordCount} />
        <Bucket title="Overdue Records" value={totals.overdueCount} danger />
        <Bucket title="Overdue Amount" value={money(totals.overdueTotal)} danger />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Aging Analysis</h2>
            <p style={cardSubtitle}>
              Visual distribution of outstanding balances across aging buckets.
            </p>
          </div>
        </div>

        <div style={chartGrid}>
          <div style={chartCard}>
            <div style={chartHeading}>Outstanding Amount by Bucket</div>
            <div style={chartSubHeading}>
              Compare total open amount across each aging bucket.
            </div>

            <div style={chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => compactMoney(v)} />
                  <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCard}>
            <div style={chartHeading}>Bucket Contribution %</div>
            <div style={chartSubHeading}>
              Understand how much each bucket contributes to total open balance.
            </div>

            <div style={chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={bucketPercentData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${Number(v || 0).toFixed(0)}%`}
                  />
                  <Tooltip formatter={(v) => `${Number(v || 0).toFixed(2)}%`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="percent"
                    name="Share of Total"
                    stroke="#7c3aed"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {tab === "AR" ? "Accounts Receivable Aging" : "Accounts Payable Aging"}
            </h2>
            <p style={cardSubtitle}>Rows: {rows.length}</p>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 980 }}>
            <thead>
              <tr>
                <th style={th}>{tab === "AR" ? "Invoice No" : "Bill No"}</th>
                <th style={th}>{tab === "AR" ? "Customer Code" : "Vendor Code"}</th>
                <th style={th}>Doc Date</th>
                <th style={th}>Due Date</th>
                <th style={thCenter}>Days Overdue</th>
                <th style={thCenter}>Bucket</th>
                <th style={thRight}>Balance</th>
                <th style={thCenter}>Status</th>
                <th style={th}>Remark</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={`${r.docNo}-${r.party}-${r.docDate}`} style={tr}>
                  <td style={tdCode}>{r.docNo}</td>
                  <td style={td}>{r.party}</td>
                  <td style={td}>{isoToDisplay(r.docDate)}</td>
                  <td style={td}>{isoToDisplay(r.dueDate)}</td>

                  <td
                    style={{
                      ...tdCenter,
                      fontWeight: 900,
                      color: r.daysOverdue > 0 ? "#a40000" : "#0a6a0a",
                    }}
                  >
                    {r.daysOverdue}
                  </td>

                  <td style={{ ...tdCenter, fontWeight: 900 }}>{r.bucket}</td>

                  <td style={{ ...tdRight, fontWeight: 900 }}>
                    {money(r.balance)}
                  </td>

                  <td style={tdCenter}>
                    <span style={statusBadge(r.status)}>{r.status}</span>
                  </td>

                  <td style={td}>{r.remark}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan="9" style={emptyTd}>
                    No aging rows found for current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={footNote}>
          Rule: Aging uses <b>Due Date</b>. If Due Date is missing, it falls back to
          Doc Date. Rows are sorted by <b>Days Overdue</b> in descending order. Only
          open balances are shown by default.
        </div>
      </section>

      <style>{printCss}</style>
    </div>
  );
}

function Bucket({ title, value, strong = false, danger = false, badge = null }) {
  return (
    <div style={bucketCard}>
      <div style={bucketHead}>
        <div style={bucketTitle}>{title}</div>
        {badge ? <span style={badge}>LIVE</span> : null}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: strong ? 950 : 900,
          color: danger ? "#a40000" : "#111",
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function statusBadge(status) {
  const s = normalizeStatus(status);

  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent",
  };

  if (s === "PAID") {
    return {
      ...base,
      background: "#eaffea",
      color: "#0a6a0a",
      borderColor: "#bde7bd",
    };
  }

  if (s === "PARTIAL") {
    return {
      ...base,
      background: "#fff6db",
      color: "#7a5a00",
      borderColor: "#ffe2a6",
    };
  }

  if (s === "OVERDUE") {
    return {
      ...base,
      background: "#ffecec",
      color: "#a40000",
      borderColor: "#ffb3b3",
    };
  }

  if (s === "CANCELLED") {
    return {
      ...base,
      background: "#f0f0f0",
      color: "#555",
      borderColor: "#d5d5d5",
    };
  }

  return {
    ...base,
    background: "#eef3ff",
    color: "#0b3d91",
    borderColor: "#cddcff",
  };
}

function disabledLike(base) {
  return {
    ...base,
    opacity: 0.6,
    cursor: "not-allowed",
  };
}

const tabButton = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 800,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  alignItems: "end",
};

const checkboxWrap = {
  display: "flex",
  alignItems: "end",
};

const checkboxLabel = {
  color: "#111",
  fontWeight: 800,
  display: "flex",
  gap: 8,
  alignItems: "center",
  minHeight: 44,
};

const filterActions = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  flexWrap: "wrap",
  marginTop: 14,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const bucketCard = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
};

const bucketHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const bucketTitle = {
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
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
  height: 320,
};

const footNote = {
  marginTop: 12,
  fontSize: 12,
  color: "#666",
};

const printCss = `
@media print {
  body { background: white !important; }
  nav { display: none !important; }
  button, input, select, textarea { display: none !important; }
  #root { padding: 0 !important; }
}
`;