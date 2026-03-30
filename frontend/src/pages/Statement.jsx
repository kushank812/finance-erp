// src/pages/Statement.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../api/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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

function isoToDisplay(iso) {
  if (!iso) return "-";
  const s = String(iso).trim();
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfYearISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function normalize(v) {
  return String(v || "").trim().toUpperCase();
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function asDateValue(v) {
  if (!v) return 0;
  const d = new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function inDateRange(iso, fromDate, toDate) {
  const t = asDateValue(iso);
  if (!t) return false;

  if (fromDate && t < asDateValue(fromDate)) return false;
  if (toDate && t > asDateValue(toDate)) return false;

  return true;
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

function monthKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Statement() {
  const location = useLocation();

  const [tab, setTab] = useState("AR");

  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [salesInvoices, setSalesInvoices] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);

  const [partyCode, setPartyCode] = useState("");
  const [fromDate, setFromDate] = useState(startOfYearISO());
  const [toDate, setToDate] = useState(todayISO());
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);

    try {
      const [
        customerRes,
        vendorRes,
        salesInvoiceRes,
        purchaseInvoiceRes,
        receiptRes,
        vendorPaymentRes,
      ] = await Promise.all([
        apiGet("/customers/"),
        apiGet("/vendors/"),
        apiGet("/sales-invoices/"),
        apiGet("/purchase-invoices/"),
        apiGet("/receipts/"),
        apiGet("/vendor-payments/"),
      ]);

      setCustomers(safeArray(customerRes));
      setVendors(safeArray(vendorRes));
      setSalesInvoices(safeArray(salesInvoiceRes));
      setPurchaseBills(safeArray(purchaseInvoiceRes));
      setReceipts(safeArray(receiptRes));
      setVendorPayments(safeArray(vendorPaymentRes));
    } catch (e) {
      setErr(String(e?.message || e));
      setCustomers([]);
      setVendors([]);
      setSalesInvoices([]);
      setPurchaseBills([]);
      setReceipts([]);
      setVendorPayments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.key]);

  const partyOptions = useMemo(() => {
    const src = tab === "AR" ? customers : vendors;

    const mapped = src.map((x) => {
      const code =
        tab === "AR"
          ? x.customer_code || x.code || ""
          : x.vendor_code || x.code || "";

      const name =
        tab === "AR"
          ? x.customer_name || x.name || ""
          : x.vendor_name || x.name || "";

      return {
        code: String(code || "").trim(),
        name: String(name || "").trim(),
        label: name ? `${code} - ${name}` : code,
      };
    });

    return mapped
      .filter((x) => x.code)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [tab, customers, vendors]);

  const selectedParty = useMemo(() => {
    return partyOptions.find((x) => x.code === partyCode) || null;
  }, [partyOptions, partyCode]);

  useEffect(() => {
    if (!partyCode && partyOptions.length > 0) {
      setPartyCode(partyOptions[0].code);
      return;
    }

    if (partyCode && !partyOptions.some((x) => x.code === partyCode)) {
      setPartyCode(partyOptions[0]?.code || "");
    }
  }, [partyCode, partyOptions]);

  const allEntries = useMemo(() => {
    if (!partyCode) return [];

    if (tab === "AR") {
      const invoiceEntries = salesInvoices
        .filter((r) => normalize(r.customer_code) === normalize(partyCode))
        .map((r) => ({
          date: r.invoice_date || "",
          type: "INVOICE",
          docNo: r.invoice_no || "",
          remark: r.remark || "",
          debit: Number(r.grand_total || 0),
          credit: 0,
          rawStatus: r.status || "",
        }));

      const receiptEntries = receipts
        .filter((r) => normalize(r.customer_code) === normalize(partyCode))
        .map((r) => ({
          date: r.receipt_date || "",
          type: "RECEIPT",
          docNo: r.receipt_no || "",
          remark: r.remark || "",
          debit: 0,
          credit: Number(r.amount || 0),
          rawStatus: "",
        }));

      return [...invoiceEntries, ...receiptEntries].sort((a, b) => {
        const d = asDateValue(a.date) - asDateValue(b.date);
        if (d !== 0) return d;

        const typeRank = (x) => (x.type === "INVOICE" || x.type === "BILL" ? 0 : 1);
        if (typeRank(a) !== typeRank(b)) return typeRank(a) - typeRank(b);

        return String(a.docNo || "").localeCompare(String(b.docNo || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    }

    const billEntries = purchaseBills
      .filter((r) => normalize(r.vendor_code) === normalize(partyCode))
      .map((r) => ({
        date: r.bill_date || "",
        type: "BILL",
        docNo: r.bill_no || "",
        remark: r.remark || "",
        debit: Number(r.grand_total || 0),
        credit: 0,
        rawStatus: r.status || "",
      }));

    const paymentEntries = vendorPayments
      .filter((r) => normalize(r.vendor_code) === normalize(partyCode))
      .map((r) => ({
        date: r.payment_date || "",
        type: "PAYMENT",
        docNo: r.payment_no || "",
        remark: r.remark || "",
        debit: 0,
        credit: Number(r.amount || 0),
        rawStatus: "",
      }));

    return [...billEntries, ...paymentEntries].sort((a, b) => {
      const d = asDateValue(a.date) - asDateValue(b.date);
      if (d !== 0) return d;

      const typeRank = (x) => (x.type === "INVOICE" || x.type === "BILL" ? 0 : 1);
      if (typeRank(a) !== typeRank(b)) return typeRank(a) - typeRank(b);

      return String(a.docNo || "").localeCompare(String(b.docNo || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [tab, partyCode, salesInvoices, purchaseBills, receipts, vendorPayments]);

  const openingBalance = useMemo(() => {
    if (!fromDate) return 0;

    return allEntries
      .filter((x) => asDateValue(x.date) < asDateValue(fromDate))
      .reduce((acc, x) => acc + Number(x.debit || 0) - Number(x.credit || 0), 0);
  }, [allEntries, fromDate]);

  const rows = useMemo(() => {
    const qq = String(q || "").trim().toLowerCase();

    let running = openingBalance;

    return allEntries
      .filter((x) => inDateRange(x.date, fromDate, toDate))
      .filter((x) => {
        if (!qq) return true;
        return (
          String(x.docNo || "").toLowerCase().includes(qq) ||
          String(x.type || "").toLowerCase().includes(qq) ||
          String(x.remark || "").toLowerCase().includes(qq)
        );
      })
      .map((x) => {
        running += Number(x.debit || 0) - Number(x.credit || 0);
        return {
          ...x,
          runningBalance: running,
        };
      });
  }, [allEntries, fromDate, toDate, q, openingBalance]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, x) => {
        acc.debit += Number(x.debit || 0);
        acc.credit += Number(x.credit || 0);
        acc.count += 1;
        return acc;
      },
      {
        count: 0,
        debit: 0,
        credit: 0,
      }
    );
  }, [rows]);

  const closingBalance = useMemo(() => {
    if (!rows.length) return openingBalance;
    return Number(rows[rows.length - 1].runningBalance || 0);
  }, [rows, openingBalance]);

  const chartData = useMemo(() => {
    const map = {};

    for (const row of rows) {
      const key = monthKey(row.date);
      if (!key) continue;

      if (!map[key]) {
        map[key] = {
          month: key,
          debit: 0,
          credit: 0,
        };
      }

      map[key].debit += Number(row.debit || 0);
      map[key].credit += Number(row.credit || 0);
    }

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  function exportCSV() {
    const out = [
      {
        Date: "",
        Type: "OPENING",
        DocNo: "",
        Remark: "",
        Debit: "",
        Credit: "",
        RunningBalance: money(openingBalance),
      },
      ...rows.map((r) => ({
        Date: isoToDisplay(r.date),
        Type: r.type,
        DocNo: r.docNo,
        Remark: r.remark,
        Debit: r.debit ? money(r.debit) : "",
        Credit: r.credit ? money(r.credit) : "",
        RunningBalance: money(r.runningBalance),
      })),
    ];

    if (out.length === 0) return;
    downloadCSV(
      `${tab}_statement_${partyCode || "party"}_${fromDate || "from"}_${toDate || "to"}.csv`,
      out
    );
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="STATEMENT"
        title="Party Statement"
        subtitle={
          tab === "AR"
            ? "Customer-wise statement with invoices, receipts, and running balance."
            : "Vendor-wise statement with bills, payments, and running balance."
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setTab("AR")}
              style={tab === "AR" ? tabActiveBlue : tabButton}
            >
              Customer Statement
            </button>

            <button
              type="button"
              onClick={() => setTab("AP")}
              style={tab === "AP" ? tabActiveGreen : tabButton}
            >
              Vendor Statement
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
        {loading ? <AlertBox kind="info" message="Loading statement..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Filters</h2>
            <p style={cardSubtitle}>
              Select party and date range to generate a running statement.
            </p>
          </div>
        </div>

        <div style={filterGrid}>
          <div style={field}>
            <label style={labelStyle}>{tab === "AR" ? "Customer" : "Vendor"}</label>
            <select
              value={partyCode}
              onChange={(e) => setPartyCode(e.target.value)}
              style={input}
            >
              {partyOptions.length === 0 ? (
                <option value="">No parties available</option>
              ) : (
                partyOptions.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={field}>
            <label style={labelStyle}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="doc no / type / remark"
              style={input}
            />
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
        <SummaryCard
          title={tab === "AR" ? "Customer" : "Vendor"}
          value={selectedParty?.label || "-"}
          badge={badgeBlue}
          wide
        />
        <SummaryCard title="Opening Balance" value={money(openingBalance)} />
        <SummaryCard
          title={tab === "AR" ? "Invoices / Bills" : "Bills"}
          value={money(summary.debit)}
          badge={badgeGreen}
        />
        <SummaryCard
          title={tab === "AR" ? "Receipts" : "Payments"}
          value={money(summary.credit)}
          badge={badgeAmber}
        />
        <SummaryCard title="Closing Balance" value={money(closingBalance)} strong />
        <SummaryCard title="Transactions" value={summary.count} badge={badgeGray} />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Monthly Movement</h2>
            <p style={cardSubtitle}>
              Compare billed value against received or paid value across the selected period.
            </p>
          </div>
        </div>

        <div style={chartWrap}>
          {chartData.length === 0 ? (
            <div style={emptyChartText}>No chart data available for current filters.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => compactMoney(v)} />
                <Tooltip formatter={(v) => `₹ ${money(v)}`} />
                <Legend />
                <Bar
                  dataKey="debit"
                  name={tab === "AR" ? "Invoices" : "Bills"}
                  fill="#2563eb"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="credit"
                  name={tab === "AR" ? "Receipts" : "Payments"}
                  fill="#16a34a"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {tab === "AR" ? "Customer Statement" : "Vendor Statement"}
            </h2>
            <p style={cardSubtitle}>
              Opening balance plus all transactions in date order with running balance.
            </p>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Type</th>
                <th style={th}>Doc No</th>
                <th style={th}>Remark</th>
                <th style={thRight}>{tab === "AR" ? "Debit" : "Debit"}</th>
                <th style={thRight}>{tab === "AR" ? "Credit" : "Credit"}</th>
                <th style={thRight}>Running Balance</th>
              </tr>
            </thead>

            <tbody>
              <tr style={tr}>
                <td style={td}>-</td>
                <td style={tdCode}>OPENING</td>
                <td style={td}>-</td>
                <td style={td}>Opening balance before selected period</td>
                <td style={tdRight}>-</td>
                <td style={tdRight}>-</td>
                <td style={{ ...tdRight, fontWeight: 900 }}>{money(openingBalance)}</td>
              </tr>

              {rows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={emptyTd}>
                    No statement entries found for current filters.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={`${r.type}-${r.docNo}-${r.date}-${idx}`} style={tr}>
                    <td style={td}>{isoToDisplay(r.date)}</td>
                    <td style={tdCenter}>
                      <span style={typeBadge(r.type)}>{r.type}</span>
                    </td>
                    <td style={tdCode}>{r.docNo || "-"}</td>
                    <td style={td}>{r.remark || "-"}</td>
                    <td style={tdRight}>{r.debit ? money(r.debit) : "-"}</td>
                    <td style={tdRight}>{r.credit ? money(r.credit) : "-"}</td>
                    <td
                      style={{
                        ...tdRight,
                        fontWeight: 900,
                        color: Number(r.runningBalance || 0) >= 0 ? "#111" : "#a40000",
                      }}
                    >
                      {money(r.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={footNote}>
          Statement logic: invoices or bills increase balance, receipts or payments reduce balance.
          Running balance starts from opening balance before the selected From Date.
        </div>
      </section>

      <style>{printCss}</style>
    </div>
  );
}

function SummaryCard({ title, value, badge, strong = false, wide = false }) {
  return (
    <div
      style={{
        ...summaryCard,
        ...(wide ? { gridColumn: "span 2" } : {}),
      }}
    >
      <div style={summaryHead}>
        <div style={summaryTitle}>{title}</div>
        {badge ? <span style={badge}>LIVE</span> : null}
      </div>

      <div
        style={{
          ...summaryValue,
          fontWeight: strong ? 950 : 900,
          fontSize: wide ? 18 : 22,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function typeBadge(type) {
  const t = normalize(type);

  const base = {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent",
  };

  if (t === "INVOICE" || t === "BILL") {
    return {
      ...base,
      background: "#eef4ff",
      color: "#0b5cff",
      borderColor: "#b7cbff",
    };
  }

  return {
    ...base,
    background: "#ecfff1",
    color: "#116b2f",
    borderColor: "#a6e0b8",
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

const chartWrap = {
  width: "100%",
  height: 320,
};

const emptyChartText = {
  width: "100%",
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

const printCss = `
@media print {
  body { background: white !important; }
  nav { display: none !important; }
  button, input, select, textarea { display: none !important; }
  #root { padding: 0 !important; }

  table {
    font-size: 12px !important;
  }
}
`;