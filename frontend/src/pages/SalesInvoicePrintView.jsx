import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import { useParams, useSearchParams } from "react-router-dom";
import { formatDateForDisplay } from "../utils/date";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function formatDate(value) {
  return formatDateForDisplay(value) || "-";
}

function getTemplateValue(value) {
  const v = String(value || "STANDARD").toUpperCase();
  if (["STANDARD", "TAX_INVOICE", "SERVICE_INVOICE"].includes(v)) return v;
  return "STANDARD";
}

export default function SalesInvoicePrintView() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const [list, setList] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [doc, setDoc] = useState(null);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qInv = searchParams.get("invoice");
    const routeInv = params.invoiceNo;

    if (routeInv) setInvoiceNo(routeInv);
    else if (qInv) setInvoiceNo(qInv);
  }, [params.invoiceNo, searchParams]);

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

  const template = getTemplateValue(doc?.invoice_template);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Sales Invoice View</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        View invoice templates in document format and print / save as PDF.
      </p>

      {err && <div style={msgErr}>{err}</div>}

      <div style={topBar} className="screen-only">
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={lblDark}>Select Invoice</label>
          <select
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            style={inp}
          >
            <option value="">-- Select Invoice --</option>
            {list.map((r) => (
              <option key={r.invoice_no} value={r.invoice_no}>
                {r.invoice_no} | {r.invoice_template || "STANDARD"} | Bal:{" "}
                {money(r.balance)}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <button onClick={loadList} style={btnGhost} type="button">
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            style={btnPrimary}
            disabled={!doc || loading}
            title={!doc ? "Select an invoice first" : ""}
            type="button"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <div id="print-area" style={paper}>
        {!invoiceNo ? (
          <div style={{ color: "#111" }}>Select an invoice to view.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading invoice…</div>
        ) : !doc ? (
          <div style={{ color: "#111" }}>No invoice found.</div>
        ) : template === "TAX_INVOICE" ? (
          <TaxInvoice doc={doc} totals={totals} />
        ) : template === "SERVICE_INVOICE" ? (
          <ServiceInvoice doc={doc} totals={totals} />
        ) : (
          <StandardInvoice doc={doc} totals={totals} />
        )}
      </div>

      <style>{printCss}</style>
    </div>
  );
}

function StandardInvoice({ doc, totals }) {
  return (
    <>
      <div style={docHeader}>
        <div>
          <div style={companyName}>Finance AP/AR System</div>
          <div style={muted}>Standard Sales Invoice</div>
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
        <table width="100%" cellPadding="10" style={printTable}>
          <thead>
            <tr style={tableHeadRow}>
              <th style={thPrint}>#</th>
              <th style={thPrint}>Item Code</th>
              <th style={thRightPrint}>Qty</th>
              <th style={thRightPrint}>Rate</th>
              <th style={thRightPrint}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(doc.lines || []).map((ln, idx) => (
              <tr key={ln.id ?? idx} style={tableBodyRow}>
                <td style={tdPrint}>{idx + 1}</td>
                <td style={tdPrint}>{ln.item_code}</td>
                <td style={tdRightPrint}>{money(ln.qty)}</td>
                <td style={tdRightPrint}>{money(ln.rate)}</td>
                <td style={tdRightStrong}>{money(ln.line_total)}</td>
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

      <TotalsBox totals={totals} />
      <PrintNote />
    </>
  );
}

function TaxInvoice({ doc, totals }) {
  return (
    <>
      <div style={taxTopStrip}>TAX INVOICE</div>

      <div style={docHeader}>
        <div>
          <div style={companyName}>Finance AP/AR System</div>
          <div style={muted}>Accounts Receivable / Tax Invoice</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={bigId}>{doc.invoice_no}</div>
          <div style={muted}>Status: {doc.status}</div>
        </div>
      </div>

      <div style={hr} />

      <div style={twoColBlock}>
        <div style={partyBox}>
          <div style={partyTitle}>Recipient</div>
          <div style={partyName}>{doc.customer_code || "-"}</div>
          <div style={muted}>Customer billing details from customer master</div>
        </div>

        <div style={partyBox}>
          <div style={partyTitle}>Invoice Details</div>
          <div style={invoiceMetaLine}>Invoice Date: {formatDate(doc.invoice_date)}</div>
          <div style={invoiceMetaLine}>Due Date: {formatDate(doc.due_date)}</div>
          <div style={invoiceMetaLine}>Tax Rate: {money(doc.tax_percent)}%</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <table width="100%" cellPadding="10" style={printTable}>
        <thead>
          <tr style={taxTableHeadRow}>
            <th style={thTax}>Description</th>
            <th style={thTaxRight}>Qty</th>
            <th style={thTaxRight}>Rate</th>
            <th style={thTaxRight}>Tax %</th>
            <th style={thTaxRight}>Tax</th>
            <th style={thTaxRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(doc.lines || []).map((ln, idx) => {
            const base = Number(ln.line_total || 0);
            const tax = (base * Number(doc.tax_percent || 0)) / 100;
            const total = base + tax;

            return (
              <tr key={ln.id ?? idx} style={tableBodyRow}>
                <td style={tdPrint}>{ln.item_code}</td>
                <td style={tdRightPrint}>{money(ln.qty)}</td>
                <td style={tdRightPrint}>{money(ln.rate)}</td>
                <td style={tdRightPrint}>{money(doc.tax_percent)}%</td>
                <td style={tdRightPrint}>{money(tax)}</td>
                <td style={tdRightStrong}>{money(total)}</td>
              </tr>
            );
          })}

          {(doc.lines || []).length === 0 && (
            <tr>
              <td colSpan="6" style={{ padding: 12, color: "#666" }}>
                No line items.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <TotalsBox totals={totals} />
      <PrintNote />
    </>
  );
}

function ServiceInvoice({ doc, totals }) {
  return (
    <>
      <div style={serviceHeader}>
        <div>
          <div style={serviceTitle}>SERVICE INVOICE</div>
          <div style={serviceSubTitle}>Finance AP/AR System</div>
        </div>

        <div style={serviceInvoiceNo}>
          <div style={muted}>Invoice No</div>
          <div style={bigId}>{doc.invoice_no}</div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div style={metaGrid}>
        <Info label="Client / Customer" value={doc.customer_code || "-"} />
        <Info label="Invoice Date" value={formatDate(doc.invoice_date)} />
        <Info label="Due Date" value={formatDate(doc.due_date)} />
        <Info label="Status" value={doc.status || "-"} />
      </div>

      <div style={serviceInfoBox}>
        <div style={partyTitle}>Service / Work Reference</div>
        <div style={serviceInfoText}>
          {doc.remark ||
            "Service work billed as per the selected service items, hours/days, and agreed rate."}
        </div>
      </div>

      <table width="100%" cellPadding="10" style={printTable}>
        <thead>
          <tr style={serviceTableHeadRow}>
            <th style={thPrint}>Service / Work Description</th>
            <th style={thRightPrint}>Hours / Days</th>
            <th style={thRightPrint}>Rate</th>
            <th style={thRightPrint}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(doc.lines || []).map((ln, idx) => (
            <tr key={ln.id ?? idx} style={tableBodyRow}>
              <td style={tdPrint}>{ln.item_code}</td>
              <td style={tdRightPrint}>{money(ln.qty)}</td>
              <td style={tdRightPrint}>{money(ln.rate)}</td>
              <td style={tdRightStrong}>{money(ln.line_total)}</td>
            </tr>
          ))}

          {(doc.lines || []).length === 0 && (
            <tr>
              <td colSpan="4" style={{ padding: 12, color: "#666" }}>
                No service items.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <TotalsBox totals={totals} />
      <PrintNote />
    </>
  );
}

function TotalsBox({ totals }) {
  return (
    <>
      <div style={{ height: 14 }} />

      <div style={totalsWrap}>
        <TotalRow label="Subtotal" value={totals.subtotal} />
        <TotalRow
          label={`Tax (${totals.taxPercent}%)`}
          value={totals.taxAmount}
        />
        <TotalRow label="Grand Total" value={totals.grandTotal} strong />
        <div style={hr} />
        <TotalRow label="Amount Received" value={totals.received} />
        <TotalRow label="Balance" value={totals.balance} strong />
      </div>
    </>
  );
}

function PrintNote() {
  return (
    <>
      <div style={{ height: 16 }} />
      <div style={{ color: "#666", fontSize: 12 }}>
        Note: Use “Create Receipt (AR)” to update Amount Received and Balance.
      </div>
    </>
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
      <div style={{ color: "#111", fontWeight: strong ? 900 : 700 }}>
        {label}
      </div>
      <div style={{ color: "#111", fontWeight: strong ? 900 : 800 }}>
        {value}
      </div>
    </div>
  );
}

const topBar = {
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
  fontWeight: 700,
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

const companyName = { fontSize: 18, fontWeight: 900, color: "#111" };
const muted = { fontSize: 12, color: "#666", marginTop: 2 };
const bigId = { fontSize: 18, fontWeight: 900, color: "#111" };
const hr = { height: 1, background: "#eee", margin: "12px 0" };

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

const infoLabel = { fontSize: 12, color: "#666" };
const infoValue = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111",
  marginTop: 4,
};

const totalsWrap = {
  marginLeft: "auto",
  maxWidth: 380,
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
  display: "grid",
  gap: 8,
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

const printTable = {
  borderCollapse: "collapse",
  minWidth: 700,
  color: "#111",
};

const tableHeadRow = { background: "#f6f7f9" };
const taxTableHeadRow = { background: "#1d4ed8", color: "#ffffff" };
const serviceTableHeadRow = { background: "#0f172a", color: "#ffffff" };
const tableBodyRow = { borderTop: "1px solid #eee" };

const thPrint = {
  color: "inherit",
  textAlign: "left",
  fontSize: 13,
};

const thRightPrint = {
  color: "inherit",
  textAlign: "right",
  fontSize: 13,
};

const thTax = {
  color: "#ffffff",
  textAlign: "left",
  fontSize: 13,
};

const thTaxRight = {
  color: "#ffffff",
  textAlign: "right",
  fontSize: 13,
};

const tdPrint = {
  color: "#111",
  fontSize: 13,
};

const tdRightPrint = {
  color: "#111",
  fontSize: 13,
  textAlign: "right",
};

const tdRightStrong = {
  color: "#111",
  fontSize: 13,
  textAlign: "right",
  fontWeight: 900,
};

const taxTopStrip = {
  background: "#1d4ed8",
  color: "#ffffff",
  padding: "12px 14px",
  borderRadius: 12,
  fontWeight: 950,
  letterSpacing: 1,
  marginBottom: 14,
};

const twoColBlock = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const partyBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "#f9fafb",
};

const partyTitle = {
  fontSize: 12,
  fontWeight: 900,
  color: "#334155",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const partyName = {
  fontSize: 16,
  fontWeight: 900,
  color: "#111",
  marginTop: 6,
};

const invoiceMetaLine = {
  fontSize: 13,
  color: "#111",
  fontWeight: 700,
  marginTop: 6,
};

const serviceHeader = {
  background: "linear-gradient(135deg, #0f172a, #1e293b)",
  color: "#ffffff",
  padding: 18,
  borderRadius: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const serviceTitle = {
  fontSize: 22,
  fontWeight: 950,
  letterSpacing: 0.8,
};

const serviceSubTitle = {
  color: "#cbd5e1",
  fontSize: 13,
  marginTop: 4,
  fontWeight: 700,
};

const serviceInvoiceNo = {
  background: "#ffffff",
  color: "#111",
  borderRadius: 14,
  padding: 12,
  minWidth: 170,
  textAlign: "right",
};

const serviceInfoBox = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  margin: "14px 0",
};

const serviceInfoText = {
  color: "#111",
  fontWeight: 700,
  fontSize: 13,
  marginTop: 6,
};

const printCss = `
@media print {
  body { background: white !important; }
  nav { display: none !important; }
  .screen-only { display: none !important; }
  #root { padding: 0 !important; }
  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
}
`;