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
        const [c, it] = await Promise.all([apiGet("/customers/"), apiGet("/items/")]);
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
        const inv = await apiGet(`/sales-invoices/${encodeURIComponent(invoiceNo)}`);
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
        : { ...computed, pageMode: "FULL", restricted: false, fullEdit: true, readOnly: false, saveBlocked: false };
    }

    if (routeEditMode === "RESTRICTED") {
      return computed.pageMode === "VIEW_ONLY"
        ? computed
        : { ...computed, pageMode: "RESTRICTED", restricted: true, fullEdit: false, readOnly: false, saveBlocked: false };
    }

    return computed;
  }, [isEditMode, effectiveStatus, effectiveAmountReceived, routeEditMode]);

  const pageLoading = loadingMasters || loadingInvoice;
  const disableAll = saving || pageLoading || access.readOnly;
  const disableRestrictedFields = saving || pageLoading || access.readOnly;
  const disableFullEditFields = saving || pageLoading || access.readOnly || access.restricted;
  const canChangeHeaderCore = !disableFullEditFields;
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
    setLines((prev) => prev.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln)));
  }

  function addRow() {
    if (!canEditLines) return;
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeRow(i) {
    if (!canEditLines) return;
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
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
        const updated = await apiPut(`/sales-invoices/${encodeURIComponent(invoiceNo)}`, payload);
        setOkMsg(`✅ Invoice "${updated?.invoice_no || invoiceNo}" updated successfully.`);

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
    if (!isEditMode) return "Create New Bill (Sales Invoice)";
    if (access.readOnly) return "View Sales Invoice (Locked)";
    if (access.restricted) return "Edit Sales Invoice (Restricted)";
    return "Edit Sales Invoice";
  }

  function getPageSubtitle() {
    if (!isEditMode) return "Select customer + items from masters and save invoice.";
    if (access.readOnly) return `Invoice ${invoiceNo} is locked for editing. ${access.reason}`;
    if (access.restricted) return `Restricted edit for invoice ${invoiceNo}. Only due date and remark can be changed.`;
    return `Update invoice ${invoiceNo}.`;
  }

  function getModeBadge() {
    if (!isEditMode) {
      return <div style={modeBadgeBlue}>NEW INVOICE</div>;
    }

    if (access.readOnly) {
      return <div style={modeBadgeLocked}>VIEW ONLY</div>;
    }

    if (access.restricted) {
      return <div style={modeBadgeWarning}>RESTRICTED EDIT</div>;
    }

    return <div style={modeBadge}>FULL EDIT</div>;
  }

  return (
    <div style={page}>
      <div style={headerWrap}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>{getPageTitle()}</h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>{getPageSubtitle()}</p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={() => nav("/sales-invoices")}
            style={btnGhost}
            disabled={saving || pageLoading}
          >
            Back to Invoices
          </button>

          {isEditMode ? (
            <button
              type="button"
              onClick={() => nav(`/sales-invoice-view/${encodeURIComponent(invoiceNo)}`)}
              style={btnGhost}
              disabled={saving || pageLoading}
            >
              View Invoice
            </button>
          ) : null}
        </div>
      </div>

      {err && box(err, "#ffecec", "#a40000")}
      {okMsg && box(okMsg, "#eaffea", "#0a6a0a")}
      {pageLoading && box("Loading data...", "#eef4ff", "#0b5cff")}
      {isEditMode && access.reason ? box(access.reason, "#fff8e8", "#8a5a00") : null}

      <div style={card}>
        <div style={sectionHeader}>
          <h3 style={{ marginTop: 0, marginBottom: 0, color: "#111" }}>Invoice Header</h3>
          {getModeBadge()}
        </div>

        <div style={formGrid}>
          <AutoField
            label="Invoice No"
            text={isEditMode ? invoiceNo : "Auto-generated on save"}
            hint={
              isEditMode
                ? "Invoice number cannot be changed."
                : "The system will generate the next invoice number automatically."
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
            placeholder="Optional note..."
            disabled={!canChangeDueDateRemark}
          />
        </div>

        {selectedCustomer ? (
          <div style={{ marginTop: 14 }}>
            <div style={customerInfoCard}>
              <div style={customerInfoTitle}>Selected Customer</div>
              <div style={customerInfoGrid}>
                <InfoMini label="Code" value={selectedCustomer.customer_code || "-"} />
                <InfoMini label="Name" value={selectedCustomer.customer_name || "-"} />
                <InfoMini label="City" value={selectedCustomer.city || "-"} />
                <InfoMini label="Mobile" value={selectedCustomer.mobile_no || "-"} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={toolbarWrap}>
          <h3 style={{ margin: 0, color: "#111" }}>Line Items</h3>
          <button
            type="button"
            onClick={addRow}
            style={canEditLines ? btnPrimary : disabledBtn(btnPrimary)}
            disabled={!canEditLines}
          >
            + Add Row
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f6f7f9" }}>
                <th align="left">Item</th>
                <th align="left">Qty</th>
                <th align="left">Rate</th>
                <th align="left">Line Total</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, i) => {
                const qty = Number(ln.qty || 0);
                const rate = Number(ln.rate || 0);
                const lineTotal = round2(qty * rate);

                return (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td>
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
                        style={input}
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

                    <td>
                      <input
                        type="number"
                        value={ln.qty}
                        onChange={(e) => setLine(i, { qty: e.target.value })}
                        style={input}
                        disabled={!canEditLines}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={ln.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        style={input}
                        disabled={!canEditLines}
                      />
                    </td>

                    <td style={{ color: "#111", fontWeight: 800 }}>{lineTotal}</td>

                    <td>
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
                  <td colSpan="5" style={{ padding: 14, color: "#666" }}>
                    No line items.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ height: 12 }} />

        <div style={totalsRow}>
          <div style={totalsBox}>
            <Row label="Subtotal" value={calc.subtotal} />
            <Row label="Tax Amount" value={calc.taxAmt} />
            <Row label="Grand Total" value={calc.grand} bold />
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div style={toolbarWrap}>
          <div style={{ color: "#666", fontSize: 13 }}>
            {!isEditMode
              ? "Save to generate invoice number automatically."
              : access.readOnly
              ? "This invoice is locked. Editing is not allowed."
              : access.restricted
              ? "Restricted edit mode: only due date and remark can be updated."
              : "Update the invoice carefully. Existing totals will be recalculated."}
          </div>

          <div style={saveActions}>
            {!isEditMode ? (
              <button
                type="button"
                onClick={clearForm}
                style={btnGhost}
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
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, disabled = false }) {
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
        placeholder="Search customer by code, name, city, mobile..."
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
        color: "#111",
        fontWeight: bold ? 900 : 600,
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

function box(msg, bg, color) {
  return (
    <div
      style={{
        background: bg,
        border: "1px solid #ddd",
        padding: 10,
        borderRadius: 12,
        color,
        marginBottom: 12,
      }}
    >
      {msg}
    </div>
  );
}

function disabledBtn(base) {
  return {
    ...base,
    opacity: 0.5,
    cursor: "not-allowed",
  };
}

/* ---- styles ---- */

const page = { maxWidth: 1100, margin: "0 auto", padding: 14 };

const headerWrap = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const headerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  alignItems: "end",
};

const toolbarWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
  justifyContent: "space-between",
};

const field = { display: "flex", flexDirection: "column", gap: 6 };

const labelStyle = { fontSize: 13, color: "#222", fontWeight: 800 };

const input = {
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  background: "#fff",
  color: "#111",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const disabledInput = {
  ...input,
  background: "#f5f5f5",
  color: "#666",
  cursor: "not-allowed",
};

const autoBox = {
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  background: "#f7f7f7",
  color: "#555",
  fontWeight: 700,
  width: "100%",
  boxSizing: "border-box",
};

const hintText = {
  fontSize: 12,
  color: "#666",
  marginTop: 2,
};

const totalsRow = { display: "flex", justifyContent: "flex-end" };

const totalsBox = {
  width: "min(420px, 100%)",
  display: "grid",
  gap: 8,
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const saveActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
};

const btnDanger = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ff9a9a",
  background: "#ffecec",
  color: "#a40000",
  cursor: "pointer",
  fontWeight: 800,
};

const modeBadge = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eef4ff",
  color: "#0b5cff",
  border: "1px solid #b7cbff",
};

const modeBadgeBlue = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eef4ff",
  color: "#0b5cff",
  border: "1px solid #b7cbff",
};

const modeBadgeWarning = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#fff8e8",
  color: "#8a5a00",
  border: "1px solid #edd28a",
};

const modeBadgeLocked = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#f0f0f0",
  color: "#555",
  border: "1px solid #d5d5d5",
};

const customerInfoCard = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const customerInfoTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111",
  marginBottom: 10,
};

const customerInfoGrid = {
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