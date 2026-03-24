// src/pages/Aging.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../api/client";

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

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(dateISOa, dateISOb) {
  const a = new Date(dateISOa);
  const b = new Date(dateISOb);
  const ms = b.getTime() - a.getTime();
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

    const mapped = src.map((r) => {
      const docNo = tab === "AR" ? r.invoice_no : r.bill_no;
      const party = tab === "AR" ? r.customer_code : r.vendor_code;
      const docDate = tab === "AR" ? r.invoice_date : r.bill_date;
      const dueDate = r.due_date || docDate;
      const bal = Number(r.balance || 0);

      const dOver = daysBetween(String(dueDate || docDate || asOf), asOf);
      const daysOverdue = Math.max(0, dOver);
      const bucket = bucketFromDaysOverdue(dOver);
      const rowStatus = normalizeStatus(r.status);

      return {
        docNo,
        party,
        docDate: String(docDate || ""),
        dueDate: String(dueDate || ""),
        daysOverdue,
        bucket,
        balance: bal,
        status: rowStatus,
        remark: r.remark || "",
      };
    });

    return mapped.filter((r) => {
      if (onlyOpen && !(r.balance > 0)) return false;
      if (wantedStatus !== "ALL" && r.status !== wantedStatus) return false;

      const matches =
        !qq ||
        String(r.docNo).toLowerCase().includes(qq) ||
        String(r.party).toLowerCase().includes(qq) ||
        String(r.remark).toLowerCase().includes(qq);

      return matches;
    });
  }, [tab, ar, ap, q, status, onlyOpen, asOf]);

  const totals = useMemo(() => {
    const t = {
      "Not Due": 0,
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0,
    };

    for (const r of rows) {
      t[r.bucket] += Number(r.balance || 0);
      t.total += Number(r.balance || 0);
    }

    return t;
  }, [rows]);

  function exportCSV() {
    const out = rows.map((r) => ({
      Type: tab,
      DocNo: r.docNo,
      Party: r.party,
      DocDate: r.docDate,
      DueDate: r.dueDate,
      DaysOverdue: r.daysOverdue,
      Bucket: r.bucket,
      Balance: money(r.balance),
      Status: r.status,
      Remark: r.remark,
    }));

    if (out.length === 0) return;
    downloadCSV(`${tab}_aging_${asOf}.csv`, out);
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
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              style={input}
            />
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
        <Bucket
          title="Not Due"
          value={money(totals["Not Due"])}
          badge={badgeBlue}
        />
        <Bucket
          title="0–30"
          value={money(totals["0-30"])}
          badge={badgeGreen}
        />
        <Bucket
          title="31–60"
          value={money(totals["31-60"])}
          badge={badgeAmber}
        />
        <Bucket
          title="61–90"
          value={money(totals["61-90"])}
          badge={badgeGray}
        />
        <Bucket title="90+" value={money(totals["90+"])} danger />
        <Bucket title="Total" value={money(totals.total)} strong />
      </div>

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
                <tr
                  key={`${r.docNo}-${r.party}-${r.docDate}`}
                  style={tr}
                >
                  <td style={tdCode}>{r.docNo}</td>
                  <td style={td}>{r.party}</td>
                  <td style={td}>{r.docDate}</td>
                  <td style={td}>{r.dueDate}</td>

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
          Doc Date. Only open balances are shown by default.
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