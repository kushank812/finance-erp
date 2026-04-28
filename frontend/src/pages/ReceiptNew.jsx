import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField } from "../components/ui/FormField";
import { formatDateForDisplay } from "../utils/date";
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

function formatDate(value) {
  return formatDateForDisplay(value) || "-";
}

function sortInvoices(rows) {
  return [...rows].sort((a, b) => {
    const dateA = String(a?.invoice_date || "");
    const dateB = String(b?.invoice_date || "");
    if (dateB !== dateA) return dateB.localeCompare(dateA);

    return String(b?.invoice_no || "").localeCompare(
      String(a?.invoice_no || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    );
  });
}

export default function ReceiptNew() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceList, setShowInvoiceList] = useState(false);

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
      const data = await apiGet("/sales-invoices/");
      const allRows = Array.isArray(data) ? data : [];

      const selectableInvoices = allRows.filter(
        (r) => String(r.status || "").toUpperCase() !== "CANCELLED"
      );

      setRows(sortInvoices(selectableInvoices));

      if (
        invoiceNo &&
        !selectableInvoices.some((r) => r.invoice_no === invoiceNo)
      ) {
        setInvoiceNo("");
        setInvoiceSearch("");
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
        setShowInvoiceList(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selected = useMemo(
    () => rows.find((r) => r.invoice_no === invoiceNo),
    [rows, invoiceNo]
  );

  const selectedBalance = useMemo(
    () => Number(selected?.balance || 0),
    [selected]
  );

  const amountNumber = Number(amount || 0);
  const excessAmount =
    selected && Number.isFinite(amountNumber) && amountNumber > selectedBalance
      ? amountNumber - selectedBalance
      : 0;

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toUpperCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const invoice = String(r.invoice_no || "").toUpperCase();
      const customer = String(r.customer_code || "").toUpperCase();
      const total = String(r.grand_total || "");
      const balance = String(r.balance || "");
      const invoiceDate = String(r.invoice_date || "").toUpperCase();
      const dueDate = String(r.due_date || "").toUpperCase();
      const status = String(r.status || "").toUpperCase();

      return (
        invoice.includes(q) ||
        customer.includes(q) ||
        total.includes(q) ||
        balance.includes(q) ||
        invoiceDate.includes(q) ||
        dueDate.includes(q) ||
        status.includes(q)
      );
    });
  }, [rows, invoiceSearch]);

  function selectInvoice(row) {
    setInvoiceNo(row.invoice_no);
    setInvoiceSearch(
      `${row.invoice_no} | ${row.customer_code || "-"} | BAL ${money(
        row.balance
      )}`
    );
    setShowInvoiceList(false);
  }

  function clearForm() {
    setInvoiceNo("");
    setInvoiceSearch("");
    setAmount("");
    setRemark("");
    setErr("");
    setOk("");
    setShowInvoiceList(false);
  }

  async function save() {
    setErr("");
    setOk("");

    if (!invoiceNo) {
      setErr("Select an invoice.");
      return;
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Enter a valid received amount (> 0).");
      return;
    }

    try {
      setSaving(true);

      const saved = await apiPost(
        `/sales-invoices/${encodeURIComponent(invoiceNo)}/receive`,
        {
          amount: amt,
          remark: remark || null,
        }
      );

      const receiptNo = saved?.receipt_no || "";
      const savedInvoiceNo = saved?.invoice_no || invoiceNo;
      const autoJvNo = saved?.auto_jv_no || "";
      const excess = Number(saved?.excess_amount || 0);

      setOk(
        receiptNo
          ? `Receipt ${receiptNo} saved successfully for invoice ${savedInvoiceNo}.${
              excess > 0
                ? ` Excess amount ${money(excess)} recorded through JV ${
                    autoJvNo || "-"
                  }.`
                : ""
            }`
          : `Receipt saved successfully for invoice ${savedInvoiceNo}.`
      );

      setAmount("");
      setRemark("");
      await load();

      if (receiptNo) {
        navigate(`/receipt/view/${encodeURIComponent(receiptNo)}`);
      } else {
        setErr("Receipt was saved, but receipt number was not returned from backend.");
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="RECEIPTS"
        title="Create Receipt"
        subtitle="Record customer receipt. Extra amount is allowed and will be treated as excess / credit by backend."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/receipts")}
              style={btnSecondary}
              disabled={loading || saving}
            >
              View Receipts
            </button>

            <button
              type="button"
              onClick={load}
              style={btnGhost}
              disabled={loading || saving}
            >
              Refresh
            </button>
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {ok ? <AlertBox kind="success" message={ok} /> : null}
        {loading ? <AlertBox kind="info" message="Loading invoices..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Receipt Details</h2>
            <p style={cardSubtitle}>
              Select an invoice, enter the received amount, and save the receipt.
              If the received amount is higher than the current balance, the
              excess is treated as credit.
            </p>
          </div>
          <div style={badgeBlue}>NEW</div>
        </div>

        <div style={receiptGrid}>
          <div style={fieldWide} ref={pickerRef}>
            <label style={labelStyle}>Invoice Search</label>

            <input
              value={invoiceSearch}
              onChange={(e) => {
                setInvoiceSearch(e.target.value);
                setShowInvoiceList(true);
                if (!e.target.value.trim()) {
                  setInvoiceNo("");
                }
              }}
              onFocus={() => setShowInvoiceList(true)}
              placeholder="Search by invoice no, customer, total, balance, status"
              style={input}
              disabled={loading || saving}
            />

            {showInvoiceList && (
              <div style={dropdown}>
                <div style={dropdownHead}>
                  {filteredInvoices.length} invoice
                  {filteredInvoices.length === 1 ? "" : "s"} found
                </div>

                <div style={dropdownList}>
                  {filteredInvoices.length === 0 ? (
                    <div style={emptyRow}>No matching invoices found.</div>
                  ) : (
                    filteredInvoices.map((r) => {
                      const active = r.invoice_no === invoiceNo;
                      return (
                        <button
                          key={r.invoice_no}
                          type="button"
                          onClick={() => selectInvoice(r)}
                          style={{
                            ...dropdownItem,
                            ...(active ? dropdownItemActive : {}),
                          }}
                        >
                          <div style={dropdownTitle}>{r.invoice_no}</div>
                          <div style={dropdownSub}>
                            Customer: {r.customer_code || "-"} | Status:{" "}
                            {r.status || "-"}
                          </div>
                          <div style={dropdownSub}>
                            Invoice Date: {formatDate(r.invoice_date)} | Due Date:{" "}
                            {formatDate(r.due_date)}
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
          </div>

          <FormField
            label="Amount Received Now"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={loading || saving}
            hint={
              selected
                ? excessAmount > 0
                  ? `Balance: ${money(selectedBalance)} | Excess/Credit: ${money(
                      excessAmount
                    )}`
                  : `Current balance: ${money(selectedBalance)}`
                : ""
            }
          />

          <FormField
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional note"
            disabled={loading || saving}
          />
        </div>

        <div style={subSectionCard}>
          <div style={subSectionHeader}>
            <h3 style={subSectionTitle}>Selected Invoice Summary</h3>
          </div>

          <div style={infoGrid}>
            <InfoMini label="Selected Invoice" value={selected?.invoice_no || "-"} />
            <InfoMini label="Customer" value={selected?.customer_code || "-"} />
            <InfoMini label="Status" value={selected?.status || "-"} />
            <InfoMini
              label="Invoice Date"
              value={selected?.invoice_date ? formatDate(selected.invoice_date) : "-"}
            />
            <InfoMini
              label="Due Date"
              value={selected?.due_date ? formatDate(selected.due_date) : "-"}
            />
            <InfoMini
              label="Invoice Total"
              value={selected ? money(selected.grand_total) : "-"}
            />
            <InfoMini
              label="Current Balance"
              value={selected ? money(selected.balance) : "-"}
            />
            <InfoMini
              label="Excess / Credit"
              value={excessAmount > 0 ? money(excessAmount) : "0.00"}
            />
          </div>
        </div>

        <div style={footerGrid}>
          <div style={noteBox}>
            Save the receipt only after verifying the selected invoice and
            received amount. If the received amount is higher than the invoice
            balance, the backend will record the extra amount as excess /
            customer credit through JV handling.
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Receipt Summary</div>
            <SummaryRow label="Invoice No" value={selected?.invoice_no || "-"} />
            <SummaryRow
              label="Invoice Date"
              value={selected?.invoice_date ? formatDate(selected.invoice_date) : "-"}
            />
            <SummaryRow
              label="Open Balance"
              value={selected ? money(selectedBalance) : "-"}
            />
            <SummaryRow
              label="Excess / Credit"
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
              onClick={clearForm}
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
              {saving ? "Saving..." : "Save Receipt"}
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

const receiptGrid = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr",
  gap: 14,
  alignItems: "start",
};

const fieldWide = {
  ...field,
  position: "relative",
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