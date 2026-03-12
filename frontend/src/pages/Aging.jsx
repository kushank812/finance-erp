// src/pages/Aging.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

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
  // returns (b - a) in days
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

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Aging() {
  const [tab, setTab] = useState("AR"); // AR / AP
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---- normalize rows for aging ----
  const rows = useMemo(() => {
    const src = tab === "AR" ? ar : ap;
    const qq = q.trim().toLowerCase();

    const mapped = src.map((r) => {
      const docNo = tab === "AR" ? r.invoice_no : r.bill_no;
      const party = tab === "AR" ? r.customer_code : r.vendor_code;

      const docDate = tab === "AR" ? r.invoice_date : r.bill_date;
      const dueDate = r.due_date || docDate; // fallback rule
      const bal = Number(r.balance || 0);

      const dOver = daysBetween(String(dueDate || docDate || asOf), asOf); // >0 overdue
      const daysOverdue = Math.max(0, dOver);
      const bucket = bucketFromDaysOverdue(dOver);

      return {
        docNo,
        party,
        docDate: String(docDate || ""),
        dueDate: String(dueDate || ""),
        daysOverdue,
        bucket,
        balance: bal,
        status: r.status,
        remark: r.remark || "",
      };
    });

    return mapped.filter((r) => {
      if (onlyOpen && !(r.balance > 0)) return false;
      if (status !== "ALL" && r.status !== status) return false;

      const matches =
        !qq ||
        String(r.docNo).toLowerCase().includes(qq) ||
        String(r.party).toLowerCase().includes(qq) ||
        String(r.remark).toLowerCase().includes(qq);

      return matches;
    });
  }, [tab, ar, ap, q, status, onlyOpen, asOf]);

  // ---- bucket totals ----
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Aging Report (AR / AP)</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Breaks open balances into aging buckets as of selected date.
      </p>

      <div style={{ color: "#9aa4b2", fontSize: 13, marginBottom: 12 }}>
        {tab === "AR" ? "Customer outstanding aging" : "Vendor outstanding aging"}
      </div>

      {err && <div style={msgErr}>{err}</div>}

      {/* Tabs */}
      <div style={toolbarWrap}>
        <button onClick={() => setTab("AR")} style={tabBtn(tab === "AR")}>
          AR Aging
        </button>
        <button onClick={() => setTab("AP")} style={tabBtn(tab === "AP")}>
          AP Aging
        </button>
        <button onClick={load} style={btnGhost} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Controls */}
      <div style={controlsWrap}>
        <div style={{ minWidth: 180, flex: 1 }}>
          <label style={lblDark}>As of Date</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={inp} />
        </div>

        <div style={{ minWidth: 220, flex: 2 }}>
          <label style={lblDark}>Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "AR" ? "invoice/customer/remark..." : "bill/vendor/remark..."}
            style={inp}
          />
        </div>

        <div style={{ minWidth: 180, flex: 1 }}>
          <label style={lblDark}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inp}>
            <option value="ALL">All</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label
            style={{
              color: "white",
              fontWeight: 800,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            Only Open (balance &gt; 0)
          </label>

          <button
            onClick={exportCSV}
            style={{
              ...btnPrimary,
              opacity: rows.length === 0 ? 0.6 : 1,
              cursor: rows.length === 0 ? "not-allowed" : "pointer",
            }}
            disabled={rows.length === 0}
          >
            Export CSV
          </button>

          <button onClick={() => window.print()} style={btnGhost}>
            Print
          </button>
        </div>
      </div>

      {/* Bucket totals */}
      <div style={bucketCard}>
        <div style={bucketGrid}>
          <Bucket title="Not Due" value={money(totals["Not Due"])} />
          <Bucket title="0–30" value={money(totals["0-30"])} />
          <Bucket title="31–60" value={money(totals["31-60"])} />
          <Bucket title="61–90" value={money(totals["61-90"])} />
          <Bucket title="90+" value={money(totals["90+"])} danger />
          <Bucket title="Total" value={money(totals.total)} strong />
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={headerRow}>
          <h3 style={{ margin: 0, color: "#111" }}>
            {tab === "AR" ? "Accounts Receivable Aging" : "Accounts Payable Aging"}
          </h3>
          <div style={{ color: "#666" }}>Rows: {rows.length}</div>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ background: "#f6f7f9" }}>
                <th align="left">{tab === "AR" ? "Invoice No" : "Bill No"}</th>
                <th align="left">{tab === "AR" ? "Customer Code" : "Vendor Code"}</th>
                <th align="left">Doc Date</th>
                <th align="left">Due Date</th>
                <th align="center">Days Overdue</th>
                <th align="center">Bucket</th>
                <th align="right">Balance</th>
                <th align="center">Status</th>
                <th align="left">Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.docNo}-${r.party}-${r.docDate}`}
                  style={{ borderTop: "1px solid #eee" }}
                >
                  <td style={{ fontWeight: 900, color: "#111" }}>{r.docNo}</td>
                  <td style={{ color: "#111" }}>{r.party}</td>
                  <td style={{ color: "#111" }}>{r.docDate}</td>
                  <td style={{ color: "#111" }}>{r.dueDate}</td>

                  <td
                    align="center"
                    style={{
                      fontWeight: 900,
                      color: r.daysOverdue > 0 ? "#a40000" : "#0a6a0a",
                    }}
                  >
                    {r.daysOverdue}
                  </td>

                  <td align="center" style={{ fontWeight: 900, color: "#111" }}>
                    {r.bucket}
                  </td>

                  <td align="right" style={{ fontWeight: 900, color: "#111" }}>
                    {money(r.balance)}
                  </td>

                  <td align="center">
                    <span style={badge(r.status)}>{r.status}</span>
                  </td>

                  <td style={{ color: "#111" }}>{r.remark}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ padding: 12, color: "#666" }}>
                    No aging rows found for current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          Rule: Aging uses <b>Due Date</b>. If Due Date is missing, it falls back to Doc Date.
          Only open balances are shown by default.
        </div>
      </div>

      {/* Print styles */}
      <style>{printCss}</style>
    </div>
  );
}

function Bucket({ title, value, strong, danger }) {
  return (
    <div style={bucketBox}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: strong ? 950 : 900,
          color: danger ? "#a40000" : "#111",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function tabBtn(active) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: active ? "1px solid #0b5cff" : "1px solid #ccc",
    background: active ? "#0b5cff" : "white",
    color: active ? "white" : "#111",
    cursor: "pointer",
    fontWeight: 800,
  };
}

function badge(status) {
  const s = String(status || "");
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent",
  };

  if (s === "Paid") {
    return {
      ...base,
      background: "#eaffea",
      color: "#0a6a0a",
      borderColor: "#bde7bd",
    };
  }
  if (s === "Partial") {
    return {
      ...base,
      background: "#fff6db",
      color: "#7a5a00",
      borderColor: "#ffe2a6",
    };
  }
  if (s === "Overdue") {
    return {
      ...base,
      background: "#ffecec",
      color: "#a40000",
      borderColor: "#ffb3b3",
    };
  }

  return {
    ...base,
    background: "#eef3ff",
    color: "#0b3d91",
    borderColor: "#cddcff",
  };
}

/* ---- styles ---- */

const toolbarWrap = {
  display: "flex",
  gap: 10,
  marginBottom: 12,
  flexWrap: "wrap",
  alignItems: "end",
};

const controlsWrap = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  marginBottom: 12,
};

const lblDark = {
  fontSize: 13,
  color: "#fff",
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
};

const inp = {
  width: "100%",
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginBottom: 12,
};

const bucketCard = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const bucketGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const bucketBox = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const printCss = `
@media print {
  body { background: white !important; }
  nav { display: none !important; }
  button, input, select, textarea { display: none !important; }
  #root { padding: 0 !important; }
}
`;