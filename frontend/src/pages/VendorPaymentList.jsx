import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet } from "../api/client";

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

function fmtDate(value) {
  if (!value) return "-";
  return String(value);
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
  const [busy, setBusy] = useState("");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      `Reverse receipt ${receiptNo}?\n\nThis will undo the payment.`
    );
    if (!ok) return;

    setBusy(receiptNo);
    setErr("");
    setMsg("");

    try {
      await apiDelete(`/receipts/${encodeURIComponent(receiptNo)}`);
      setMsg(`Receipt ${receiptNo} reversed.`);
      await loadData(filters);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  const summary = useMemo(() => {
    const total = rows.length;
    const amount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

    return {
      total,
      amount: money(amount),
    };
  }, [rows]);

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h2 style={title}>Receipt Management</h2>
          <p style={subtitle}>View and reverse customer receipts.</p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            style={btnCreate}
            onClick={() => nav("/receipt/new")}
          >
            + Create Receipt
          </button>
        </div>
      </div>

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

        <div style={filterActions}>
          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>

          <button type="button" style={btnGhost} onClick={onReset} disabled={loading}>
            Reset
          </button>
        </div>
      </form>

      {err ? <div style={msgErr}>{err}</div> : null}
      {msg ? <div style={msgOk}>{msg}</div> : null}

      <div style={summaryGrid}>
        <SummaryCard title="Total Receipts" value={summary.total} />
        <SummaryCard title="Total Amount" value={`₹ ${summary.amount}`} />
      </div>

      <div style={card}>
        <div style={tableHeader}>
          <div>
            <div style={sectionTitle}>Receipts</div>
            <div style={sectionSubtitle}>
              {loading ? "Loading receipts..." : `${rows.length} record(s) found`}
            </div>
          </div>

          <button
            type="button"
            style={btnGhost}
            onClick={() => loadData(filters)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Receipt No</th>
                <th style={th}>Date</th>
                <th style={th}>Invoice No</th>
                <th style={thRight}>Amount</th>
                <th style={th}>Remark</th>
                <th style={thCenter}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="6" style={emptyTd}>
                    No receipts found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const receiptNo = row.receipt_no;
                  const activeBusy = busy === receiptNo;

                  return (
                    <tr key={receiptNo} style={tr}>
                      <td style={tdCode}>{receiptNo}</td>
                      <td style={td}>{fmtDate(row.receipt_date)}</td>
                      <td style={td}>{row.invoice_no || "-"}</td>
                      <td style={tdRight}>{money(row.amount)}</td>
                      <td style={td}>{row.remark || "-"}</td>
                      <td style={tdCenter}>
                        <div style={rowActionWrap}>
                          <button
                            type="button"
                            style={btnMini}
                            onClick={() =>
                              nav(`/receipt/view/${encodeURIComponent(receiptNo)}`)
                            }
                          >
                            View
                          </button>

                          <button
                            type="button"
                            style={btnDangerMini}
                            onClick={() => onDelete(receiptNo)}
                            disabled={activeBusy}
                          >
                            {activeBusy ? "Working..." : "Reverse"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div style={summaryCard}>
      <div style={summaryTitle}>{title}</div>
      <div style={summaryValue}>{value}</div>
    </div>
  );
}

const page = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 14,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
};

const title = {
  margin: 0,
  color: "#fff",
  fontSize: 26,
  fontWeight: 900,
};

const subtitle = {
  marginTop: 8,
  color: "#cbd5e1",
  fontSize: 14,
};

const headerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
  marginBottom: 14,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
  color: "#0f172a",
  background: "#fff",
};

const filterActions = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const btnPrimary = {
  padding: "11px 16px",
  borderRadius: 12,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const btnCreate = {
  padding: "12px 18px",
  borderRadius: 16,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  boxShadow: "0 10px 24px rgba(37, 99, 235, 0.28)",
};

const btnGhost = {
  padding: "11px 16px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const btnMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
};

const btnDangerMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const msgErr = {
  background: "#fff1f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  padding: "12px 14px",
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 700,
};

const msgOk = {
  background: "#ecfdf5",
  border: "1px solid #86efac",
  color: "#166534",
  padding: "12px 14px",
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 700,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const summaryCard = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
};

const summaryTitle = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
};

const summaryValue = {
  marginTop: 8,
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const tableHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle = {
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 900,
};

const sectionSubtitle = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const tableWrap = {
  width: "100%",
  overflowX: "auto",
};

const table = {
  width: "100%",
  minWidth: 900,
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  background: "#f8fafc",
};

const thRight = {
  ...th,
  textAlign: "right",
};

const thCenter = {
  ...th,
  textAlign: "center",
};

const tr = {
  background: "#fff",
};

const td = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdCode = {
  ...td,
  fontWeight: 900,
};

const tdRight = {
  ...td,
  textAlign: "right",
  fontWeight: 800,
};

const tdCenter = {
  ...td,
  textAlign: "center",
};

const emptyTd = {
  padding: "20px 14px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const rowActionWrap = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  flexWrap: "wrap",
};