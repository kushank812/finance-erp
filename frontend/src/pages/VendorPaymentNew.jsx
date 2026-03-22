import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function VendorPaymentNew() {
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [billNo, setBillNo] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [showBillList, setShowBillList] = useState(false);

  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

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
      const [b, v] = await Promise.all([
        apiGet("/purchase-invoices/"),
        apiGet("/vendors/"),
      ]);

      const allBills = Array.isArray(b) ? b : [];
      const allVendors = Array.isArray(v) ? v : [];

      const openBills = allBills
        .filter((r) => num(r.balance) > 0)
        .sort((a, b) =>
          String(a.bill_no || "").localeCompare(String(b.bill_no || ""))
        );

      setBills(openBills);
      setVendors(allVendors);

      if (billNo && !openBills.some((r) => r.bill_no === billNo)) {
        setBillNo("");
        setBillSearch("");
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowBillList(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const vendorNameByCode = useMemo(() => {
    const m = new Map();
    for (const v of vendors) {
      m.set(v.vendor_code, v.vendor_name);
    }
    return m;
  }, [vendors]);

  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toUpperCase();
    if (!q) return bills;

    return bills.filter((r) => {
      const bill = String(r.bill_no || "").toUpperCase();
      const vendorCode = String(r.vendor_code || "").toUpperCase();
      const vendorName = String(
        vendorNameByCode.get(r.vendor_code) || ""
      ).toUpperCase();
      const total = String(r.grand_total || "");
      const balance = String(r.balance || "");

      return (
        bill.includes(q) ||
        vendorCode.includes(q) ||
        vendorName.includes(q) ||
        total.includes(q) ||
        balance.includes(q)
      );
    });
  }, [bills, billSearch, vendorNameByCode]);

  const selected = useMemo(
    () => bills.find((r) => r.bill_no === billNo),
    [bills, billNo]
  );

  const maxPayable = selected ? num(selected.balance) : 0;

  function selectBill(row) {
    const vendorName = vendorNameByCode.get(row.vendor_code) || "";

    setBillNo(row.bill_no);
    setBillSearch(
      `${row.bill_no} | ${row.vendor_code}${
        vendorName ? " - " + vendorName : ""
      } | BAL ${money(row.balance)}`
    );
    setShowBillList(false);
  }

  function clear() {
    setBillNo("");
    setBillSearch("");
    setAmount("");
    setRemark("");
    setErr("");
    setOk("");
    setShowBillList(false);
  }

  async function save() {
    setErr("");
    setOk("");

    if (!billNo) {
      setErr("Select a purchase bill.");
      return;
    }

    const amt = num(amount);
    if (amt <= 0) {
      setErr("Enter a valid paid amount (> 0).");
      return;
    }

    if (!selected) {
      setErr("Selected bill not found. Click Refresh.");
      return;
    }

    if (amt > maxPayable) {
      setErr(
        `Payment amount cannot exceed bill balance. Balance is ${money(maxPayable)}.`
      );
      return;
    }

    try {
      setSaving(true);

      const res = await apiPost(
        `/purchase-invoices/${encodeURIComponent(billNo)}/pay`,
        {
          amount: amt,
          remark: remark?.trim() || null,
        }
      );

      if (!res?.payment_no) {
        setErr("Payment saved, but backend did not return payment number.");
        return;
      }

      setOk(`Payment saved successfully. Payment No: ${res.payment_no}`);
      setAmount("");
      setRemark("");
      await load();

      navigate(`/vendor-payment/view/${encodeURIComponent(res.payment_no)}`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <div style={pageHeader}>
        <div>
          <div style={eyebrow}>VENDOR PAYMENTS</div>
          <h1 style={pageTitle}>Create Vendor Payment</h1>
          <p style={pageSubtitle}>
            Record a payment against an open purchase bill.
          </p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={() => navigate("/vendor-payments")}
            style={btnSecondary}
            disabled={loading || saving}
          >
            Back to Payments
          </button>

          <button
            type="button"
            onClick={load}
            style={btnGhost}
            disabled={loading || saving}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {ok ? <AlertBox kind="success" message={ok} /> : null}
        {loading ? <AlertBox kind="info" message="Loading unpaid bills..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Payment Details</h2>
            <p style={cardSubtitle}>
              Select an unpaid purchase bill, enter the paid amount, and save the payment.
            </p>
          </div>
          <div style={badgeBlue}>NEW</div>
        </div>

        <div style={formGrid}>
          <div style={fieldWide} ref={pickerRef}>
            <label style={labelStyle}>Purchase Bill Search</label>

            <input
              value={billSearch}
              onChange={(e) => {
                setBillSearch(e.target.value);
                setShowBillList(true);
                if (!e.target.value.trim()) {
                  setBillNo("");
                }
              }}
              onFocus={() => setShowBillList(true)}
              placeholder="Search by bill no, vendor, total, balance"
              style={input}
              disabled={loading || saving}
            />

            {showBillList && (
              <div style={dropdown}>
                <div style={dropdownHead}>
                  {filteredBills.length} bill
                  {filteredBills.length === 1 ? "" : "s"} found
                </div>

                <div style={dropdownList}>
                  {filteredBills.length === 0 ? (
                    <div style={emptyRow}>No matching unpaid bills found.</div>
                  ) : (
                    filteredBills.map((r) => {
                      const vendorName = vendorNameByCode.get(r.vendor_code) || "";
                      const active = r.bill_no === billNo;

                      return (
                        <button
                          key={r.bill_no}
                          type="button"
                          onClick={() => selectBill(r)}
                          style={{
                            ...dropdownItem,
                            ...(active ? dropdownItemActive : {}),
                          }}
                        >
                          <div style={dropdownTitle}>{r.bill_no}</div>
                          <div style={dropdownSub}>
                            Vendor: {vendorName || r.vendor_code}
                          </div>
                          <div style={dropdownSub}>
                            Total: {money(r.grand_total)} | Balance: {money(r.balance)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div style={hintText}>
              Only purchase bills with outstanding balance are shown.
            </div>
          </div>

          <Field
            label="Amount Paid Now"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={loading || saving}
            hint={selected ? `Maximum payable: ${money(maxPayable)}` : ""}
          />

          <Field
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional note"
            disabled={loading || saving}
            hint="Optional."
          />
        </div>

        <div style={subSectionCard}>
          <div style={subSectionHeader}>
            <h3 style={subSectionTitle}>Selected Bill Summary</h3>
          </div>

          <div style={infoGrid}>
            <Info label="Selected Bill" value={selected?.bill_no || "-"} />
            <Info
              label="Vendor"
              value={
                selected
                  ? vendorNameByCode.get(selected.vendor_code) || selected.vendor_code
                  : "-"
              }
            />
            <Info
              label="Bill Total"
              value={selected ? money(selected.grand_total) : "-"}
            />
            <Info
              label="Current Balance"
              value={selected ? money(selected.balance) : "-"}
            />
          </div>
        </div>

        <div style={footerGrid}>
          <div style={noteBox}>
            Save the vendor payment only after verifying the selected purchase bill
            and paid amount. The payment amount cannot be greater than the current
            outstanding balance.
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Payment Summary</div>
            <SummaryRow label="Bill No" value={selected?.bill_no || "-"} />
            <SummaryRow
              label="Open Balance"
              value={selected ? money(maxPayable) : "-"}
            />
            <SummaryRow
              label="Amount Now"
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
              style={saving || loading ? disabledBtn(btnPrimary) : btnPrimary}
              disabled={saving || loading}
            >
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
  hint = "",
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={disabled ? disabledInput : input}
        disabled={disabled}
      />
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoMini}>
      <div style={infoMiniLabel}>{label}</div>
      <div style={infoMiniValue}>{value}</div>
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

function AlertBox({ kind, message }) {
  const styleMap = {
    error: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#b42318",
    },
    success: {
      background: "#ecfdf3",
      border: "1px solid #b7ebc6",
      color: "#027a48",
    },
    warning: {
      background: "#fffaeb",
      border: "1px solid #fedf89",
      color: "#b54708",
    },
    info: {
      background: "#eff8ff",
      border: "1px solid #b2ddff",
      color: "#175cd3",
    },
  };

  return (
    <div
      style={{
        ...styleMap[kind],
        padding: "12px 14px",
        borderRadius: 14,
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}

function disabledBtn(base) {
  return {
    ...base,
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  };
}

/* ------------------ styles ------------------ */

const page = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "18px 16px 28px",
  display: "grid",
  gap: 18,
};

const pageHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrow = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  color: "#94a3b8",
  marginBottom: 6,
};

const pageTitle = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  color: "#f8fafc",
  fontWeight: 900,
};

const pageSubtitle = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: 14,
  maxWidth: 720,
};

const headerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const stack = {
  display: "grid",
  gap: 10,
};

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 18,
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const cardTitle = {
  margin: 0,
  fontSize: 20,
  color: "#0f172a",
  fontWeight: 900,
};

const cardSubtitle = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#64748b",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr",
  gap: 14,
  alignItems: "start",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const fieldWide = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  position: "relative",
};

const labelStyle = {
  fontSize: 12,
  color: "#334155",
  fontWeight: 900,
  letterSpacing: 0.3,
};

const input = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const disabledInput = {
  ...input,
  background: "#f8fafc",
  color: "#64748b",
  cursor: "not-allowed",
};

const hintText = {
  fontSize: 12,
  color: "#64748b",
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

const actionBar = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const saveActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const btnPrimary = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.22)",
};

const btnSecondary = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const btnGhost = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const badgeBlue = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eff8ff",
  color: "#175cd3",
  border: "1px solid #b2ddff",
};