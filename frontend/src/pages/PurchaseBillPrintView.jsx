import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function getStatusText(status) {
  return String(status || "").toUpperCase();
}

export default function PurchaseBillPrintView() {
  const { billNo } = useParams();
  const nav = useNavigate();

  const [bill, setBill] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setErr("");
      setBill(null);

      if (!billNo) return;

      setLoading(true);
      try {
        const data = await apiGet(`/purchase-invoices/${encodeURIComponent(billNo)}`);
        if (!alive) return;
        setBill(data);
      } catch (e) {
        if (!alive) return;
        setErr(String(e.message || e));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [billNo]);

  const totals = useMemo(() => {
    if (!bill) {
      return {
        subtotal: "0.00",
        taxPercent: "0.00",
        taxAmount: "0.00",
        grandTotal: "0.00",
        paid: "0.00",
        balance: "0.00",
      };
    }

    return {
      subtotal: money(bill.subtotal),
      taxPercent: money(bill.tax_percent),
      taxAmount: money(bill.tax_amount),
      grandTotal: money(bill.grand_total),
      paid: money(bill.amount_paid),
      balance: money(bill.balance),
    };
  }, [bill]);

  const statusText = getStatusText(bill?.status);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      <div className="no-print" style={toolbarBetween}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Purchase Bill</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Bill No: <b>{billNo || "-"}</b>
          </p>
        </div>

        <div style={toolbarWrap}>
          <button type="button" onClick={() => nav(-1)} style={btnGhost}>
            Back
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={btnPrimary}
            title="Print this purchase bill"
            disabled={!bill || loading}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {err ? <div className="no-print" style={msgErr}>{err}</div> : null}

      <div id="print-area" style={paper}>
        {!billNo ? (
          <div style={{ color: "#111" }}>Missing bill number in URL.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading purchase bill...</div>
        ) : !bill ? (
          <div style={{ color: "#111" }}>No purchase bill found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={docTitle}>PURCHASE BILL</div>
                <div style={muted}>Accounts Payable Document</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{fmt(bill.bill_no)}</div>
                <div style={statusBadge(statusText)}>{statusText || "UNKNOWN"}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Bill No" value={fmt(bill.bill_no)} />
              <Info label="Vendor Code" value={fmt(bill.vendor_code)} />
              <Info label="Bill Date" value={fmt(bill.bill_date)} />
              <Info label="Due Date" value={fmt(bill.due_date)} />
              <Info label="Remark" value={fmt(bill.remark)} />
            </div>

            <div style={{ height: 14 }} />

            <div style={sectionTitle}>Line Items</div>

            <div style={{ overflowX: "auto" }}>
              <table width="100%" cellPadding="10" style={table}>
                <thead>
                  <tr style={{ background: "#f6f7f9" }}>
                    <th align="left" style={th}>#</th>
                    <th align="left" style={th}>Item Code</th>
                    <th align="right" style={th}>Qty</th>
                    <th align="right" style={th}>Rate</th>
                    <th align="right" style={th}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.lines || []).map((ln, idx) => (
                    <tr key={ln.id ?? idx} style={{ borderTop: "1px solid #eee" }}>
                      <td style={td}>{idx + 1}</td>
                      <td style={td}>{fmt(ln.item_code)}</td>
                      <td style={tdRight}>{money(ln.qty)}</td>
                      <td style={tdRight}>{money(ln.rate)}</td>
                      <td style={tdStrongRight}>{money(ln.line_total)}</td>
                    </tr>
                  ))}

                  {(bill.lines || []).length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: 12, color: "#666" }}>
                        No line items.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div style={{ height: 14 }} />

            <div style={summaryGrid}>
              <div style={summaryCard}>
                <div style={summaryTitle}>Payment Summary</div>
                <div style={summaryBody}>
                  <InfoInline label="Amount Paid" value={totals.paid} />
                  <InfoInline label="Balance" value={totals.balance} strong />
                </div>
              </div>

              <div style={totalsWrap}>
                <TotalRow label="Subtotal" value={totals.subtotal} />
                <TotalRow label={`Tax (${totals.taxPercent}%)`} value={totals.taxAmount} />
                <TotalRow label="Grand Total" value={totals.grandTotal} strong />
                <div style={hrThin} />
                <TotalRow label="Amount Paid" value={totals.paid} />
                <TotalRow label="Balance" value={totals.balance} strong />
              </div>
            </div>

            <div style={footNote}>
              This document is generated from the Finance AP/AR System.
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

function InfoInline({ label, value, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ color: "#111", fontWeight: strong ? 900 : 700 }}>{label}</div>
      <div style={{ color: "#111", fontWeight: strong ? 900 : 800 }}>{value}</div>
    </div>
  );
}

function TotalRow({ label, value, strong = false }) {
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
  marginBottom: 12,
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
  padding: 18,
};

const docHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const companyName = {
  fontSize: 20,
  fontWeight: 900,
  color: "#111",
};

const docTitle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0b5cff",
  marginTop: 4,
  letterSpacing: 0.6,
};

const muted = {
  fontSize: 12,
  color: "#666",
  marginTop: 4,
};

const bigId = {
  fontSize: 20,
  fontWeight: 900,
  color: "#111",
  marginBottom: 8,
};

const hr = {
  height: 1,
  background: "#eee",
  margin: "14px 0",
};

const hrThin = {
  height: 1,
  background: "#e8e8e8",
  margin: "8px 0",
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
  wordBreak: "break-word",
};

const sectionTitle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#111",
  marginBottom: 10,
};

const table = {
  borderCollapse: "collapse",
  minWidth: 900,
};

const th = {
  color: "#444",
  fontSize: 13,
  fontWeight: 900,
};

const td = {
  color: "#111",
};

const tdRight = {
  color: "#111",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const tdStrongRight = {
  color: "#111",
  textAlign: "right",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
  alignItems: "start",
};

const summaryCard = {
  border: "1px solid #eee",
  borderRadius: 14,
  background: "#fafafa",
  padding: 12,
};

const summaryTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111",
  marginBottom: 10,
};

const summaryBody = {
  display: "grid",
  gap: 8,
};

const totalsWrap = {
  marginLeft: "auto",
  width: "100%",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
  display: "grid",
  gap: 8,
};

const footNote = {
  marginTop: 18,
  paddingTop: 12,
  borderTop: "1px solid #eee",
  fontSize: 12,
  color: "#666",
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

function statusBadge(status) {
  const s = String(status || "").toUpperCase();

  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  };

  if (s === "PAID") {
    return {
      ...base,
      background: "#ecfff1",
      color: "#116b2f",
      border: "1px solid #a6e0b8",
    };
  }

  if (s === "PARTIAL") {
    return {
      ...base,
      background: "#fff8e8",
      color: "#8a5a00",
      border: "1px solid #edd28a",
    };
  }

  if (s === "OVERDUE") {
    return {
      ...base,
      background: "#fff2f2",
      color: "#c40000",
      border: "1px solid #efb0b0",
    };
  }

  if (s === "CANCELLED") {
    return {
      ...base,
      background: "#f0f0f0",
      color: "#555",
      border: "1px solid #d5d5d5",
    };
  }

  return {
    ...base,
    background: "#eef4ff",
    color: "#0b5cff",
    border: "1px solid #b7cbff",
  };
}

const printCss = `
@media print {
  html, body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  #root {
    margin: 0 !important;
    padding: 0 !important;
  }

  nav {
    display: none !important;
  }

  .no-print {
    display: none !important;
  }

  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }

  table {
    width: 100% !important;
    min-width: 0 !important;
  }
}
`;