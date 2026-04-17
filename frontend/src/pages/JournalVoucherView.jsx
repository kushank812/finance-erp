import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../api/client";

import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { formatDateForDisplay } from "../utils/date";
import {
  page,
  stack,
  btnPrimary,
  btnSecondary,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatDate(value) {
  return formatDateForDisplay(value) || "-";
}

export default function JournalVoucherView() {
  const { voucherNo } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadVoucher() {
      setErr("");
      setDoc(null);

      if (!voucherNo) return;

      setLoading(true);
      try {
        const voucher = await apiGet(
          `/journal-vouchers/${encodeURIComponent(voucherNo)}`
        );
        if (!active) return;
        setDoc(voucher || null);
      } catch (e) {
        if (active) setErr(String(e.message || e));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadVoucher();

    return () => {
      active = false;
    };
  }, [voucherNo]);

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="JOURNAL VOUCHER"
        title="Adjustment Voucher"
        subtitle={`JV No: ${voucherNo || "-"}`}
        actions={
          <div className="no-print" style={toolbarWrap}>
            <button type="button" onClick={() => nav(-1)} style={btnSecondary}>
              Back
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={btnPrimary}
              disabled={!doc || loading}
            >
              Print / Save PDF
            </button>
          </div>
        }
      />

      <div className="no-print" style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
      </div>

      <div id="print-area" style={paper}>
        {!voucherNo ? (
          <div style={{ color: "#111" }}>Missing voucher number in URL.</div>
        ) : loading ? (
          <div style={{ color: "#111" }}>Loading voucher...</div>
        ) : !doc ? (
          <div style={{ color: "#111" }}>No voucher found.</div>
        ) : (
          <>
            <div style={docHeader}>
              <div>
                <div style={companyName}>Finance AP/AR System</div>
                <div style={docTitle}>JOURNAL VOUCHER</div>
                <div style={muted}>Adjustment Voucher</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={bigId}>{fmt(doc.voucher_no)}</div>
                <div style={muted}>JV Date: {formatDate(doc.voucher_date)}</div>
              </div>
            </div>

            <div style={hr} />

            <div style={metaGrid}>
              <Info label="JV No" value={fmt(doc.voucher_no)} />
              <Info label="JV Date" value={formatDate(doc.voucher_date)} />
              <Info label="JV Kind" value={fmt(doc.voucher_kind)} />
              <Info label="Reference Type" value={fmt(doc.reference_type)} />
              <Info label="Reference No" value={fmt(doc.reference_no)} />
              <Info label="Party Code" value={fmt(doc.party_code)} />
              <Info label="Reason Code" value={fmt(doc.reason_code)} />
              <Info label="Status" value={fmt(doc.status)} />
              <Info label="Narration" value={fmt(doc.narration)} />
            </div>

            <div style={{ height: 14 }} />

            <div style={totalsWrap}>
              <TotalRow label="Adjustment Amount" value={money(doc.amount)} strong />
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