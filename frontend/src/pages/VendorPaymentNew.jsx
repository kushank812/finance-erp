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

function sortBills(rows) {
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

      const selectableBills = allBills.filter(
        (r) => String(r.status || "").toUpperCase() !== "CANCELLED"
      );

      setBills(sortBills(selectableBills));
      setVendors(allVendors);

      if (billNo && !selectableBills.some((r) => r.bill_no === billNo)) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const billDate = String(r.bill_date || "").toUpperCase();
      const status = String(r.status || "").toUpperCase();

      return (
        bill.includes(q) ||
        vendorCode.includes(q) ||
        vendorName.includes(q) ||
        total.includes(q) ||
        balance.includes(q) ||
        billDate.includes(q) ||
        status.includes(q)
      );
    });
  }, [bills, billSearch, vendorNameByCode]);

  const selected = useMemo(
    () => bills.find((r) => r.bill_no === billNo),
    [bills, billNo]
  );

  const currentBalance = selected ? num(selected.balance) : 0;
  const amountNumber = num(amount);
  const excessAmount =
    selected && amountNumber > currentBalance ? amountNumber - currentBalance : 0;

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

      const excess = num(res?.excess_amount);
      const autoJvNo = res?.auto_jv_no || "";

      setOk(
        `Payment saved successfully. Payment No: ${res.payment_no}${
          excess > 0
            ? `. Excess amount ${money(excess)} recorded through JV ${
                autoJvNo || "-"
              }.`
            : "."
        }`
      );

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
      <PageHeaderBlock
        eyebrowText="VENDOR PAYMENTS"
        title="Create Vendor Payment"
        subtitle="Record vendor payment. Extra amount is allowed and will be treated as vendor advance / excess payment by backend."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/vendor-payments")}
              style={btnSecondary}
              disabled={loading || saving}
            >
              View Payments
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
        {loading ? <AlertBox kind="info" message="Loading purchase bills..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Payment Details</h2>
            <p style={cardSubtitle}>
              Select a purchase bill, enter the paid amount, and save the
              payment. If payment is higher than current balance, the extra
              amount is treated as vendor advance.
            </p>
          </div>
          <div style={badgeBlue}>NEW</div>
        </div>

        <div style={paymentGrid}>
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
              placeholder="Search by bill no, vendor, total, balance, status"
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
                    <div style={emptyRow}>No matching purchase bills found.</div>
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
                            Vendor: {vendorName || r.vendor_code} | Status:{" "}
                            {r.status || "-"}
                          </div>
                          <div style={dropdownSub}>
                            Bill Date: {r.bill_date ? formatDate(r.bill_date) : "-"}
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
              Cancelled bills are hidden. Extra payment is allowed and recorded
              as vendor advance / excess payment.
            </div>
          </div>

          <FormField
            label="Amount Paid Now"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={loading || saving}
            hint={
              selected
                ? excessAmount > 0
                  ? `Balance: ${money(currentBalance)} | Excess/Advance: ${money(
                      excessAmount
                    )}`
                  : `Current balance: ${money(currentBalance)}`
                : ""
            }
          />

          <FormField
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
            <InfoMini label="Selected Bill" value={selected?.bill_no || "-"} />
            <InfoMini
              label="Vendor"
              value={
                selected
                  ? vendorNameByCode.get(selected.vendor_code) || selected.vendor_code
                  : "-"
              }
            />
            <InfoMini label="Status" value={selected?.status || "-"} />
            <InfoMini
              label="Bill Date"
              value={selected?.bill_date ? formatDate(selected.bill_date) : "-"}
            />
            <InfoMini
              label="Bill Total"
              value={selected ? money(selected.grand_total) : "-"}
            />
            <InfoMini
              label="Current Balance"
              value={selected ? money(selected.balance) : "-"}
            />
            <InfoMini
              label="Excess / Advance"
              value={excessAmount > 0 ? money(excessAmount) : "0.00"}
            />
          </div>
        </div>

        <div style={footerGrid}>
          <div style={noteBox}>
            Save the vendor payment only after verifying the selected purchase
            bill and paid amount. If the payment is higher than the bill balance,
            the backend will record the extra amount as vendor advance / excess
            payment through JV handling.
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Payment Summary</div>
            <SummaryRow label="Bill No" value={selected?.bill_no || "-"} />
            <SummaryRow
              label="Bill Date"
              value={selected?.bill_date ? formatDate(selected.bill_date) : "-"}
            />
            <SummaryRow
              label="Open Balance"
              value={selected ? money(currentBalance) : "-"}
            />
            <SummaryRow
              label="Excess / Advance"
              value={excessAmount > 0 ? money(excessAmount) : "0.00"}
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
              style={btnPrimary}
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

const paymentGrid = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr",
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