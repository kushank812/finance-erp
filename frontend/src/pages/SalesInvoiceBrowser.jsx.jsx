import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import { useSearchParams } from "react-router-dom";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) return "-";
  const s = String(value).trim();
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return s;
  return `${dd}-${mm}-${yyyy}`;
}

export default function SalesInvoiceBrowser() {
  const [searchParams] = useSearchParams();

  const [list, setList] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [doc, setDoc] = useState(null);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // optional: preselect from URL ?invoice=INV001
  useEffect(() => {
    const qInv = searchParams.get("invoice");
    if (qInv) setInvoiceNo(qInv);
  }, [searchParams]);

  async function loadList() {
    setErr("");
    try {
      const data = await apiGet("/sales-invoices/");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function loadDoc(inv) {
    if (!inv) {
      setDoc(null);
      return;
    }
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
    loadList();
  }, []);

  useEffect(() => {
    loadDoc(invoiceNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <h2 style={{ margin: 0, color: "#fff" }}>Sales Invoice View (Print)</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        View an invoice in document format and print / save as PDF.
      </p>

      {err && <div style={msgErr}>{err}</div>}

      <div style={topBar}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={lblDark}>Select Invoice</label>
          <select value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} style={inp}>
            <option value="">-- Select Invoice --</option>
            {list.map((r) => (
              <option key={r.invoice_no} value={r.invoice_no}>
                {r.invoice_no} (Bal: {money(r.balance)})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <button onClick={loadList} style={btnGhost}>
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            style={btnPrimary}
            disabled={!doc || loading}
            title={!doc ? "Select an invoice first" : ""}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div id="print-area" style={paper}>
        {!invoiceNo ? (
          <div style={{ color: "#111" }}>Select an invoice to view.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading invoice…</div>
        ) : !doc ? (
          <div style={{ color: "#111" }}>No invoice found.</div>
        ) : (
          <>
            {/* Header */}
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

            {/* Meta grid */}
            <div style={metaGrid}>
              <Info label="Customer Code" value={doc.customer_code} />
              <Info label="Invoice Date" value={formatDate(doc.invoice_date)} />
              <Info label="Due Date" value={doc.due_date ? formatDate(doc.due_date) : "-"} />
              <Info label="Remark" value={doc.remark || "-"} />
            </div>

            <div style={{ height: 12 }} />

            {/* Lines */}
            <div style={{ overflowX: "auto" }}>
              <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 700 }}>
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

            {/* Totals */}
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
              Note: Use “Create Receipt (AR)” to update Amount Received and Balance.
            </div>
          </>
        )}
      </div>

      {/* Print CSS */}
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

/* ---- styles ---- */

const topBar = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  marginBottom: 12,
};

const lblDark = { fontSize: 13, color: "#fff", display: "block", marginBottom: 6, fontWeight: 700 };

const inp = {
  width: "100%",
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
};

const paper = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const docHeader = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const companyName = { fontSize: 18, fontWeight: 900, color: "#111" };
const muted = { fontSize: 12, color: "#666", marginTop: 2 };
const bigId = { fontSize: 18, fontWeight: 900, color: "#111" };
const hr = { height: 1, background: "#eee", margin: "12px 0" };

const metaGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const infoBox = { background: "#f7f8fa", border: "1px solid #eee", borderRadius: 14, padding: 12 };
const infoLabel = { fontSize: 12, color: "#666" };
const infoValue = { fontSize: 14, fontWeight: 800, color: "#111", marginTop: 4 };

const totalsWrap = {
  marginLeft: "auto",
  maxWidth: 380,
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
  fontWeight: 800,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginBottom: 12,
};

const printCss = `
@media print {
  body { background: white !important; }
  nav { display: none !important; }
  #root { padding: 0 !important; }
  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
  button, select, input, textarea { display: none !important; }
}
`;