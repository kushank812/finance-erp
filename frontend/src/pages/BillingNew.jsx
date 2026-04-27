import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField, AutoField } from "../components/ui/FormField";
import AppDateInput from "../components/ui/AppDateInput";
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
  disabledInput,
  tableWrap,
  table,
  th,
  tr,
  td,
  actionBar,
  saveActions,
  btnPrimary,
  btnSecondary,
  btnGhost,
  badgeBlue,
  badgeGray,
  badgeAmber,
  badgeGreen,
  disabledBtn,
} from "../components/ui/uiStyles";

const emptyLine = { item_code: "", qty: 1, rate: 0 };

const TEMPLATE_OPTIONS = [
  {
    value: "STANDARD",
    label: "Standard Sales Invoice",
    hint: "Simple item-wise invoice for regular billing.",
  },
  {
    value: "TAX_INVOICE",
    label: "Tax Invoice",
    hint: "Business-style tax invoice layout with tax emphasis.",
  },
  {
    value: "SERVICE_INVOICE",
    label: "Service / Work Invoice",
    hint: "Best for service, labour, hours, project, or work billing.",
  },
];

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isValidISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const [yyyy, mm, dd] = String(iso).split("-").map(Number);
  const dt = new Date(yyyy, mm - 1, dd);
  return (
    dt.getFullYear() === yyyy &&
    dt.getMonth() === mm - 1 &&
    dt.getDate() === dd
  );
}

