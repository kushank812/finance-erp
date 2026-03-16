import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function VendorPaymentView() {
  const { paymentNo } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [bill, setBill] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setErr("");
      setDoc(null);
      setBill(null);

      if (!paymentNo) return;

      setLoading(true);
      try {
        const payment = await apiGet(
          `/vendor-payments/${encodeURIComponent(paymentNo)}`
        );
        setDoc(payment);

        if (payment?.bill_no) {
          const billDoc = await apiGet(
            `/purchase-invoices/${encodeURIComponent(payment.bill_no)}`
          );
          setBill(billDoc);
        }
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [paymentNo]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 14 }}>
      <div style={toolbarBetween}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Vendor Payment Voucher</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            Payment No: <b>{paymentNo}</b>
          </p>
        </div>

        <div style={toolbarWrap}>
          <button onClick={() => nav(-1)} style={btnGhost}>
            Back
          </button>

          <button
            onClick={() => window.print()}
            style={btnPrimary}
            disabled={!doc || loading}
            title={!doc ? "Payment not loaded" : "Print this payment"}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {err && <div style={msgErr}>{err}</div>}

      <div id="print-area" style={paper}>
        {!paymentNo ? (
          <div style={{ color: "#111" }}>Missing payment number in URL.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading payment…</div>
        ) : !doc ? (
          <div style={{ color: "#111" }}>No payment found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={muted}>VENDOR PAYMENT VOUCHER</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{doc.payment_no}</div>
                <div style={muted}>Payment Date: {String(doc.payment_date || "")}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Payment No" value={doc.payment_no} />
              <Info label="Bill No" value={doc.bill_no || "-"} />
              <Info label="Vendor Code" value={bill?.vendor_code || doc.vendor_code || "-"} />
              <Info label="Payment Date" value={String(doc.payment_date || "")} />
              <Info label="Amount Paid" value={money(doc.amount)} />
              <Info label="Remark" value={doc.remark || "-"} />
            </div>

            <div style={{ height: 14 }} />

            <div style={totalsWrap}>
              <TotalRow label="Paid Amount" value={money(doc.amount)} strong />
            </div>

            <div style={{ height: 18 }} />

            <div style={signRow}>
              <div style={signBox}>
                <div style={signLine} />
                <div style={signLabel}>Prepared By</div>
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