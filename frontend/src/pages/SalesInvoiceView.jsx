import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import { formatDateForDisplay } from "../utils/date";
import SendEmailButton from "../components/ui/SendEmailButton";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function formatDate(value) {
  return formatDateForDisplay(value) || "-";
}

export default function SalesInvoiceView() {
  const { invoiceNo } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadDoc(inv) {
    if (!inv) return;
    setErr("");
    setLoading(true);
    try {
      const data = await apiGet(`/sales-invoices/${encodeURIComponent(inv)}`);
      setDoc(data);
    } catch (e) {
      setErr(String(e.message || e));
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoc(invoiceNo);
  }, [invoiceNo]);

  const totals = useMemo(() => {
    if (!doc) return null;
    return {
      subtotal: money(doc.subtotal),
      taxPercent: money(doc.tax_percent),
      taxAmount: money(doc.tax_amount),
      grandTotal: money(doc.grand_total),
      received: money(doc.amount_received),
      balance: money(doc.balance),
    };
  }, [doc]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Sales Invoice</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Invoice No: <b>{invoiceNo}</b>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <button onClick={() => nav(-1)} style={btnGhost} type="button">
            Back
          </button>

          {doc && !loading && (
            <SendEmailButton
              endpoint={`/email/sales-invoice/${encodeURIComponent(invoiceNo)}`}
              label="Email Invoice"
              successMessage="Invoice email sent successfully."
            />
          )}

          <button
            onClick={() => window.print()}
            style={btnPrimary}
            disabled={!doc || loading}
            type="button"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      <div id="print-area" style={paper}>
        {loading ? (
          <div style={{ color: "#111" }}>Loading invoice…</div>
        ) : !doc ? (
          <div style={{ color: "#111" }}>No invoice found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={muted}>Sales Invoice</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{doc.invoice_no}</div>
                <div style={muted}>Status: {doc.status}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Customer Code" value={doc.customer_code || "-"} />
              <Info label="Invoice Date" value={formatDate(doc.invoice_date)} />
              <Info label="Due Date" value={formatDate(doc.due_date)} />
              <Info label="Remark" value={doc.remark || "-"} />
            </div>

            <div style={{ height: 12 }} />

            <div style={{ overflowX: "auto" }}>
              <table
                width="100%"
                cellPadding="10"
                style={{ borderCollapse: "collapse", minWidth: 700 }}
              >
                <thead>
                  <tr style={{ background: "#f6f7f9" }}>
                    <th>#</th>
                    <th>Item Code</th>
                    <th align="right">Qty</th>
                    <th align="right">Rate</th>
                    <th align="right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(doc.lines || []).map((ln, idx) => (
                    <tr key={ln.id ?? idx} style={{ borderTop: "1px solid #eee" }}>
                      <td>{idx + 1}</td>
                      <td>{ln.item_code}</td>
                      <td align="right">{money(ln.qty)}</td>
                      <td align="right">{money(ln.rate)}</td>
                      <td align="right" style={{ fontWeight: 800 }}>
                        {money(ln.line_total)}
                      </td>
                    </tr>
                  ))}

                  {(doc.lines || []).length === 0 && (
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
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: strong ? 900 : 700 }}>{label}</span>
      <span style={{ fontWeight: strong ? 900 : 800 }}>{value}</span>
    </div>
  );
}

const paper = { background: "white", padding: 16, borderRadius: 14 };

const docHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const companyName = { fontSize: 18, fontWeight: 900, color: "#111" };
const muted = { fontSize: 12, color: "#666" };
const bigId = { fontSize: 18, fontWeight: 900, color: "#111" };
const hr = { height: 1, background: "#eee", margin: "12px 0" };

const metaGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const infoBox = { background: "#f7f8fa", padding: 12, borderRadius: 10 };
const infoLabel = { fontSize: 12, color: "#666" };
const infoValue = { fontSize: 14, fontWeight: 800, color: "#111" };

const totalsWrap = { marginLeft: "auto", maxWidth: 350 };

const btnPrimary = {
  padding: 10,
  background: "#0b5cff",
  color: "#fff",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
};

const btnGhost = {
  padding: 10,
  background: "#eee",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
};

const msgErr = { color: "red", marginTop: 10 };

const printCss = `
@media print {
  button { display: none !important; }
}
`;