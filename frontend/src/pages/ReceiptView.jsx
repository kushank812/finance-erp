import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function ReceiptView() {
  const { receiptNo } = useParams();
  const nav = useNavigate();

  const [receipt, setReceipt] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReceiptAndInvoice() {
      setErr("");
      setReceipt(null);
      setInvoice(null);

      if (!receiptNo) return;

      setLoading(true);
      try {
        const receiptData = await apiGet(
          `/receipts/${encodeURIComponent(receiptNo)}`
        );

        if (!active) return;
        setReceipt(receiptData || null);

        if (receiptData?.invoice_no) {
          const invoiceData = await apiGet(
            `/sales-invoices/${encodeURIComponent(receiptData.invoice_no)}`
          );
          if (!active) return;
          setInvoice(invoiceData || null);
        }
      } catch (e) {
        if (active) {
          setErr(String(e.message || e));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReceiptAndInvoice();

    return () => {
      active = false;
    };
  }, [receiptNo]);

  const totals = useMemo(() => {
    const invoiceTotal = Number(invoice?.grand_total || 0);
    const totalReceived = Number(invoice?.amount_received || 0);
    const currentReceiptAmount = Number(receipt?.amount || 0);

    const receivedBeforeThisReceipt =
      totalReceived > 0 ? Math.max(totalReceived - currentReceiptAmount, 0) : 0;

    const balanceAfterReceipt = Number(invoice?.balance || 0);

    return {
      invoiceTotal: money(invoiceTotal),
      receivedBeforeThisReceipt: money(receivedBeforeThisReceipt),
      currentReceiptAmount: money(currentReceiptAmount),
      totalReceived: money(totalReceived),
      balanceAfterReceipt: money(balanceAfterReceipt),
    };
  }, [invoice, receipt]);

  const titleReceiptNo = receipt?.receipt_no || receiptNo || "-";
  const linkedInvoiceNo = receipt?.invoice_no || invoice?.invoice_no || "-";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 14 }}>
      <div style={toolbarBetween}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Receipt Voucher</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Receipt No: <b>{titleReceiptNo}</b>
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
            disabled={!receipt || loading}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      <div id="print-area" style={paper}>
        {!receiptNo ? (
          <div style={{ color: "#111" }}>Missing receipt number in URL.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading receipt...</div>
        ) : !receipt ? (
          <div style={{ color: "#111" }}>No receipt data found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={muted}>CUSTOMER RECEIPT</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{receipt.receipt_no}</div>
                <div style={muted}>Linked Invoice: {linkedInvoiceNo}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Receipt No" value={receipt.receipt_no || "-"} />
              <Info label="Receipt Date" value={String(receipt.receipt_date || "-")} />
              <Info label="Invoice No" value={linkedInvoiceNo} />
              <Info label="Customer Code" value={invoice?.customer_code || "-"} />
              <Info label="Invoice Date" value={String(invoice?.invoice_date || "-")} />
              <Info label="Receipt Remark" value={receipt.remark || "-"} />
            </div>

            <div style={{ height: 14 }} />

            <div style={totalsWrap}>
              <TotalRow label="Invoice Total" value={totals.invoiceTotal} />
              <TotalRow
                label="Received Before This Receipt"
                value={totals.receivedBeforeThisReceipt}
              />
              <TotalRow
                label="This Receipt Amount"
                value={totals.currentReceiptAmount}
                strong
              />
              <div style={hr} />
              <TotalRow label="Total Received" value={totals.totalReceived} />
              <TotalRow
                label="Balance After Receipt"
                value={totals.balanceAfterReceipt}
                strong
              />
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
  marginTop: 12,
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
  width: "min(420px, 100%)",
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
  html, body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  #root {
    padding: 0 !important;
    margin: 0 !important;
  }

  nav {
    display: none !important;
  }

  button, input, select, textarea {
    display: none !important;
  }

  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
}
`;