import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet } from "../api/client";

import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { formatDateForDisplay } from "../utils/date";
import {
  page,
  stack,
  btnPrimary,
  btnSecondary,
  btnDangerMini,
  disabledBtn,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function isoToDisplay(iso) {
  return formatDateForDisplay(iso);
}

export default function VendorPaymentView() {
  const { paymentNo } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [bill, setBill] = useState(null);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [reversing, setReversing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPayment() {
      setErr("");
      setOkMsg("");
      setDoc(null);
      setBill(null);

      if (!paymentNo) return;

      setLoading(true);
      try {
        const payment = await apiGet(
          `/vendor-payments/${encodeURIComponent(paymentNo)}`
        );
        if (!active) return;

        setDoc(payment || null);

        if (payment?.bill_no) {
          const billDoc = await apiGet(
            `/purchase-invoices/${encodeURIComponent(payment.bill_no)}`
          );
          if (active) setBill(billDoc || null);
        }
      } catch (e) {
        if (active) setErr(String(e.message || e));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPayment();

    return () => {
      active = false;
    };
  }, [paymentNo]);

  async function onReversePayment() {
    if (!doc?.payment_no) return;

    const ok = window.confirm(
      `Are you sure you want to reverse vendor payment ${doc.payment_no}?\n\n` +
        `This will remove the payment entry and recalculate the linked bill balance/status.\n` +
        `Use this only for wrong or mistaken payment entries.`
    );
    if (!ok) return;

    try {
      setErr("");
      setOkMsg("");
      setReversing(true);

      const res = await apiDelete(
        `/purchase-invoices/payments/${encodeURIComponent(doc.payment_no)}`
      );

      setOkMsg(
        res?.message || `Vendor payment ${doc.payment_no} reversed successfully.`
      );

      setTimeout(() => {
        nav("/purchase-bills");
      }, 1200);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setReversing(false);
    }
  }

  const canReverse = !!doc && !loading && !reversing;

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="VENDOR PAYMENTS"
        title="Vendor Payment Voucher"
        subtitle={`Payment No: ${paymentNo || "-"}`}
        actions={
          <div className="no-print" style={toolbarWrap}>
            <button type="button" onClick={() => nav(-1)} style={btnSecondary}>
              Back
            </button>

            <button
              type="button"
              onClick={onReversePayment}
              style={canReverse ? btnDanger : disabledBtn(btnDanger)}
              disabled={!canReverse}
              title={!doc ? "Payment not loaded" : "Reverse this vendor payment"}
            >
              {reversing ? "Reversing..." : "Reverse Payment"}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={btnPrimary}
              disabled={!doc || loading || reversing}
              title={!doc ? "Payment not loaded" : "Print this payment"}
            >
              Print / Save PDF
            </button>
          </div>
        }
      />

      <div className="no-print" style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {okMsg ? <AlertBox kind="success" message={okMsg} /> : null}
      </div>

      <div id="print-area" style={paper}>
        {!paymentNo ? (
          <div style={{ color: "#111" }}>Missing payment number in URL.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading payment...</div>
        ) : !doc ? (
          <div style={{ color: "#111" }}>No payment found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={docTitle}>VENDOR PAYMENT VOUCHER</div>
                <div style={muted}>Accounts Payable Payment Document</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{fmt(doc.payment_no)}</div>
                <div style={muted}>
                  Payment Date: {isoToDisplay(doc.payment_date)}
                </div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="Payment No" value={fmt(doc.payment_no)} />
              <Info label="Bill No" value={fmt(doc.bill_no)} />
              <Info
                label="Vendor Code"
                value={fmt(bill?.vendor_code || doc.vendor_code)}
              />
              <Info
                label="Payment Date"
                value={isoToDisplay(doc.payment_date)}
              />
              <Info label="Amount Paid" value={money(doc.amount)} />
              <Info label="Remark" value={fmt(doc.remark)} />
            </div>

            {bill ? (
              <>
                <div style={{ height: 14 }} />
                <div style={linkedCard}>
                  <div style={linkedTitle}>Linked Purchase Bill</div>
                  <div style={linkedGrid}>
                    <InfoMini label="Bill No" value={fmt(bill.bill_no)} />
                    <InfoMini
                      label="Bill Date"
                      value={isoToDisplay(bill.bill_date)}
                    />
                    <InfoMini label="Status" value={fmt(bill.status)} />
                    <InfoMini
                      label="Grand Total"
                      value={money(bill.grand_total)}
                    />
                    <InfoMini
                      label="Amount Paid"
                      value={money(bill.amount_paid)}
                    />
                    <InfoMini label="Balance" value={money(bill.balance)} />
                  </div>
                </div>
              </>
            ) : null}

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

function InfoMini({ label, value }) {
  return (
    <div style={infoMini}>
      <div style={infoMiniLabel}>{label}</div>
      <div style={infoMiniValue}>{value}</div>
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
  wordBreak: "break-word",
};

const linkedCard = {
  background: "#f8fbff",
  border: "1px solid #dbe8ff",
  borderRadius: 14,
  padding: 12,
};

const linkedTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0b3d91",
  marginBottom: 10,
};

const linkedGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const infoMini = {
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 12,
  padding: 10,
};

const infoMiniLabel = {
  fontSize: 12,
  color: "#666",
  fontWeight: 700,
};

const infoMiniValue = {
  fontSize: 14,
  color: "#111",
  fontWeight: 900,
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

const btnDanger = {
  ...btnDangerMini,
  minHeight: 44,
  padding: "10px 14px",
};

const printCss = `
@media print {
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  #root { padding: 0 !important; margin: 0 !important; }
  nav { display: none !important; }
  .no-print { display: none !important; }

  #print-area {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
}
`;