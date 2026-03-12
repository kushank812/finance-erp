// src/pages/PurchaseBillView.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function PurchaseBillView() {
  const { billNo } = useParams();
  const nav = useNavigate();
  const [bill, setBill] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");
      setBill(null);
      try {
        const data = await apiGet(`/purchase-invoices/${encodeURIComponent(billNo)}`);
        setBill(data);
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
  }, [billNo]);

  const totals = useMemo(() => {
    if (!bill) return { subtotal: 0, tax_amount: 0, grand_total: 0 };
    return {
      subtotal: Number(bill.subtotal || 0),
      tax_amount: Number(bill.tax_amount || 0),
      grand_total: Number(bill.grand_total || 0),
    };
  }, [bill]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      {/* ✅ toolbar wrap (mobile-friendly) */}
      <div style={toolbarBetween}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Purchase Bill</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Bill No: <b>{billNo}</b>
          </p>
        </div>

        <div style={toolbarWrap}>
          <button onClick={() => nav(-1)} style={btnGhost}>
            Back
          </button>
          <button onClick={() => window.print()} style={btnPrimary} title="Print this purchase bill" disabled={!bill}>
            Print / Save PDF
          </button>
        </div>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      {!bill ? (
        <div style={{ color: "#b8b8b8" }}>Loading...</div>
      ) : (
        <div id="print-area" style={paper}>
          <div style={docHeader}>
            <div>
              <div style={docTitle}>PURCHASE BILL</div>
              <div style={muted}>
                Bill No: <b>{bill.bill_no}</b>
              </div>
              <div style={muted}>
                Bill Date: <b>{String(bill.bill_date || "")}</b>
              </div>
              <div style={muted}>
                Due Date: <b>{bill.due_date ? String(bill.due_date) : "-"}</b>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={muted}>Vendor Code</div>
              <div style={big}>{bill.vendor_code}</div>
              <div style={{ height: 8 }} />
              <div style={badge(bill.status)}>{bill.status}</div>
            </div>
          </div>

          <div style={{ height: 10 }} />
          <div style={divider} />

          {/* ✅ table scroll on mobile */}
          <div style={{ overflowX: "auto" }}>
            <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#f6f7f9" }}>
                  <th align="left">Item Code</th>
                  <th align="right">Qty</th>
                  <th align="right">Rate</th>
                  <th align="right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(bill.lines || []).map((ln, idx) => (
                  <tr key={ln.id ?? idx} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ color: "#111" }}>{ln.item_code}</td>
                    <td style={{ color: "#111" }} align="right">
                      {money(ln.qty)}
                    </td>
                    <td style={{ color: "#111" }} align="right">
                      {money(ln.rate)}
                    </td>
                    <td style={{ color: "#111", fontWeight: 800 }} align="right">
                      {money(ln.line_total)}
                    </td>
                  </tr>
                ))}

                {(bill.lines || []).length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: 12, color: "#666" }}>
                      No line items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ height: 12 }} />

          <div style={totalsBox}>
            <Row label="Subtotal" value={money(totals.subtotal)} />
            <Row label={`Tax (${money(bill.tax_percent)}%)`} value={money(totals.tax_amount)} />
            <div style={divider} />
            <Row label="Grand Total" value={money(totals.grand_total)} strong />
            <div style={{ height: 8 }} />
            <Row label="Amount Paid" value={money(bill.amount_paid)} />
            <Row label="Balance" value={money(bill.balance)} strong />
          </div>

          {bill.remark ? (
            <>
              <div style={{ height: 12 }} />
              <div style={{ color: "#111" }}>
                <b>Remark:</b> {bill.remark}
              </div>
            </>
          ) : null}
        </div>
      )}

      <style>{printCss}</style>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#111" }}>
      <div style={{ fontWeight: strong ? 900 : 700 }}>{label}</div>
      <div style={{ fontWeight: strong ? 900 : 800 }}>{value}</div>
    </div>
  );
}

function badge(status) {
  const s = String(status || "");
  const base = {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid transparent",
  };
  if (s === "Paid") return { ...base, background: "#eaffea", color: "#0a6a0a", borderColor: "#bde7bd" };
  if (s === "Partial") return { ...base, background: "#fff6db", color: "#7a5a00", borderColor: "#ffe2a6" };
  if (s === "Overdue") return { ...base, background: "#ffecec", color: "#a40000", borderColor: "#ffb3b3" };
  return { ...base, background: "#eef3ff", color: "#0b3d91", borderColor: "#cddcff" };
}

/* ---- styles ---- */

const toolbarBetween = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
  justifyContent: "space-between",
};

const toolbarWrap = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" };

const paper = { background: "white", border: "1px solid #e6e6e6", borderRadius: 16, padding: 16 };
const docHeader = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const docTitle = { fontSize: 18, fontWeight: 950, color: "#111" };
const big = { fontSize: 18, fontWeight: 950, color: "#111" };
const muted = { fontSize: 13, color: "#444", marginTop: 4 };
const divider = { height: 1, background: "#eee", width: "100%" };

const totalsBox = {
  marginLeft: "auto",
  width: "min(420px, 100%)",
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 16px",
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
  marginTop: 12,
};

const printCss = `
@media print {
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  #root { padding: 0 !important; margin: 0 !important; }
  nav { display: none !important; }
  button, input, select, textarea { display: none !important; }

  /* ✅ only document */
  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
}
`;