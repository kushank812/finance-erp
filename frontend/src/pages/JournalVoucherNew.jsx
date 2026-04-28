import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField } from "../components/ui/FormField";
import { formatDateForDisplay, toISODate } from "../utils/date";
import {
  page,
  stack,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle,
  field,
  labelStyle,
  input,
  btnPrimary,
  btnSecondary,
  btnGhost,
  actionBar,
  saveActions,
  badgeBlue,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function formatDate(value) {
  return formatDateForDisplay(value) || "-";
}

function sortOpenInvoices(rows) {
  return [...rows].sort((a, b) => {
    const dateA = toISODate(a?.invoice_date) || "";
    const dateB = toISODate(b?.invoice_date) || "";
    if (dateB !== dateA) return dateB.localeCompare(dateA);

    return String(b?.invoice_no || "").localeCompare(
      String(a?.invoice_no || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    );
  });
}

function sortOpenBills(rows) {
  return [...rows].sort((a, b) => {
    const dateA = toISODate(a?.bill_date) || "";
    const dateB = toISODate(b?.bill_date) || "";
    if (dateB !== dateA) return dateB.localeCompare(dateA);

    return String(b?.bill_no || "").localeCompare(
      String(a?.bill_no || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    );
  });
}

const REASON_OPTIONS = [
  "MANUAL_ADJUSTMENT",
  "ROUND_OFF",
  "SHORT_RECEIPT_ADJUSTMENT",
  "SHORT_PAYMENT_ADJUSTMENT",
  "EXCESS_RECEIPT_ADJUSTMENT",
  "EXCESS_PAYMENT_ADJUSTMENT",
  "DISCOUNT_ALLOWED",
  "WRITE_OFF",
];

const DIRECTION_OPTIONS = [
  {
    value: "DECREASE",
    label: "Reduce Balance",
    hint: "Use for short receipt, round-off, discount, write-off.",
  },
  {
    value: "INCREASE",
    label: "Increase Balance",
    hint: "Use when you need to reverse or increase outstanding balance.",
  },
  {
    value: "EXCESS",
    label: "Excess / Credit Adjustment",
    hint: "Use when client/vendor paid extra and it should be treated as credit.",
  },
];

export default function JournalVoucherNew() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("AR");

  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [referenceNo, setReferenceNo] = useState("");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [showRefList, setShowRefList] = useState(false);

  const [amount, setAmount] = useState("");
  const [reasonCode, setReasonCode] = useState("MANUAL_ADJUSTMENT");
  const [direction, setDirection] = useState("DECREASE");
  const [narration, setNarration] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickerRef = useRef(null);

  async function load() {
    setErr("");
    setOk("");
    setLoading(true);

    try {
      const [ar, ap, c, v] = await Promise.all([
        apiGet("/sales-invoices/"),
        apiGet("/purchase-invoices/"),
        apiGet("/customers/"),
        apiGet("/vendors/"),
      ]);

      const safeInvoices = Array.isArray(ar) ? ar : [];
      const safeBills = Array.isArray(ap) ? ap : [];
      const safeCustomers = Array.isArray(c) ? c : [];
      const safeVendors = Array.isArray(v) ? v : [];

      const selectableInvoices = safeInvoices.filter(
        (r) => String(r.status || "").toUpperCase() !== "CANCELLED"
      );
      const selectableBills = safeBills.filter(
        (r) => String(r.status || "").toUpperCase() !== "CANCELLED"
      );

      setInvoices(sortOpenInvoices(selectableInvoices));
      setBills(sortOpenBills(selectableBills));
      setCustomers(safeCustomers);
      setVendors(safeVendors);

      const currentRows = mode === "AR" ? selectableInvoices : selectableBills;
      const stillExists = currentRows.some((r) =>
        mode === "AR"
          ? r.invoice_no === referenceNo
          : r.bill_no === referenceNo
      );

      if (referenceNo && !stillExists) {
        setReferenceNo("");
        setReferenceSearch("");
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setReferenceNo("");
    setReferenceSearch("");
    setShowRefList(false);
    setAmount("");
    setNarration("");
    setDirection("DECREASE");
    setReasonCode("MANUAL_ADJUSTMENT");
    setErr("");
    setOk("");
  }, [mode]);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowRefList(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const customerNameByCode = useMemo(() => {
    const m = new Map();
    for (const r of customers) m.set(r.customer_code, r.customer_name);
    return m;
  }, [customers]);

  const vendorNameByCode = useMemo(() => {
    const m = new Map();
    for (const r of vendors) m.set(r.vendor_code, r.vendor_name);
    return m;
  }, [vendors]);

  const activeRows = mode === "AR" ? invoices : bills;

  const filteredRows = useMemo(() => {
    const q = referenceSearch.trim().toUpperCase();
    if (!q) return activeRows;

    return activeRows.filter((r) => {
      if (mode === "AR") {
        const invoiceNo = String(r.invoice_no || "").toUpperCase();
        const customerCode = String(r.customer_code || "").toUpperCase();
        const customerName = String(
          customerNameByCode.get(r.customer_code) || ""
        ).toUpperCase();

        return (
          invoiceNo.includes(q) ||
          customerCode.includes(q) ||
          customerName.includes(q) ||
          String(r.grand_total || "").includes(q) ||
          String(r.balance || "").includes(q) ||
          String(r.invoice_date || "").toUpperCase().includes(q)
        );
      }

      const billNo = String(r.bill_no || "").toUpperCase();
      const vendorCode = String(r.vendor_code || "").toUpperCase();
      const vendorName = String(
        vendorNameByCode.get(r.vendor_code) || ""
      ).toUpperCase();

      return (
        billNo.includes(q) ||
        vendorCode.includes(q) ||
        vendorName.includes(q) ||
        String(r.grand_total || "").includes(q) ||
        String(r.balance || "").includes(q) ||
        String(r.bill_date || "").toUpperCase().includes(q)
      );
    });
  }, [activeRows, referenceSearch, mode, customerNameByCode, vendorNameByCode]);

  const selected = useMemo(() => {
    if (!referenceNo) return null;
    return activeRows.find((r) =>
      mode === "AR" ? r.invoice_no === referenceNo : r.bill_no === referenceNo
    );
  }, [activeRows, referenceNo, mode]);

  const currentBalance = selected ? num(selected.balance) : 0;
  const selectedDirection = DIRECTION_OPTIONS.find((x) => x.value === direction);

  function selectReference(row) {
    if (mode === "AR") {
      const customerName = customerNameByCode.get(row.customer_code) || "";
      setReferenceNo(row.invoice_no);
      setReferenceSearch(
        `${row.invoice_no} | ${row.customer_code}${
          customerName ? " - " + customerName : ""
        } | BAL ${money(row.balance)}`
      );
    } else {
      const vendorName = vendorNameByCode.get(row.vendor_code) || "";
      setReferenceNo(row.bill_no);
      setReferenceSearch(
        `${row.bill_no} | ${row.vendor_code}${
          vendorName ? " - " + vendorName : ""
        } | BAL ${money(row.balance)}`
      );
    }

    setShowRefList(false);
  }

  function clear() {
    setReferenceNo("");
    setReferenceSearch("");
    setAmount("");
    setReasonCode("MANUAL_ADJUSTMENT");
    setDirection("DECREASE");
    setNarration("");
    setErr("");
    setOk("");
    setShowRefList(false);
  }

  async function save() {
    setErr("");
    setOk("");

    if (!referenceNo) {
      setErr(mode === "AR" ? "Select a sales invoice." : "Select a purchase bill.");
      return;
    }

    const amt = num(amount);
    if (amt <= 0) {
      setErr("Enter a valid adjustment amount (> 0).");
      return;
    }

    if (!selected) {
      setErr("Selected document not found. Click Refresh.");
      return;
    }

    if (direction === "DECREASE" && amt > currentBalance) {
      setErr(
        `Reduce Balance adjustment cannot exceed current balance. Balance is ${money(
          currentBalance
        )}. Use Excess / Credit Adjustment for extra payment cases.`
      );
      return;
    }

    try {
      setSaving(true);

      const url =
        mode === "AR"
          ? `/journal-vouchers/adjust-sales-invoice/${encodeURIComponent(
              referenceNo
            )}`
          : `/journal-vouchers/adjust-purchase-bill/${encodeURIComponent(
              referenceNo
            )}`;

      const res = await apiPost(url, {
        amount: amt,
        reason_code: reasonCode,
        direction,
        narration: narration?.trim() || null,
      });

      if (!res?.voucher_no) {
        setErr("JV saved, but backend did not return voucher number.");
        return;
      }

      setOk(`Journal Voucher saved successfully. JV No: ${res.voucher_no}`);
      setAmount("");
      setNarration("");
      await load();

      navigate(`/journal-voucher/view/${encodeURIComponent(res.voucher_no)}`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="JOURNAL VOUCHER"
        title="Create Adjustment Voucher"
        subtitle="Create short-payment, reverse, round-off, write-off, or excess-payment adjustments."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/journal-vouchers")}
              style={btnSecondary}
              disabled={loading || saving}
            >
              View JV List
            </button>

            <button
              type="button"
              onClick={load}
              style={btnGhost}
              disabled={loading || saving}
            >
              Refresh Form
            </button>
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {ok ? <AlertBox kind="success" message={ok} /> : null}
        {loading ? <AlertBox kind="info" message="Loading documents..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Adjustment Details</h2>
            <p style={cardSubtitle}>
              Select AR or AP mode, pick a document, choose the adjustment type,
              then create the voucher.
            </p>
          </div>
          <div style={badgeBlue}>NEW</div>
        </div>

        <div style={modeWrap}>
          <button
            type="button"
            onClick={() => setMode("AR")}
            style={mode === "AR" ? tabActiveBlue : tabButton}
            disabled={loading || saving}
          >
            Adjust Sales Invoice
          </button>

          <button
            type="button"
            onClick={() => setMode("AP")}
            style={mode === "AP" ? tabActiveGreen : tabButton}
            disabled={loading || saving}
          >
            Adjust Purchase Bill
          </button>
        </div>

        <div style={paymentGrid}>
          <div style={fieldWide} ref={pickerRef}>
            <label style={labelStyle}>
              {mode === "AR" ? "Sales Invoice Search" : "Purchase Bill Search"}
            </label>

            <input
              value={referenceSearch}
              onChange={(e) => {
                setReferenceSearch(e.target.value);
                setShowRefList(true);
                if (!e.target.value.trim()) {
                  setReferenceNo("");
                }
              }}
              onFocus={() => setShowRefList(true)}
              placeholder={
                mode === "AR"
                  ? "Search by invoice no, customer, total, balance"
                  : "Search by bill no, vendor, total, balance"
              }
              style={input}
              disabled={loading || saving}
            />

            {showRefList && (
              <div style={dropdown}>
                <div style={dropdownHead}>
                  {filteredRows.length} {mode === "AR" ? "invoice" : "bill"}
                  {filteredRows.length === 1 ? "" : "s"} found
                </div>

                <div style={dropdownList}>
                  {filteredRows.length === 0 ? (
                    <div style={emptyRow}>No matching documents found.</div>
                  ) : (
                    filteredRows.map((r) => {
                      const active =
                        mode === "AR"
                          ? r.invoice_no === referenceNo
                          : r.bill_no === referenceNo;

                      const title = mode === "AR" ? r.invoice_no : r.bill_no;
                      const partyCode =
                        mode === "AR" ? r.customer_code : r.vendor_code;
                      const partyName =
                        mode === "AR"
                          ? customerNameByCode.get(r.customer_code) || ""
                          : vendorNameByCode.get(r.vendor_code) || "";
                      const docDate =
                        mode === "AR" ? r.invoice_date : r.bill_date;

                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() => selectReference(r)}
                          style={{
                            ...dropdownItem,
                            ...(active ? dropdownItemActive : {}),
                          }}
                        >
                          <div style={dropdownTitle}>{title}</div>
                          <div style={dropdownSub}>
                            {mode === "AR" ? "Customer" : "Vendor"}:{" "}
                            {partyName || partyCode}
                          </div>
                          <div style={dropdownSub}>
                            Date: {docDate ? formatDate(docDate) : "-"}
                          </div>
                          <div style={dropdownSub}>
                            Total: {money(r.grand_total)} | Balance:{" "}
                            {money(r.balance)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div style={hintLine}>
              Cancelled documents are hidden. Paid documents can still be selected
              if available for excess or reverse adjustment.
            </div>
          </div>

          <FormField
            label="Adjustment Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={loading || saving}
            hint={
              selected
                ? direction === "DECREASE"
                  ? `Maximum reduce amount: ${money(currentBalance)}`
                  : `Current balance: ${money(currentBalance)}`
                : ""
            }
          />

          <div style={field}>
            <label style={labelStyle}>Adjustment Type</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              style={input}
              disabled={loading || saving}
            >
              {DIRECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div style={hintLine}>{selectedDirection?.hint}</div>
          </div>

          <div style={field}>
            <label style={labelStyle}>Reason Code</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              style={input}
              disabled={loading || saving}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <FormField
            label="Narration"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Optional narration"
            disabled={loading || saving}
            hint="Optional."
          />
        </div>

        <div style={subSectionCard}>
          <div style={subSectionHeader}>
            <h3 style={subSectionTitle}>Selected Document Summary</h3>
          </div>

          <div style={infoGrid}>
            <InfoMini
              label={mode === "AR" ? "Invoice No" : "Bill No"}
              value={
                selected
                  ? mode === "AR"
                    ? selected.invoice_no
                    : selected.bill_no
                  : "-"
              }
            />
            <InfoMini
              label={mode === "AR" ? "Customer" : "Vendor"}
              value={
                selected
                  ? mode === "AR"
                    ? customerNameByCode.get(selected.customer_code) ||
                      selected.customer_code
                    : vendorNameByCode.get(selected.vendor_code) ||
                      selected.vendor_code
                  : "-"
              }
            />
            <InfoMini
              label="Document Date"
              value={
                selected
                  ? formatDate(
                      mode === "AR" ? selected.invoice_date : selected.bill_date
                    )
                  : "-"
              }
            />
            <InfoMini
              label="Grand Total"
              value={selected ? money(selected.grand_total) : "-"}
            />
            <InfoMini
              label="Cash Settled"
              value={
                selected
                  ? money(
                      mode === "AR"
                        ? selected.amount_received
                        : selected.amount_paid
                    )
                  : "-"
              }
            />
            <InfoMini
              label="Current Balance"
              value={selected ? money(selected.balance) : "-"}
            />
          </div>
        </div>

        <div style={footerGrid}>
          <div style={noteBox}>
            Use <b>Reduce Balance</b> for short receipt/payment, round-off,
            discount, or write-off. Use <b>Increase Balance</b> for reversal or
            correction. Use <b>Excess / Credit Adjustment</b> when the client or
            vendor paid extra and the difference should be recorded as credit.
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>JV Summary</div>
            <SummaryRow
              label={mode === "AR" ? "Invoice No" : "Bill No"}
              value={
                selected
                  ? mode === "AR"
                    ? selected.invoice_no
                    : selected.bill_no
                  : "-"
              }
            />
            <SummaryRow
              label="Current Balance"
              value={selected ? money(currentBalance) : "-"}
            />
            <SummaryRow
              label="Adjustment Type"
              value={selectedDirection?.label || "-"}
            />
            <SummaryRow label="Reason" value={reasonCode.replaceAll("_", " ")} />
            <SummaryRow
              label="Adjustment Amount"
              value={amount ? money(amount) : "0.00"}
              bold
            />
          </div>
        </div>

        <div style={actionBar}>
          <div style={saveActions}>
            <button
              type="button"
              onClick={clear}
              style={btnSecondary}
              disabled={loading || saving}
            >
              Clear
            </button>

            <button
              type="button"
              onClick={save}
              style={btnPrimary}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save JV"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value, bold = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: bold ? 16 : 14,
        fontWeight: bold ? 900 : 700,
        color: "#0f172a",
        padding: bold ? "10px 0 0 0" : "0",
        borderTop: bold ? "1px solid #dbe2ea" : "none",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
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

const modeWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const tabButton = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 900,
};

const tabActiveBlue = {
  ...tabButton,
  background: "#eef4ff",
  color: "#0b5cff",
  border: "1px solid #b7cbff",
};

const tabActiveGreen = {
  ...tabButton,
  background: "#ecfff1",
  color: "#116b2f",
  border: "1px solid #a6e0b8",
};

const paymentGrid = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr",
  gap: 14,
  alignItems: "start",
};

const fieldWide = {
  ...field,
  position: "relative",
};

const hintLine = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 6,
};

const subSectionCard = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
};

const subSectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const subSectionTitle = {
  margin: 0,
  fontSize: 14,
  color: "#0f172a",
  fontWeight: 900,
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const infoMini = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
};

const infoMiniLabel = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
};

const infoMiniValue = {
  fontSize: 14,
  color: "#0f172a",
  fontWeight: 900,
  marginTop: 4,
  wordBreak: "break-word",
};

const dropdown = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 6,
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: 14,
  boxShadow: "0 18px 32px rgba(15, 23, 42, 0.14)",
  zIndex: 30,
  overflow: "hidden",
};

const dropdownHead = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 900,
  color: "#475569",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const dropdownList = {
  maxHeight: 260,
  overflowY: "auto",
};

const dropdownItem = {
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid #eef2f7",
  background: "#ffffff",
  padding: "12px 14px",
  cursor: "pointer",
};

const dropdownItemActive = {
  background: "#eff6ff",
};

const dropdownTitle = {
  fontWeight: 900,
  color: "#0f172a",
};

const dropdownSub = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 3,
};

const emptyRow = {
  padding: 14,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const footerGrid = {
  display: "grid",
  gridTemplateColumns: "1.5fr minmax(280px, 360px)",
  gap: 16,
  alignItems: "start",
};

const noteBox = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
};

const summaryCard = {
  background: "#f8fafc",
  border: "1px solid #dbe2ea",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 10,
};

const summaryTitle = {
  fontSize: 13,
  color: "#334155",
  fontWeight: 900,
  marginBottom: 4,
};