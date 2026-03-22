import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api/client";

const emptyLine = { item_code: "", qty: 1, rate: 0 };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function getStatusValue(inv) {
  return String(inv?.status || "").toUpperCase();
}

function normalizeInvoiceToForm(inv) {
  return {
    customerCode: inv?.customer_code || "",
    customerSearch: "",
    invoiceDate: inv?.invoice_date ? String(inv.invoice_date) : todayStr(),
    dueDate: inv?.due_date ? String(inv.due_date) : "",
    taxPercent: Number(inv?.tax_percent || 0),
    remark: inv?.remark || "",
    status: getStatusValue(inv),
    amountReceived: Number(inv?.amount_received || 0),
    lines:
      Array.isArray(inv?.lines) && inv.lines.length > 0
        ? inv.lines.map((ln) => ({
            item_code: ln.item_code || "",
            qty: Number(ln.qty || 0),
            rate: Number(ln.rate || 0),
          }))
        : [{ ...emptyLine }],
  };
}

function isPaidStatus(status) {
  return String(status || "").toUpperCase() === "PAID";
}

function isCancelledStatus(status) {
  return String(status || "").toUpperCase() === "CANCELLED";
}

function isPartialStatus(status) {
  return String(status || "").toUpperCase() === "PARTIAL";
}

function isPendingLikeStatus(status) {
  const s = String(status || "").toUpperCase();
  return s === "PENDING" || s === "OVERDUE";
}

function computeEditAccess({ isEditMode, invoiceStatus, amountReceived }) {
  if (!isEditMode) {
    return {
      pageMode: "NEW",
      readOnly: false,
      restricted: false,
      fullEdit: true,
      saveBlocked: false,
      reason: "",
    };
  }

  const hasReceipt = Number(amountReceived || 0) > 0;

  if (isCancelledStatus(invoiceStatus)) {
    return {
      pageMode: "VIEW_ONLY",
      readOnly: true,
      restricted: false,
      fullEdit: false,
      saveBlocked: true,
      reason: "Cancelled invoice cannot be edited.",
    };
  }

  if (isPaidStatus(invoiceStatus)) {
    return {
      pageMode: "VIEW_ONLY",
      readOnly: true,
      restricted: false,
      fullEdit: false,
      saveBlocked: true,
      reason: "Paid invoice cannot be edited.",
    };
  }

  if (isPartialStatus(invoiceStatus)) {
    return {
      pageMode: "RESTRICTED",
      readOnly: false,
      restricted: true,
      fullEdit: false,
      saveBlocked: false,
      reason: "Partial invoice allows restricted edit only. Only due date and remark can be changed.",
    };
  }

  if (isPendingLikeStatus(invoiceStatus) && !hasReceipt) {
    return {
      pageMode: "FULL",
      readOnly: false,
      restricted: false,
      fullEdit: true,
      saveBlocked: false,
      reason: "Full edit allowed.",
    };
  }

  if (isPendingLikeStatus(invoiceStatus) && hasReceipt) {
    return {
      pageMode: "RESTRICTED",
      readOnly: false,
      restricted: true,
      fullEdit: false,
      saveBlocked: false,
      reason: "Invoice has receipt entries. Only due date and remark can be changed.",
    };
  }

  return {
    pageMode: "VIEW_ONLY",
    readOnly: true,
    restricted: false,
    fullEdit: false,
    saveBlocked: true,
    reason: "This invoice cannot be edited.",
  };
}

