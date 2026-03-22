// src/pages/ReceiptList.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiDelete } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function buildQuery(params) {
  const qs = new URLSearchParams();

  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.fromDate) qs.set("from_date", params.fromDate);
  if (params.toDate) qs.set("to_date", params.toDate);

  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default function ReceiptList() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    fromDate: "",
    toDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function loadData(activeFilters = filters) {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      const query = buildQuery(activeFilters);
      const data = await apiGet(`/receipts${query}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onSearch(e) {
    e.preventDefault();
    await loadData(filters);
  }

  async function onReset() {
    const cleared = { q: "", fromDate: "", toDate: "" };
    setFilters(cleared);
    await loadData(cleared);
  }

  async function onDelete(receiptNo) {
    const ok = window.confirm(
      `Delete receipt ${receiptNo}?\n\nThis will reverse the payment.`
    );
    if (!ok) return;

    try {
      await apiDelete(`/receipts/${encodeURIComponent(receiptNo)}`);
      setMsg(`Receipt ${receiptNo} reversed.`);
      await loadData(filters);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <h2 style={{ color: "#fff" }}>Receipts</h2>

      {/* FILTER */}
      <form onSubmit={onSearch} style={card}>
        <div style={grid}>
          <input
            style={input}
            placeholder="Receipt No / Invoice No"
            value={filters.q}
            onChange={(e) =>
              setFilters((s) => ({ ...s, q: e.target.value.toUpperCase() }))
            }
          />

          <input
            type="date"
            style={input}
            value={filters.fromDate}
            onChange={(e) =>
              setFilters((s) => ({ ...s, fromDate: e.target.value }))
            }
          />

          <input
            type="date"
            style={input}
            value={filters.toDate}
            onChange={(e) =>
              setFilters((s) => ({ ...s, toDate: e.target.value }))
            }
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <button style={btnPrimary}>Search</button>
          <button type="button" style={btnGhost} onClick={onReset}>
            Reset
          </button>
        </div>
      </form>

      {err && <div style={msgErr}>{err}</div>}
      {msg && <div style={msgOk}>{msg}</div>}

      {/* TABLE */}
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Receipt No</th>
              <th style={th}>Date</th>
              <th style={th}>Invoice</th>
              <th style={th}>Amount</th>
              <th style={th}>Remark</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.receipt_no}>
                <td style={td}>{r.receipt_no}</td>
                <td style={td}>{r.receipt_date}</td>
                <td style={td}>{r.invoice_no}</td>
                <td style={td}>{money(r.amount)}</td>
                <td style={td}>{r.remark || "-"}</td>
                <td style={td}>
                  <button
                    style={miniBtn}
                    onClick={() =>
                      nav(`/receipt/view/${encodeURIComponent(r.receipt_no)}`)
                    }
                  >
                    View
                  </button>

                  <button
                    style={miniBtnDanger}
                    onClick={() => onDelete(r.receipt_no)}
                  >
                    Reverse
                  </button>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>
                  No receipts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const card = {
  background: "#fff",
  padding: 14,
  borderRadius: 12,
  marginBottom: 14,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const th = {
  padding: 10,
  background: "#f5f5f5",
};

const td = {
  padding: 10,
};

const btnPrimary = {
  marginRight: 10,
  padding: "8px 12px",
  background: "#0b5cff",
  color: "#fff",
  border: "none",
  borderRadius: 8,
};

const btnGhost = {
  padding: "8px 12px",
  background: "#eee",
  border: "none",
  borderRadius: 8,
};

const miniBtn = {
  marginRight: 6,
  padding: "6px 10px",
};

const miniBtnDanger = {
  padding: "6px 10px",
  background: "#ffdddd",
  border: "1px solid red",
};

const msgErr = { color: "red", marginBottom: 10 };
const msgOk = { color: "green", marginBottom: 10 };