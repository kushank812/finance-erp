import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
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

export default function SalesInvoicePrintView() {
  const { invoiceNo } = useParams();
  const nav = useNavigate();

  const [inv, setInv] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setErr("");
      setInv(null);

      if (!invoiceNo) return;

      setLoading(true);
      try {
        const data = await apiGet(`/sales-invoices/${encodeURIComponent(invoiceNo)}`);
        setInv(data);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceNo]);

  const totals = useMemo(() => {
    if (!inv) {
      return {
        subtotal: "0.00",
        taxPercent: "0.00",
        taxAmount: "0.00",
        grandTotal: "0.00",
        received: "0.00",
        balance: "0.00",
      };
    }

    return {
      subtotal: money(inv.subtotal),
      taxPercent: money(inv.tax_percent),
      taxAmount: money(inv.tax_amount),
      grandTotal: money(inv.grand_total),
      received: money(inv.amount_received),
      balance: money(inv.balance),
    };
  }, [inv]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      <div style={toolbarBetween}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Sales Invoice</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Invoice No: <b>{invoiceNo}</b>
          </p>
        </div>

        <div style={toolbarWrap}>
          <button onClick={() => nav(-1)} style={btnGhost}>
            Back
          </button>

          <button
            onClick={() => window.print()}
            style={btnPrimary}
            disabled={!inv || loading}
            title={!inv ? "Invoice not loaded" : "Print this invoice"}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      <div id="print-area" style={paper}>
        {!invoiceNo ? (
          <div style={{ color: "#111" }}>Missing invoice number in URL.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading invoice...</div>
        ) : !inv ? (
          <div style={{ color: "#111" }}>No invoice found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={muted}>SALES INVOICE</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{inv.invoice_no}</div>
                <div style={muted}>Status: {inv.status}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Customer Code" value={inv.customer_code} />
              <Info label="Invoice Date" value={isoToDisplay(inv.invoice_date)} />
              <Info label="Due Date" value={isoToDisplay(inv.due_date)} />
              <Info label="Remark" value={inv.remark || "-"} />
            </div>

            <div style={{ height: 12 }} />

            <div style={{ overflowX: "auto" }}>
              <table
                width="100%"
                cellPadding="10"
                style={{ borderCollapse: "collapse", minWidth: 900 }}
              >
                <thead>
                  <tr style={{ background: "#f6f7f9" }}>
                    <th align="left">#</th>
                    <th align="left">Item Code</th>
                    <th align="right">Qty</th>
                    <th align="right">Rate</th>
                    <th align="right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.lines || []).map((ln, idx) => (
                    <tr key={ln.id ?? idx} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ color: "#111" }}>{idx + 1}</td>
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

                  {(inv.lines || []).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: 12, color: "#666" }}>
                        No line items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ height: 14 }} />

            <div style={totalsWrap}>
              <TotalRow label="Subtotal" value={totals.subtotal} />
              <TotalRow label={`Tax (${totals.taxPercent}%)`} value={totals.taxAmount} />
              <TotalRow label="Grand Total" value={totals.grandTotal} strong />
              <div style={hr} />
              <TotalRow label="Amount Received" value={totals.received} />
              <TotalRow label="Balance" value={totals.balance} strong />
            </div>

            <div style={{ height: 16 }} />
            <div style={{ color: "#666", fontSize: 12 }}>
              Note: Use Receipt entry to update Amount Received and Balance.
            </div>
          </>
        )}
      </div>

      <style>{printCss}</style>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoBox}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  );
}

function TotalRow({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ color: "#111", fontWeight: strong ? 900 : 700 }}>{label}</div>
      <div style={{ color: "#111", fontWeight: strong ? 900 : 800 }}>{value}</div>
    </div>
  );
}

const toolbarBetween = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
  justifyContent: "space-between",
};

const toolbarWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
};

const paper = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const docHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const companyName = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111",
};

const muted = {
  fontSize: 12,
  color: "#666",
  marginTop: 2,
};

const bigId = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111",
};

const hr = {
  height: 1,
  background: "#eee",
  margin: "12px 0",
};

const metaGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const infoBox = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const infoLabel = {
  fontSize: 12,
  color: "#666",
};

const infoValue = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111",
  marginTop: 4,
};

const totalsWrap = {
  marginLeft: "auto",
  width: "min(420px, 100%)",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
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
  marginTop: 12,
};

const printCss = `
@media print {
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  #root { padding: 0 !important; margin: 0 !important; }
  nav { display: none !important; }
  button, input, select, textarea { display: none !important; }

  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
}
`;