// src/pages/Ledger.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function Ledger() {
  const nav = useNavigate();

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

      setArRows(Array.isArray(ar) ? ar : []);
      setApRows(Array.isArray(ap) ? ap : []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeFilters = tab === "AR" ? arFilters : apFilters;
  const setActiveFilters = tab === "AR" ? setArFilters : setApFilters;
  const rawRows = tab === "AR" ? arRows : apRows;

  const filteredRows = useMemo(() => {
    const q = String(activeFilters.q || "").trim().toLowerCase();
    const status = String(activeFilters.status || "").toUpperCase();

    return rawRows.filter((r) => {
      const numberText =
        tab === "AR"
          ? String(r.invoice_no || "").toLowerCase()
          : String(r.bill_no || "").toLowerCase();

      const partyCode =
        tab === "AR"
          ? String(r.customer_code || "").toLowerCase()
          : String(r.vendor_code || "").toLowerCase();

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
  }, [rawRows, activeFilters, tab]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        const grand = Number(r.grand_total || 0);
        const balance = Number(r.balance || 0);
        const settled =
          tab === "AR"
            ? Number(r.amount_received || 0)
            : Number(r.amount_paid || 0);

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
                  const docNo = tab === "AR" ? row.invoice_no : row.bill_no;
                  const partyCode =
                    tab === "AR" ? row.customer_code : row.vendor_code;
                  const dateValue =
                    tab === "AR" ? row.invoice_date : row.bill_date;
                  const settled =
                    tab === "AR" ? row.amount_received : row.amount_paid;
                  const status = getStatus(row);

                  return (
                    <tr key={docNo} style={tr}>
                      <td style={tdCode}>{docNo}</td>
                      <td style={td}>{partyCode || "-"}</td>
                      <td style={td}>{dateValue || "-"}</td>
                      <td style={td}>{row.due_date || "-"}</td>
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

const footNote = {
  marginTop: 12,
  fontSize: 12,
  color: "#666",
};