function round2(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function getStatusValue(inv) {
  return String(inv?.status || "").toUpperCase();
}

function getTemplateValue(value) {
  const v = String(value || "STANDARD").toUpperCase();
  return TEMPLATE_OPTIONS.some((x) => x.value === v) ? v : "STANDARD";
}

function getTemplateLabel(value) {
  const t = TEMPLATE_OPTIONS.find((x) => x.value === getTemplateValue(value));
  return t?.label || "Standard Sales Invoice";
}

function getTemplateHint(value) {
  const t = TEMPLATE_OPTIONS.find((x) => x.value === getTemplateValue(value));
  return t?.hint || "";
}

function normalizeInvoiceToForm(inv) {
  return {
    invoiceTemplate: getTemplateValue(inv?.invoice_template),
    customerCode: inv?.customer_code || "",
    customerSearch: "",
    invoiceDate: inv?.invoice_date ? String(inv.invoice_date) : todayISO(),
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
      reason:
        "Partial invoice allows restricted edit only. Only due date and remark can be changed.",
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
      reason:
        "Invoice has receipt entries. Only due date and remark can be changed.",
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

  const [invoiceTemplate, setInvoiceTemplate] = useState("STANDARD");
  const [customerCode, setCustomerCode] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
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

        setInvoiceTemplate(data.invoiceTemplate);
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
    setInvoiceTemplate("STANDARD");
    setCustomerCode("");
    setCustomerSearch("");
    setInvoiceDate(todayISO());
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

    if (!invoiceDate || !isValidISODate(invoiceDate)) {
      setErr("Invoice Date is invalid.");
      return null;
    }

    if (dueDate && !isValidISODate(dueDate)) {
      setErr("Due Date is invalid.");
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
      invoice_template: invoiceTemplate,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      tax_percent: Number(taxPercent || 0),
      remark: remark || null,
      lines: cleanLines,
    };
  }

  function validateRestricted() {
    if (dueDate && !isValidISODate(dueDate)) {
      setErr("Due Date is invalid.");
      return null;
    }

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

        if (updated?.invoice_template) {
          setInvoiceTemplate(getTemplateValue(updated.invoice_template));
        }
        if (updated?.status) {
          setInvoiceStatus(String(updated.status).toUpperCase());
        }
        if (updated?.amount_received != null) {
          setAmountReceived(Number(updated.amount_received || 0));
        }

        if (updated?.invoice_date) {
          setInvoiceDate(String(updated.invoice_date));
        }
        setDueDate(updated?.due_date ? String(updated.due_date) : "");
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

  const qtyHeader =
    invoiceTemplate === "SERVICE_INVOICE" ? "Hours / Days" : "Qty";
  const itemHeader =
    invoiceTemplate === "SERVICE_INVOICE"
      ? "Service / Work"
      : invoiceTemplate === "TAX_INVOICE"
      ? "Product / Description"
      : "Item";
  const rateHeader =
    invoiceTemplate === "SERVICE_INVOICE" ? "Rate" : "Rate";
  const totalHeader =
    invoiceTemplate === "SERVICE_INVOICE" ? "Service Amount" : "Line Total";

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="BILLING"
        title={getPageTitle()}
        subtitle={getPageSubtitle()}
        actions={
          <>
            <button
              type="button"
              onClick={() => nav("/sales-invoices")}
              style={btnSecondary}
              disabled={saving || pageLoading}
            >
              View Invoices
            </button>

            {!isEditMode ? (
              <button
                type="button"
                onClick={() => nav("/billing")}
                style={btnGhost}
                disabled={saving || pageLoading}
              >
                Refresh Form
              </button>
            ) : (
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
            )}
          </>
        }
      />

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
              Basic invoice information, template selection, customer selection,
              and billing dates.
            </p>
          </div>
          <div>{getModeBadge()}</div>
        </div>

        <div style={billingFormGrid}>
          <AutoField
            label="Invoice No"
            text={isEditMode ? invoiceNo : "Auto-generated on save"}
            hint={
              isEditMode
                ? "Invoice number cannot be changed."
                : "The next invoice number will be generated automatically."
            }
          />

          <div style={field}>
            <label style={labelStyle}>Invoice Template</label>
            <select
              value={invoiceTemplate}
              onChange={(e) => setInvoiceTemplate(e.target.value)}
              style={disableFullEditFields ? disabledInput : input}
              disabled={disableFullEditFields}
            >
              {TEMPLATE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div style={templateHint}>{getTemplateHint(invoiceTemplate)}</div>
          </div>

          <CustomerSelect
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customerCode={customerCode}
            setCustomerCode={setCustomerCode}
            customers={filteredCustomers}
            disabled={disableFullEditFields}
          />

          <div style={field}>
            <label style={labelStyle}>Invoice Date</label>
            <AppDateInput
              value={invoiceDate}
              onChange={setInvoiceDate}
              style={disableFullEditFields ? disabledInput : input}
              disabled={disableFullEditFields}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>Due Date</label>
            <AppDateInput
              value={dueDate}
              onChange={setDueDate}
              style={!canChangeDueDateRemark ? disabledInput : input}
              disabled={!canChangeDueDateRemark}
            />
          </div>

          <FormField
            label="Tax %"
            type="number"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
            placeholder="0"
            disabled={disableFullEditFields}
          />

          <FormField
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional note"
            disabled={!canChangeDueDateRemark}
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={templateCard}>
            <div>
              <div style={templateTitle}>{getTemplateLabel(invoiceTemplate)}</div>
              <div style={templateText}>
                {invoiceTemplate === "STANDARD"
                  ? "A simple invoice format for normal item sales."
                  : invoiceTemplate === "TAX_INVOICE"
                  ? "A tax-focused invoice print layout similar to professional tax invoice formats."
                  : "A service/work format where quantity acts as hours, days, or work units."}
              </div>
            </div>
            <span style={templatePill}>{invoiceTemplate}</span>
          </div>
        </div>

        {selectedCustomer ? (
          <div style={{ marginTop: 18 }}>
            <div style={subSectionCard}>
              <div style={subSectionHeader}>
                <h3 style={subSectionTitle}>Selected Customer</h3>
              </div>

              <div style={infoGrid}>
                <InfoMini
                  label="Code"
                  value={selectedCustomer.customer_code || "-"}
                />
                <InfoMini
                  label="Name"
                  value={selectedCustomer.customer_name || "-"}
                />
                <InfoMini label="City" value={selectedCustomer.city || "-"} />
                <InfoMini
                  label="Mobile"
                  value={selectedCustomer.mobile_no || "-"}
                />
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
                <th style={th}>{itemHeader}</th>
                <th style={th}>{qtyHeader}</th>
                <th style={th}>{rateHeader}</th>
                <th style={th}>{totalHeader}</th>
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
                        <option value="">
                          {invoiceTemplate === "SERVICE_INVOICE"
                            ? "-- Select Service Item --"
                            : "-- Select Item --"}
                        </option>
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
                  <td colSpan="5" style={emptyRowTd}>
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
              ? `Save to create the invoice using "${getTemplateLabel(
                  invoiceTemplate
                )}" and generate the invoice number automatically.`
              : access.readOnly
              ? "This invoice is locked. Editing is not allowed."
              : access.restricted
              ? "Restricted edit mode is active. Only due date and remark can be updated."
              : "Full edit mode is active. Totals and selected template will be saved when you update."}
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Invoice Summary</div>
            <SummaryRow label="Subtotal" value={calc.subtotal} />
            <SummaryRow label="Tax Amount" value={calc.taxAmt} />
            <SummaryRow label="Grand Total" value={calc.grand} bold />
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

const billingFormGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
  alignItems: "end",
};

const templateHint = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.4,
};

const templateCard = {
  background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
};

const templateTitle = {
  color: "#0f172a",
  fontWeight: 950,
  fontSize: 14,
};

const templateText = {
  color: "#475569",
  fontWeight: 700,
  fontSize: 12,
  marginTop: 4,
  lineHeight: 1.45,
};

const templatePill = {
  border: "1px solid #93c5fd",
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 950,
  whiteSpace: "nowrap",
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

const tdSmall = {
  ...td,
  width: 140,
};

const tdAmount = {
  ...td,
  fontWeight: 900,
  color: "#0f172a",
  minWidth: 120,
};

const tdAction = {
  ...td,
  minWidth: 120,
};

const emptyRowTd = {
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