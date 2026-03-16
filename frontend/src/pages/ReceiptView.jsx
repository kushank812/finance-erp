import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function ReceiptView() {
  const { invoiceNo } = useParams();
  const nav = useNavigate();

  const [inv, setInv] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      setErr("");
      setInv(null);

      if (!invoiceNo) return;

      setLoading(true);
      try {
        const data = await apiGet(`/sales-invoices/${encodeURIComponent(invoiceNo)}`);
        if (active) setInv(data);
      } catch (e) {
        if (active) setErr(String(e.message || e));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReceipt();

    return () => {
      active = false;
    };
  }, [invoiceNo]);

  const totals = useMemo(() => {
    if (!inv) return null;
    return {
      grandTotal: money(inv.grand_total),
      received: money(inv.amount_received),
      balance: money(inv.balance),
    };
  }, [inv]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 14 }}>
      <div style={toolbarBetween}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Receipt Voucher</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Invoice No: <b>{invoiceNo}</b>
          </p>
        </div>

        <div style={toolbarWrap}>
          <button onClick={() => nav(-1)} style={btnGhost}>
            Back
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={btnPrimary}
            disabled={!inv || loading}
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
          <div style={{ color: "#111" }}>Loading receipt...</div>
        ) : !inv ? (
          <div style={{ color: "#111" }}>No receipt data found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={muted}>CUSTOMER RECEIPT</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{inv.invoice_no}</div>
                <div style={muted}>Receipt Reference: {inv.invoice_no}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Receipt Ref / Invoice No" value={inv.invoice_no} />
              <Info label="Customer Code" value={inv.customer_code || "-"} />
              <Info label="Invoice Date" value={String(inv.invoice_date || "")} />
              <Info label="Remark" value={inv.remark || "-"} />
            </div>

            <div style={{ height: 14 }} />

            <div style={totalsWrap}>
              <TotalRow label="Invoice Total" value={totals.grandTotal} />
              <TotalRow label="Amount Received" value={totals.received} strong />
              <div style={hr} />
              <TotalRow label="Balance" value={totals.balance} strong />
            </div>

            <div style={{ height: 18 }} />

            <div style={signRow}>
              <div style={signBox}>
                <div style={signLine} />
                <div style={signLabel}>Received By</div>
              </div>

              <div style={signBox}>
                <div style={signLine} />
                <div style={signLabel}>Authorized Signatory</div>
              </div>
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
  width: "min(380px, 100%)",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const signRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 24,
  marginTop: 30,
};

const signBox = {
  paddingTop: 24,
};

const signLine = {
  borderTop: "1px solid #111",
  width: "100%",
  marginBottom: 6,
};

const signLabel = {
  fontSize: 12,
  color: "#444",
  textAlign: "center",
  fontWeight: 700,
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