export default function BillingNew() {
  const nav = useNavigate();
  const location = useLocation();
  const { invoiceNo } = useParams();

  const isEditMode = Boolean(invoiceNo);

  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  const [customerCode, setCustomerCode] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState("");
  const [taxPercent, setTaxPercent] = useState(0);
  const [remark, setRemark] = useState("");
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [amountReceived, setAmountReceived] = useState(0);

  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const routeEditMode = location.state?.editMode || "";
  const routeInvoiceStatus = location.state?.invoiceStatus || "";
  const routeHasReceipt = Boolean(location.state?.hasReceipt);

  useEffect(() => {
    (async () => {
      setErr("");
      setLoadingMasters(true);

      try {
        const [c, it] = await Promise.all([
          apiGet("/customers/"),
          apiGet("/items/"),
        ]);
        setCustomers(Array.isArray(c) ? c : []);
        setItems(Array.isArray(it) ? it : []);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoadingMasters(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEditMode) return;

    (async () => {
      setErr("");
      setOkMsg("");
      setLoadingInvoice(true);

      try {
        const inv = await apiGet(
          `/sales-invoices/${encodeURIComponent(invoiceNo)}`
        );
        const data = normalizeInvoiceToForm(inv);

        setCustomerCode(data.customerCode);
        setCustomerSearch(data.customerSearch);
        setInvoiceDate(data.invoiceDate);
        setDueDate(data.dueDate);
        setTaxPercent(data.taxPercent);
        setRemark(data.remark);
        setLines(data.lines);
        setInvoiceStatus(data.status);
        setAmountReceived(data.amountReceived);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoadingInvoice(false);
      }
    })();
  }, [invoiceNo, isEditMode]);

  const effectiveStatus = invoiceStatus || routeInvoiceStatus || "";
  const effectiveAmountReceived =
    Number.isFinite(Number(amountReceived)) && Number(amountReceived) > 0
      ? Number(amountReceived)
      : routeHasReceipt
      ? 1
      : 0;

  const access = useMemo(() => {
    const computed = computeEditAccess({
      isEditMode,
      invoiceStatus: effectiveStatus,
      amountReceived: effectiveAmountReceived,
    });

    if (!isEditMode) return computed;

    if (routeEditMode === "FULL") {
      return computed.pageMode === "VIEW_ONLY"
        ? computed
        : {
            ...computed,
            pageMode: "FULL",
            restricted: false,
            fullEdit: true,
            readOnly: false,
            saveBlocked: false,
          };
    }

    if (routeEditMode === "RESTRICTED") {
      return computed.pageMode === "VIEW_ONLY"
        ? computed
        : {
            ...computed,
            pageMode: "RESTRICTED",
            restricted: true,
            fullEdit: false,
            readOnly: false,
            saveBlocked: false,
          };
    }

    return computed;
  }, [isEditMode, effectiveStatus, effectiveAmountReceived, routeEditMode]);

  const pageLoading = loadingMasters || loadingInvoice;
  const disableRestrictedFields = saving || pageLoading || access.readOnly;
  const disableFullEditFields =
    saving || pageLoading || access.readOnly || access.restricted;

  const canChangeDueDateRemark = !disableRestrictedFields;
  const canEditLines = !disableFullEditFields;
  const canSave = !saving && !pageLoading && !access.saveBlocked;

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((c) => {
      return (
        String(c.customer_code || "").toLowerCase().includes(q) ||
        String(c.customer_name || "").toLowerCase().includes(q) ||
        String(c.customer_address_line1 || "").toLowerCase().includes(q) ||
        String(c.customer_address_line2 || "").toLowerCase().includes(q) ||
        String(c.customer_address_line3 || "").toLowerCase().includes(q) ||
        String(c.city || "").toLowerCase().includes(q) ||
        String(c.mobile_no || "").toLowerCase().includes(q) ||
        String(c.email_id || "").toLowerCase().includes(q) ||
        String(c.gst_no || "").toLowerCase().includes(q)
      );
    });
  }, [customers, customerSearch]);

  const itemMap = useMemo(() => {
    const m = new Map();
    items.forEach((x) => m.set(x.item_code, x));
    return m;
  }, [items]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.customer_code === customerCode) || null;
  }, [customers, customerCode]);

  function setLine(i, patch) {
    setLines((prev) =>
      prev.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln))
    );
  }

  function addRow() {
    if (!canEditLines) return;
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeRow(i) {
    if (!canEditLines) return;
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)
    );
  }

  const calc = useMemo(() => {
    const subtotal = lines.reduce((sum, ln) => {
      const qty = Number(ln.qty || 0);
      const rate = Number(ln.rate || 0);
      return sum + qty * rate;
    }, 0);

    const taxAmt = (subtotal * Number(taxPercent || 0)) / 100;
    const grand = subtotal + taxAmt;

    return {
      subtotal: round2(subtotal),
      taxAmt: round2(taxAmt),
      grand: round2(grand),
    };
  }, [lines, taxPercent]);

  function clearForm() {
    setCustomerCode("");
    setCustomerSearch("");
    setInvoiceDate(todayStr());
    setDueDate("");
    setTaxPercent(0);
    setRemark("");
    setLines([{ ...emptyLine }]);
    setInvoiceStatus("");
    setAmountReceived(0);
    setErr("");
  }

  function validateNewOrFull() {
    if (!customerCode) {
      setErr("Please select a Customer.");
      return null;
    }

    const cleanLines = lines
      .filter((l) => l.item_code)
      .map((l) => ({
        item_code: l.item_code,
        qty: Number(l.qty || 0),
        rate: Number(l.rate || 0),
      }));

    if (cleanLines.length === 0) {
      setErr("Add at least 1 item line.");
      return null;
    }

    for (let i = 0; i < cleanLines.length; i++) {
      const ln = cleanLines[i];

      if (Number(ln.qty) <= 0) {
        setErr(`Line ${i + 1}: Qty must be greater than 0.`);
        return null;
      }

      if (Number(ln.rate) < 0) {
        setErr(`Line ${i + 1}: Rate cannot be negative.`);
        return null;
      }
    }

    return {
      customer_code: customerCode,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      tax_percent: Number(taxPercent || 0),
      remark: remark || null,
      lines: cleanLines,
    };
  }

  function validateRestricted() {
    return {
      due_date: dueDate || null,
      remark: remark || null,
    };
  }

  async function save() {
    setErr("");
    setOkMsg("");

    if (!canSave) {
      setErr(access.reason || "This invoice cannot be edited.");
      return;
    }

    let payload = null;

    if (!isEditMode || access.fullEdit) {
      payload = validateNewOrFull();
    } else if (access.restricted) {
      payload = validateRestricted();
    }

    if (!payload) return;

    try {
      setSaving(true);

      if (isEditMode) {
        const updated = await apiPut(
          `/sales-invoices/${encodeURIComponent(invoiceNo)}`,
          payload
        );
        setOkMsg(
          `✅ Invoice "${updated?.invoice_no || invoiceNo}" updated successfully.`
        );

        if (updated?.status) {
          setInvoiceStatus(String(updated.status).toUpperCase());
        }
        if (updated?.amount_received != null) {
          setAmountReceived(Number(updated.amount_received || 0));
        }
      } else {
        const created = await apiPost("/sales-invoices/", payload);
        setOkMsg(`✅ Invoice "${created?.invoice_no || ""}" saved successfully.`);
        clearForm();
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  function getPageTitle() {
    if (!isEditMode) return "Sales Invoice";
    if (access.readOnly) return "Sales Invoice Details";
    if (access.restricted) return "Sales Invoice Edit";
    return "Sales Invoice Edit";
  }

  function getPageSubtitle() {
    if (!isEditMode) {
      return "Create a new sales invoice using customer and item master records.";
    }
    if (access.readOnly) {
      return `Invoice ${invoiceNo} is locked for editing.`;
    }
    if (access.restricted) {
      return `Restricted edit for invoice ${invoiceNo}. Only due date and remark can be changed.`;
    }
    return `Update invoice ${invoiceNo} and recalculate totals automatically.`;
  }

  function getModeBadge() {
    if (!isEditMode) return <span style={badgeBlue}>NEW</span>;
    if (access.readOnly) return <span style={badgeGray}>LOCKED</span>;
    if (access.restricted) return <span style={badgeAmber}>RESTRICTED</span>;
    return <span style={badgeGreen}>EDITABLE</span>;
  }

  return (
    <div style={page}>
      <div style={pageHeader}>
        <div>
          <div style={eyebrow}>BILLING</div>
          <h1 style={pageTitle}>{getPageTitle()}</h1>
          <p style={pageSubtitle}>{getPageSubtitle()}</p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={() => nav("/sales-invoices")}
            style={btnSecondary}
            disabled={saving || pageLoading}
          >
            Back to Invoices
          </button>

          {isEditMode ? (
            <button
              type="button"
              onClick={() =>
                nav(`/sales-invoice-view/${encodeURIComponent(invoiceNo)}`)
              }
              style={btnGhost}
              disabled={saving || pageLoading}
            >
              View Invoice
            </button>
          ) : null}
        </div>
      </div>

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {okMsg ? <AlertBox kind="success" message={okMsg} /> : null}
        {pageLoading ? <AlertBox kind="info" message="Loading data..." /> : null}
        {isEditMode && access.reason ? (
          <AlertBox kind="warning" message={access.reason} />
        ) : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Invoice Header</h2>
            <p style={cardSubtitle}>
              Basic invoice information, customer selection, and billing dates.
            </p>
          </div>
          <div>{getModeBadge()}</div>
        </div>

        <div style={formGrid}>
          <AutoField
            label="Invoice No"
            text={isEditMode ? invoiceNo : "Auto-generated on save"}
            hint={
              isEditMode
                ? "Invoice number cannot be changed."
                : "The next invoice number will be generated automatically."
            }
          />

          <CustomerSelect
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customerCode={customerCode}
            setCustomerCode={setCustomerCode}
            customers={filteredCustomers}
            disabled={disableFullEditFields}
          />

          <Field
            label="Invoice Date"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            disabled={disableFullEditFields}
          />

          <Field
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={!canChangeDueDateRemark}
          />

          <Field
            label="Tax %"
            type="number"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
            placeholder="0"
            disabled={disableFullEditFields}
          />

          <Field
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional note"
            disabled={!canChangeDueDateRemark}
          />
        </div>

        {selectedCustomer ? (
          <div style={{ marginTop: 18 }}>
            <div style={subSectionCard}>
              <div style={subSectionHeader}>
                <h3 style={subSectionTitle}>Selected Customer</h3>
              </div>

              <div style={infoGrid}>
                <InfoMini label="Code" value={selectedCustomer.customer_code || "-"} />
                <InfoMini label="Name" value={selectedCustomer.customer_name || "-"} />
                <InfoMini label="City" value={selectedCustomer.city || "-"} />
                <InfoMini label="Mobile" value={selectedCustomer.mobile_no || "-"} />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Line Items</h2>
            <p style={cardSubtitle}>
              Add invoice rows, quantities, prices, and review totals.
            </p>
          </div>

          <button
            type="button"
            onClick={addRow}
            style={canEditLines ? btnPrimary : disabledBtn(btnPrimary)}
            disabled={!canEditLines}
          >
            + Add Row
          </button>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Item</th>
                <th style={th}>Qty</th>
                <th style={th}>Rate</th>
                <th style={th}>Line Total</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, i) => {
                const qty = Number(ln.qty || 0);
                const rate = Number(ln.rate || 0);
                const lineTotal = round2(qty * rate);

                return (
                  <tr key={i} style={tr}>
                    <td style={td}>
                      <select
                        value={ln.item_code}
                        onChange={(e) => {
                          const code = e.target.value;
                          const it = itemMap.get(code);
                          setLine(i, {
                            item_code: code,
                            rate: it ? Number(it.selling_price || 0) : 0,
                          });
                        }}
                        style={canEditLines ? input : disabledInput}
                        disabled={!canEditLines}
                      >
                        <option value="">-- Select Item --</option>
                        {items.map((it) => (
                          <option key={it.item_code} value={it.item_code}>
                            {it.item_code} - {it.item_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={tdSmall}>
                      <input
                        type="number"
                        value={ln.qty}
                        onChange={(e) => setLine(i, { qty: e.target.value })}
                        style={canEditLines ? input : disabledInput}
                        disabled={!canEditLines}
                      />
                    </td>

                    <td style={tdSmall}>
                      <input
                        type="number"
                        value={ln.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        style={canEditLines ? input : disabledInput}
                        disabled={!canEditLines}
                      />
                    </td>

                    <td style={tdAmount}>{lineTotal}</td>

                    <td style={tdAction}>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        style={canEditLines ? btnDanger : disabledBtn(btnDanger)}
                        disabled={!canEditLines}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}

              {lines.length === 0 ? (
                <tr>
                  <td colSpan="5" style={emptyTd}>
                    No line items added.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={footerGrid}>
          <div style={noteBox}>
            {!isEditMode
              ? "Save to create the invoice and generate the invoice number automatically."
              : access.readOnly
              ? "This invoice is locked. Editing is not allowed."
              : access.restricted
              ? "Restricted edit mode is active. Only due date and remark can be updated."
              : "Full edit mode is active. Totals will be recalculated when you save."}
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Invoice Summary</div>
            <Row label="Subtotal" value={calc.subtotal} />
            <Row label="Tax Amount" value={calc.taxAmt} />
            <Row label="Grand Total" value={calc.grand} bold />
          </div>
        </div>

        <div style={actionBar}>
          <div style={saveActions}>
            {!isEditMode ? (
              <button
                type="button"
                onClick={clearForm}
                style={btnSecondary}
                disabled={saving || pageLoading}
              >
                Clear
              </button>
            ) : null}

            <button
              type="button"
              onClick={save}
              style={canSave ? btnPrimary : disabledBtn(btnPrimary)}
              disabled={!canSave}
            >
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Saving..."
                : isEditMode
                ? access.restricted
                  ? "Update Allowed Fields"
                  : "Update Invoice"
                : "Save Invoice"}
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
    </div>
  );
}

function AutoField({ label, text, hint }) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <div style={autoBox}>{text}</div>
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}

function CustomerSelect({
  customerSearch,
  setCustomerSearch,
  customerCode,
  setCustomerCode,
  customers,
  disabled = false,
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>Customer</label>

      <input
        type="text"
        value={customerSearch}
        onChange={(e) => setCustomerSearch(e.target.value)}
        placeholder="Search by code, name, city, mobile"
        style={disabled ? disabledInput : input}
        disabled={disabled}
      />

      <select
        value={customerCode}
        onChange={(e) => setCustomerCode(e.target.value)}
        style={disabled ? disabledInput : input}
        disabled={disabled}
      >
        <option value="">-- Select Customer --</option>
        {customers.map((c) => (
          <option key={c.customer_code} value={c.customer_code}>
            {c.customer_code} - {c.customer_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Row({ label, value, bold }) {
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
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
  alignItems: "end",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
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

const autoBox = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 800,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
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

const tableWrap = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
  background: "#ffffff",
};

const th = {
  textAlign: "left",
  padding: "14px 14px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  borderBottom: "1px solid #e2e8f0",
};

const tr = {
  borderBottom: "1px solid #eef2f7",
};

const td = {
  padding: 12,
  verticalAlign: "middle",
};

const tdSmall = {
  padding: 12,
  verticalAlign: "middle",
  width: 140,
};

const tdAmount = {
  padding: 12,
  verticalAlign: "middle",
  fontWeight: 900,
  color: "#0f172a",
  minWidth: 120,
};

const tdAction = {
  padding: 12,
  verticalAlign: "middle",
  minWidth: 120,
};

const emptyTd = {
  padding: 18,
  textAlign: "center",
  color: "#64748b",
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

const btnDanger = {
  minHeight: 38,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #fda4af",
  background: "#fff1f2",
  color: "#b42318",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
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

const badgeGray = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#f2f4f7",
  color: "#475467",
  border: "1px solid #d0d5dd",
};

const badgeAmber = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#fffaeb",
  color: "#b54708",
  border: "1px solid #fedf89",
};

const badgeGreen = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#ecfdf3",
  color: "#027a48",
  border: "1px solid #abefc6",
};