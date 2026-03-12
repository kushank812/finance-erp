import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

export default function Ledger() {
  const nav = useNavigate();

  const [tab, setTab] = useState("AR"); // AR or AP
  const [arRows, setArRows] = useState([]);
  const [apRows, setApRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Filters (separate)
  const [arQ, setArQ] = useState("");
  const [arStatus, setArStatus] = useState("ALL");

  const [apQ, setApQ] = useState("");
  const [apStatus, setApStatus] = useState("ALL");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const [ar, ap] = await Promise.all([apiGet("/sales-invoices/"), apiGet("/purchase-invoices/")]);
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

  // ---------- AR ----------
  const filteredAR = useMemo(() => {
    const qq = arQ.trim().toLowerCase();
    return arRows.filter((r) => {
      const matchesText =
        !qq ||
        String(r.invoice_no || "").toLowerCase().includes(qq) ||
        String(r.customer_code || "").toLowerCase().includes(qq) ||
        String(r.remark || "").toLowerCase().includes(qq);

      const matchesStatus = arStatus === "ALL" ? true : r.status === arStatus;
      return matchesText && matchesStatus;
    });
  }, [arRows, arQ, arStatus]);

  const totalsAR = useMemo(() => {
    const total = filteredAR.reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const received = filteredAR.reduce((s, r) => s + Number(r.amount_received || 0), 0);
    const bal = filteredAR.reduce((s, r) => s + Number(r.balance || 0), 0);
    return { total, received, bal };
  }, [filteredAR]);

  const overdueBalanceAR = useMemo(() => {
    return filteredAR
      .filter((r) => r.status === "Overdue")
      .reduce((s, r) => s + Number(r.balance || 0), 0);
  }, [filteredAR]);

  // ---------- AP ----------
  const filteredAP = useMemo(() => {
    const qq = apQ.trim().toLowerCase();
    return apRows.filter((r) => {
      const matchesText =
        !qq ||
        String(r.bill_no || "").toLowerCase().includes(qq) ||
        String(r.vendor_code || "").toLowerCase().includes(qq) ||
        String(r.remark || "").toLowerCase().includes(qq);

      const matchesStatus = apStatus === "ALL" ? true : r.status === apStatus;
      return matchesText && matchesStatus;
    });
  }, [apRows, apQ, apStatus]);

  const totalsAP = useMemo(() => {
    const total = filteredAP.reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const paid = filteredAP.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const bal = filteredAP.reduce((s, r) => s + Number(r.balance || 0), 0);
    return { total, paid, bal };
  }, [filteredAP]);

  const overdueBalanceAP = useMemo(() => {
    return filteredAP
      .filter((r) => r.status === "Overdue")
      .reduce((s, r) => s + Number(r.balance || 0), 0);
  }, [filteredAP]);

  function goInvoiceView(invoiceNo) {
    if (!invoiceNo) return;
    nav(`/billing/view/${encodeURIComponent(invoiceNo)}`);
  }

  function goPurchaseView(billNo) {
    if (!billNo) return;
    nav(`/purchase/view/${encodeURIComponent(billNo)}`);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Accounts Receivable & Payable Schedule</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Easy view of what you will receive from customers and what you will pay to suppliers.
      </p>

      {err && <div style={msgErr}>{err}</div>}

      {/* Tabs + Refresh (wrap on mobile) */}
      <div style={toolbarWrap}>
        <button onClick={() => setTab("AR")} style={tabBtn(tab === "AR")}>
          Accounts Receivable
        </button>
        <button onClick={() => setTab("AP")} style={tabBtn(tab === "AP")}>
          Accounts Payable
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={load} style={btnGhost} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ===================== AR TAB ===================== */}
      {tab === "AR" ? (
        <div style={card}>
          <div style={headerWrap}>
            <h3 style={{ margin: 0, color: "#111" }}>Accounts Receivable Schedule</h3>

            {/* Filters stack nicely on mobile */}
            <div style={filtersWrap}>
              <input
                value={arQ}
                onChange={(e) => setArQ(e.target.value)}
                placeholder="Search invoice/customer/remark..."
                style={input}
              />

              <select value={arStatus} onChange={(e) => setArStatus(e.target.value)} style={input}>
                <option value="ALL">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div style={{ height: 12 }} />

          {/* Totals (auto-fit grid) */}
          <div style={statGrid}>
            <Stat title="Total Invoiced" value={money(totalsAR.total)} />
            <Stat title="Total Received" value={money(totalsAR.received)} />
            <Stat title="Total Balance" value={money(totalsAR.bal)} />
            <Stat title="Overdue Balance" value={money(overdueBalanceAR)} />
          </div>

          <div style={{ height: 12 }} />

          {/* Table: mobile uses horizontal scroll */}
          <div style={{ overflowX: "auto" }}>
            <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "#f6f7f9" }}>
                  <th align="left">Invoice Date</th>
                  <th align="left">Customer Code</th>
                  <th align="left">Invoice No</th>
                  <th align="right">Credit Amount</th>
                  <th align="right">Amount Received</th>
                  <th align="right">Balance</th>
                  <th align="center">Status</th>
                  <th align="left">Remark</th>
                  <th align="center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAR.map((r) => (
                  <tr key={r.invoice_no} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ color: "#111" }}>{String(r.invoice_date || "")}</td>
                    <td style={{ color: "#111" }}>{r.customer_code}</td>
                    <td style={{ color: "#111", fontWeight: 900 }}>{r.invoice_no}</td>

                    <td style={{ color: "#111" }} align="right">
                      {money(r.grand_total)}
                    </td>

                    <td style={{ color: "#111" }} align="right">
                      {money(r.amount_received)}
                    </td>

                    <td
                      align="right"
                      style={{
                        fontWeight: 900,
                        color: Number(r.balance) > 0 ? "#a40000" : "#0a6a0a",
                      }}
                    >
                      {money(r.balance)}
                    </td>

                    <td align="center">
                      <span style={badge(r.status)}>{r.status}</span>
                    </td>

                    <td style={{ color: "#111" }}>{r.remark || ""}</td>

                    <td align="center">
                      <button onClick={() => goInvoiceView(r.invoice_no)} style={btnMini} title="Open invoice view + print">
                        View
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredAR.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: 12, color: "#666" }}>
                      No receivables yet. Create an invoice first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={tip}>Tip: Amount Received increases when you record receipts.</div>
        </div>
      ) : (
        /* ===================== AP TAB ===================== */
        <div style={card}>
          <div style={headerWrap}>
            <h3 style={{ margin: 0, color: "#111" }}>Accounts Payable Schedule</h3>

            <div style={filtersWrap}>
              <input
                value={apQ}
                onChange={(e) => setApQ(e.target.value)}
                placeholder="Search bill/vendor/remark..."
                style={input}
              />

              <select value={apStatus} onChange={(e) => setApStatus(e.target.value)} style={input}>
                <option value="ALL">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={statGrid}>
            <Stat title="Total Purchased" value={money(totalsAP.total)} />
            <Stat title="Total Paid" value={money(totalsAP.paid)} />
            <Stat title="Total Balance" value={money(totalsAP.bal)} />
            <Stat title="Overdue Balance" value={money(overdueBalanceAP)} />
          </div>

          <div style={{ height: 12 }} />

          <div style={{ overflowX: "auto" }}>
            <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "#f6f7f9" }}>
                  <th align="left">Bill Date</th>
                  <th align="left">Vendor Code</th>
                  <th align="left">Bill No</th>
                  <th align="right">Purchase Amount</th>
                  <th align="right">Amount Paid</th>
                  <th align="right">Balance</th>
                  <th align="center">Status</th>
                  <th align="left">Remark</th>
                  <th align="center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAP.map((r) => (
                  <tr key={r.bill_no} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ color: "#111" }}>{String(r.bill_date || "")}</td>
                    <td style={{ color: "#111" }}>{r.vendor_code}</td>
                    <td style={{ color: "#111", fontWeight: 900 }}>{r.bill_no}</td>

                    <td style={{ color: "#111" }} align="right">
                      {money(r.grand_total)}
                    </td>

                    <td style={{ color: "#111" }} align="right">
                      {money(r.amount_paid)}
                    </td>

                    <td
                      align="right"
                      style={{
                        fontWeight: 900,
                        color: Number(r.balance) > 0 ? "#a40000" : "#0a6a0a",
                      }}
                    >
                      {money(r.balance)}
                    </td>

                    <td align="center">
                      <span style={badge(r.status)}>{r.status}</span>
                    </td>

                    <td style={{ color: "#111" }}>{r.remark || ""}</td>

                    <td align="center">
                      <button onClick={() => goPurchaseView(r.bill_no)} style={btnMini} title="Open purchase bill view + print">
                        View
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredAP.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: 12, color: "#666" }}>
                      No payables yet. Create a Purchase Bill first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={tip}>Tip: Amount Paid increases when you record vendor payments.</div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>{value}</div>
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
    fontWeight: 900,
    whiteSpace: "nowrap",
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
    whiteSpace: "nowrap",
  };

  if (s === "Paid") return { ...base, background: "#eaffea", color: "#0a6a0a", borderColor: "#bde7bd" };
  if (s === "Partial") return { ...base, background: "#fff6db", color: "#7a5a00", borderColor: "#ffe2a6" };
  if (s === "Overdue") return { ...base, background: "#ffecec", color: "#a40000", borderColor: "#ffb3b3" };
  return { ...base, background: "#eef3ff", color: "#0b3d91", borderColor: "#cddcff" };
}

/* ---- Styles (mobile-friendly like your other pages) ---- */

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginBottom: 12,
};

const toolbarWrap = {
  display: "flex",
  gap: 10,
  marginBottom: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const headerWrap = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
};

const filtersWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "end",
  width: "min(720px, 100%)",
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const statCard = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const btnMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const input = {
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
  width: "min(320px, 100%)",
};

const tip = { marginTop: 10, color: "#666", fontSize: 12 };