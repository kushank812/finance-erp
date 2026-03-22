// src/pages/Ledger.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";

import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import {
  page,
  stack,
  btnGhost,
  btnPrimary,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function Ledger() {
  const nav = useNavigate();

  const [tab, setTab] = useState("AR");
  const [arRows, setArRows] = useState([]);
  const [apRows, setApRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");

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

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    const data = tab === "AR" ? arRows : apRows;

    return data.filter((r) => {
      return (
        String(r.invoice_no || r.bill_no || "")
          .toLowerCase()
          .includes(q) ||
        String(r.customer_code || r.vendor_code || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [search, tab, arRows, apRows]);

  // ---------- TOTALS ----------
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.total += Number(r.grand_total || 0);
        acc.balance += Number(r.balance || 0);

        if (tab === "AR") {
          acc.paid += Number(r.amount_received || 0);
        } else {
          acc.paid += Number(r.amount_paid || 0);
        }

        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );
  }, [filtered, tab]);

  function goView(row) {
    if (tab === "AR") {
      nav(`/sales-invoice-view/${row.invoice_no}`);
    } else {
      nav(`/purchase-view/${row.bill_no}`);
    }
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="LEDGER"
        title="Accounts Ledger"
        subtitle="Track receivables and payables in one place"
        actions={
          <button onClick={load} style={btnGhost}>
            Refresh
          </button>
        }
      />

      <div style={stack}>
        {err && <AlertBox kind="error" message={err} />}
      </div>

      {/* Tabs */}
      <div style={tabWrap}>
        <button
          style={tab === "AR" ? tabActive : tabBtn}
          onClick={() => setTab("AR")}
        >
          Accounts Receivable
        </button>

        <button
          style={tab === "AP" ? tabActive : tabBtn}
          onClick={() => setTab("AP")}
        >
          Accounts Payable
        </button>
      </div>

      {/* Search */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={input}
      />

      {/* Summary */}
      <div style={summaryGrid}>
        <Stat title="Total" value={money(totals.total)} />
        <Stat title="Paid" value={money(totals.paid)} />
        <Stat title="Balance" value={money(totals.balance)} />
      </div>

      {/* Table */}
      <div style={card}>
        <table style={table}>
          <thead>
            <tr>
              <th>No</th>
              <th>{tab === "AR" ? "Customer" : "Vendor"}</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => (
              <tr key={r.invoice_no || r.bill_no}>
                <td>{r.invoice_no || r.bill_no}</td>
                <td>{r.customer_code || r.vendor_code}</td>
                <td>{money(r.grand_total)}</td>
                <td>
                  {money(
                    tab === "AR"
                      ? r.amount_received
                      : r.amount_paid
                  )}
                </td>
                <td style={{ fontWeight: 900, color: "#a40000" }}>
                  {money(r.balance)}
                </td>
                <td>
                  <button
                    onClick={() => goView(r)}
                    style={btnPrimary}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- components ---------- */

function Stat({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

/* ---------- styles ---------- */

const tabWrap = {
  display: "flex",
  gap: 10,
};

const tabBtn = {
  padding: "10px 14px",
  border: "1px solid #ccc",
  borderRadius: 10,
  background: "#fff",
  cursor: "pointer",
};

const tabActive = {
  ...tabBtn,
  background: "#0b5cff",
  color: "#fff",
  border: "1px solid #0b5cff",
};

const input = {
  padding: 10,
  border: "1px solid #ccc",
  borderRadius: 10,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
};

const statCard = {
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
};

const card = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};