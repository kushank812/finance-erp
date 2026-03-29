import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiDelete, apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function pad2(v) {
  return String(v).padStart(2, "0");
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

function displayToISO(display) {
  if (!display) return "";
  const s = String(display).trim();
  const parts = s.split("/");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts.map((x) => x.trim());
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function isValidISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const [yyyy, mm, dd] = String(iso).split("-").map(Number);
  const dt = new Date(yyyy, mm - 1, dd);
  return (
    dt.getFullYear() === yyyy &&
    dt.getMonth() === mm - 1 &&
    dt.getDate() === dd
  );
}

function isValidDisplayDate(display) {
  const s = String(display || "").trim();
  if (!s) return false;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  return isValidISODate(displayToISO(s));
}

function normalizeDateInput(value) {
  const raw = String(value || "").replace(/[^\d]/g, "").slice(0, 8);

  if (raw.length <= 2) return raw;
  if (raw.length <= 4) return `${raw.slice(0, 2)}/${raw.slice(2)}`;
  return `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
}

function buildQuery(params) {
  const qs = new URLSearchParams();

  if (params.q?.trim()) qs.set("q", params.q.trim());

  if (params.fromDate) {
    const fromISO = displayToISO(params.fromDate);
    if (fromISO) qs.set("from_date", fromISO);
  }

  if (params.toDate) {
    const toISO = displayToISO(params.toDate);
    if (toISO) qs.set("to_date", toISO);
  }

  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default function VendorPaymentList({ currentUser }) {
  const nav = useNavigate();
  const location = useLocation();
  const isViewer = currentUser?.role === "VIEWER";

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
      const data = await apiGet(`/vendor-payments${query}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  async function onSearch(e) {
    e.preventDefault();

    if (filters.fromDate && !isValidDisplayDate(filters.fromDate)) {
      setErr("From Date must be in DD/MM/YYYY format.");
      return;
    }

    if (filters.toDate && !isValidDisplayDate(filters.toDate)) {
      setErr("To Date must be in DD/MM/YYYY format.");
      return;
    }

    await loadData(filters);
  }

  async function onReset() {
    const cleared = { q: "", fromDate: "", toDate: "" };
    setFilters(cleared);
    await loadData(cleared);
  }

  async function onReverse(paymentNo) {
    const ok = window.confirm(
      `Reverse vendor payment ${paymentNo}?\n\nThis will remove the payment entry and recalculate the linked bill.`
    );
    if (!ok) return;

    setBusy(paymentNo);
    setErr("");
    setMsg("");

    try {
      await apiDelete(`/purchase-invoices/payments/${encodeURIComponent(paymentNo)}`);
      setMsg(`Vendor payment ${paymentNo} reversed.`);
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <div style={header}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Vendor Payment Management</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            View and reverse vendor payments.
          </p>
        </div>
      </div>

      <form onSubmit={onSearch} style={card}>
        <div style={grid}>
          <input
            style={input}
            placeholder="Payment No / Bill No"
            value={filters.q}
            onChange={(e) =>
              setFilters((s) => ({ ...s, q: e.target.value.toUpperCase() }))
            }
          />

          <input
            type="text"
            style={input}
            placeholder="From Date (dd/mm/yyyy)"
            maxLength={10}
            value={filters.fromDate}
            onChange={(e) =>
              setFilters((s) => ({
                ...s,
                fromDate: normalizeDateInput(e.target.value),
              }))
            }
          />

          <input
            type="text"
            style={input}
            placeholder="To Date (dd/mm/yyyy)"
            maxLength={10}
            value={filters.toDate}
            onChange={(e) =>
              setFilters((s) => ({
                ...s,
                toDate: normalizeDateInput(e.target.value),
              }))
            }
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>
          <button type="button" style={btnGhost} onClick={onReset} disabled={loading}>
            Reset
          </button>
        </div>
      </form>

      {err && <div style={msgErr}>{err}</div>}
      {msg && <div style={msgOk}>{msg}</div>}

      <div style={summaryGrid}>
        <Card title="Total Payments" value={summary.total} />
        <Card title="Total Amount" value={`₹ ${summary.amount}`} />
      </div>

      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Payment No</th>
                <th style={th}>Date</th>
                <th style={th}>Bill No</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th>
                <th style={th}>Remark</th>
                <th style={{ ...th, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.payment_no}>
                  <td style={tdStrong}>{r.payment_no}</td>
                  <td style={td}>{isoToDisplay(r.payment_date)}</td>
                  <td style={td}>{r.bill_no}</td>
                  <td style={tdRight}>{money(r.amount)}</td>
                  <td style={td}>{r.remark || "-"}</td>
                  <td style={td}>
                    <div style={actionWrap}>
                      <button
                        type="button"
                        style={miniBtn}
                        onClick={() =>
                          nav(`/vendor-payment/view/${encodeURIComponent(r.payment_no)}`)
                        }
                      >
                        View
                      </button>

                      {!isViewer && (
                        <button
                          type="button"
                          style={miniBtnDanger}
                          disabled={busy === r.payment_no}
                          onClick={() => onReverse(r.payment_no)}
                        >
                          {busy === r.payment_no ? "Working..." : "Reverse"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6" style={empty}>
                    No vendor payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#111", fontWeight: 800 }}>
        {title}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, color: "#111" }}>
        {value}
      </div>
    </div>
  );
}

const header = {
  marginBottom: 14,
};

const card = {
  background: "#fff",
  padding: 14,
  borderRadius: 14,
  marginBottom: 14,
  border: "1px solid #e6e6e6",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
};

const input = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const table = {
  width: "100%",
  minWidth: 900,
  borderCollapse: "collapse",
};

const th = {
  padding: 10,
  background: "#f5f6f8",
  fontWeight: 900,
  fontSize: 13,
};

const td = {
  padding: 10,
};

const tdStrong = {
  ...td,
  fontWeight: 900,
};

const tdRight = {
  ...td,
  textAlign: "right",
};

const empty = {
  textAlign: "center",
  padding: 20,
};

const actionWrap = {
  display: "flex",
  gap: 6,
  justifyContent: "center",
  flexWrap: "wrap",
};

const btnPrimary = {
  marginRight: 10,
  padding: "8px 12px",
  background: "#0b5cff",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const btnGhost = {
  padding: "8px 12px",
  background: "#eee",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const miniBtn = {
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
};

const miniBtnDanger = {
  padding: "6px 10px",
  borderRadius: 8,
  background: "#fff2f2",
  border: "1px solid red",
  cursor: "pointer",
};

const msgErr = {
  color: "red",
  marginBottom: 10,
};

const msgOk = {
  color: "green",
  marginBottom: 10,
};