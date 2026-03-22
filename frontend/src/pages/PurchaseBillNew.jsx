import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function round2(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function getStatusValue(bill) {
  return String(bill?.status || "").toUpperCase();
}

const emptyHdr = {
  vendor_code: "",
  bill_date: todayISO(),
  due_date: "",
  tax_percent: 0,
  remark: "",
};

const emptyLine = { item_code: "", qty: 1, rate: 0 };

function normalizeBillToForm(bill) {
  return {
    hdr: {
      vendor_code: bill?.vendor_code || "",
      bill_date: bill?.bill_date ? String(bill.bill_date) : todayISO(),
      due_date: bill?.due_date ? String(bill.due_date) : "",
      tax_percent: Number(bill?.tax_percent || 0),
      remark: bill?.remark || "",
    },
    status: getStatusValue(bill),
    amountPaid: Number(bill?.amount_paid || 0),
    lines:
      Array.isArray(bill?.lines) && bill.lines.length > 0
        ? bill.lines.map((ln) => ({
            item_code: ln.item_code || "",
            qty: Number(ln.qty || 0),
            rate: Number(ln.rate || 0),
          }))
        : [{ ...emptyLine }],
    itemSearches:
      Array.isArray(bill?.lines) && bill.lines.length > 0
        ? bill.lines.map(() => "")
        : [""],
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

function computeEditAccess({ isEditMode, billStatus, amountPaid }) {
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

  const hasPayment = Number(amountPaid || 0) > 0;

  if (isCancelledStatus(billStatus)) {
    return {
      pageMode: "VIEW_ONLY",
      readOnly: true,
      restricted: false,
      fullEdit: false,
      saveBlocked: true,
      reason: "Cancelled purchase bill cannot be edited.",
    };
  }

  if (isPaidStatus(billStatus)) {
    return {
      pageMode: "VIEW_ONLY",
      readOnly: true,
      restricted: false,
      fullEdit: false,
      saveBlocked: true,
      reason: "Paid purchase bill cannot be edited.",
    };
  }

  if (isPartialStatus(billStatus)) {
    return {
      pageMode: "RESTRICTED",
      readOnly: false,
      restricted: true,
      fullEdit: false,
      saveBlocked: false,
      reason: "Partial purchase bill allows restricted edit only. Only due date and remark can be changed.",
    };
  }

  if (isPendingLikeStatus(billStatus) && !hasPayment) {
    return {
      pageMode: "FULL",
      readOnly: false,
      restricted: false,
      fullEdit: true,
      saveBlocked: false,
      reason: "Full edit allowed.",
    };
  }

  if (isPendingLikeStatus(billStatus) && hasPayment) {
    return {
      pageMode: "RESTRICTED",
      readOnly: false,
      restricted: true,
      fullEdit: false,
      saveBlocked: false,
      reason: "Purchase bill has payment entries. Only due date and remark can be changed.",
    };
  }

  return {
    pageMode: "VIEW_ONLY",
    readOnly: true,
    restricted: false,
    fullEdit: false,
    saveBlocked: true,
    reason: "This purchase bill cannot be edited.",
  };
}

export default function PurchaseBillNew() {
  const nav = useNavigate();
  const location = useLocation();
  const { billNo } = useParams();
  const isEditMode = Boolean(billNo);

  const [hdr, setHdr] = useState(emptyHdr);
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);

  const [vendorSearch, setVendorSearch] = useState("");
  const [itemSearches, setItemSearches] = useState([""]);

  const [billStatus, setBillStatus] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [loadingBill, setLoadingBill] = useState(false);

  const routeEditMode = location.state?.editMode || "";
  const routeBillStatus = location.state?.billStatus || "";
  const routeHasPayment = Boolean(location.state?.hasPayment);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (!isEditMode) return;

    (async () => {
      setErr("");
      setOk("");
      setLoadingBill(true);

      try {
        const bill = await apiGet(
          `/purchase-invoices/${encodeURIComponent(billNo)}`
        );
        const data = normalizeBillToForm(bill);
        setHdr(data.hdr);
        setLines(data.lines);
        setItemSearches(data.itemSearches);
        setBillStatus(data.status);
        setAmountPaid(data.amountPaid);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoadingBill(false);
      }
    })();
  }, [billNo, isEditMode]);

  async function loadMasters() {
    setErr("");
    setLoadingMasters(true);

    try {
      const [v, it] = await Promise.all([apiGet("/vendors/"), apiGet("/items/")]);
      setVendors(Array.isArray(v) ? v : []);
      setItems(Array.isArray(it) ? it : []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoadingMasters(false);
    }
  }

  const effectiveStatus = billStatus || routeBillStatus || "";
  const effectiveAmountPaid =
    Number.isFinite(Number(amountPaid)) && Number(amountPaid) > 0
      ? Number(amountPaid)
      : routeHasPayment
      ? 1
      : 0;

  const access = useMemo(() => {
    const computed = computeEditAccess({
      isEditMode,
      billStatus: effectiveStatus,
      amountPaid: effectiveAmountPaid,
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
  }, [isEditMode, effectiveStatus, effectiveAmountPaid, routeEditMode]);

  const pageLoading = loadingMasters || loadingBill;
  const disableRestrictedFields = saving || pageLoading || access.readOnly;
  const disableFullEditFields =
    saving || pageLoading || access.readOnly || access.restricted;

  const canChangeDueDateRemark = !disableRestrictedFields;
  const canEditLines = !disableFullEditFields;
  const canSave = !saving && !pageLoading && !access.saveBlocked;

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;

    return vendors.filter((v) => {
      return (
        String(v.vendor_code || "").toLowerCase().includes(q) ||
        String(v.vendor_name || "").toLowerCase().includes(q) ||
        String(v.city || "").toLowerCase().includes(q) ||
        String(v.mobile_no || "").toLowerCase().includes(q) ||
        String(v.email_id || "").toLowerCase().includes(q) ||
        String(v.gst_no || "").toLowerCase().includes(q)
      );
    });
  }, [vendors, vendorSearch]);

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.vendor_code === hdr.vendor_code) || null;
  }, [vendors, hdr.vendor_code]);

  function filteredItemsForRow(idx) {
    const q = String(itemSearches[idx] || "")
      .trim()
      .toLowerCase();
    if (!q) return items;

    return items.filter((it) => {
      return (
        String(it.item_code || "").toLowerCase().includes(q) ||
        String(it.item_name || "").toLowerCase().includes(q) ||
        String(it.units || "").toLowerCase().includes(q)
      );
    });
  }

  function setHdrField(k, v) {
    setHdr((p) => ({ ...p, [k]: v }));
  }

  function setLine(idx, key, value) {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  }

  function setItemSearch(idx, value) {
    setItemSearches((prev) => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  }

  function addLine() {
    if (!canEditLines) return;
    setLines((p) => [...p, { ...emptyLine }]);
    setItemSearches((p) => [...p, ""]);
  }

  function removeLine(idx) {
    if (!canEditLines) return;
    setLines((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
    setItemSearches((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  }

  function onSelectItem(idx, item_code) {
    if (!canEditLines) return;

    setErr("");

    const it = items.find((x) => x.item_code === item_code);

    setLines((prev) => {
      const alreadyUsed = prev.some(
        (ln, i) => i !== idx && ln.item_code === item_code
      );

      if (item_code && alreadyUsed) {
        setErr(
          `Item "${item_code}" already added in another line. Increase Qty instead.`
        );
        return prev;
      }

      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        item_code,
        rate: it ? Number(it.cost_price || 0) : 0,
      };
      return copy;
    });
  }

  const computed = useMemo(() => {
    const lineTotals = lines.map((ln) => num(ln.qty) * num(ln.rate));
    const subtotal = lineTotals.reduce((s, x) => s + x, 0);
    const taxPercent = num(hdr.tax_percent);
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;
    return { lineTotals, subtotal, taxAmount, grandTotal };
  }, [lines, hdr.tax_percent]);

  function clearAll() {
    setHdr({ ...emptyHdr, bill_date: todayISO() });
    setLines([{ ...emptyLine }]);
    setVendorSearch("");
    setItemSearches([""]);
    setBillStatus("");
    setAmountPaid(0);
    setErr("");
    setOk("");
  }

  function validateFullPayload() {
    if (!hdr.vendor_code) {
      setErr("Vendor is required.");
      return null;
    }

    if (!hdr.bill_date) {
      setErr("Bill Date is required.");
      return null;
    }

    const validLines = lines.filter((l) => l.item_code);

    if (validLines.length === 0) {
      setErr("Add at least 1 item line (select an item).");
      return null;
    }

    for (let i = 0; i < validLines.length; i++) {
      const l = validLines[i];

      if (num(l.qty) <= 0) {
        setErr(`Line ${i + 1}: Qty must be > 0`);
        return null;
      }

      if (num(l.rate) < 0) {
        setErr(`Line ${i + 1}: Rate cannot be negative`);
        return null;
      }
    }

    return {
      vendor_code: hdr.vendor_code,
      bill_date: hdr.bill_date,
      due_date: hdr.due_date || null,
      tax_percent: num(hdr.tax_percent || 0),
      remark: hdr.remark?.trim() || null,
      lines: validLines.map((l) => ({
        item_code: l.item_code,
        qty: num(l.qty),
        rate: num(l.rate),
      })),
    };
  }

  function validateRestrictedPayload() {
    return {
      due_date: hdr.due_date || null,
      remark: hdr.remark?.trim() || null,
    };
  }

  async function save() {
    setErr("");
    setOk("");

    if (!canSave) {
      setErr(access.reason || "This purchase bill cannot be edited.");
      return;
    }

    let payload = null;

    if (!isEditMode || access.fullEdit) {
      payload = validateFullPayload();
    } else if (access.restricted) {
      payload = validateRestrictedPayload();
    }

    if (!payload) return;

    try {
      setSaving(true);

      if (isEditMode) {
        const updated = await apiPut(
          `/purchase-invoices/${encodeURIComponent(billNo)}`,
          payload
        );
        setOk(
          `✅ Purchase Bill "${updated?.bill_no || billNo}" updated successfully.`
        );

        if (updated?.status) {
          setBillStatus(String(updated.status).toUpperCase());
        }
        if (updated?.amount_paid != null) {
          setAmountPaid(Number(updated.amount_paid || 0));
        }
      } else {
        const created = await apiPost("/purchase-invoices/", payload);
        setOk(`✅ Purchase Bill "${created?.bill_no || ""}" saved. Payables updated.`);
        clearAll();
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  function getPageTitle() {
    if (!isEditMode) return "Purchase Bill";
    if (access.readOnly) return "Purchase Bill Details";
    if (access.restricted) return "Purchase Bill Edit";
    return "Purchase Bill Edit";
  }

  function getPageSubtitle() {
    if (!isEditMode) {
      return "Create a new purchase bill using vendor and item master records.";
    }
    if (access.readOnly) {
      return `Bill ${billNo} is locked for editing.`;
    }
    if (access.restricted) {
      return `Restricted edit for bill ${billNo}. Only due date and remark can be changed.`;
    }
    return `Update purchase bill ${billNo} and recalculate totals automatically.`;
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
          <div style={eyebrow}>PURCHASE</div>
          <h1 style={pageTitle}>{getPageTitle()}</h1>
          <p style={pageSubtitle}>{getPageSubtitle()}</p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={() => nav("/purchase-bills")}
            style={btnSecondary}
            disabled={saving || pageLoading}
          >
            Back to Bills
          </button>

          {isEditMode ? (
            <button
              type="button"
              onClick={() => nav(`/purchase/view/${encodeURIComponent(billNo)}`)}
              style={btnGhost}
              disabled={saving || pageLoading}
            >
              View Bill
            </button>
          ) : null}
        </div>
      </div>

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {ok ? <AlertBox kind="success" message={ok} /> : null}
        {pageLoading ? <AlertBox kind="info" message="Loading data..." /> : null}
        {isEditMode && access.reason ? (
          <AlertBox kind="warning" message={access.reason} />
        ) : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Bill Header</h2>
            <p style={cardSubtitle}>
              Basic purchase bill information, vendor selection, and bill dates.
            </p>
          </div>
          <div>{getModeBadge()}</div>
        </div>

        <div style={formGrid}>
          <AutoField
            label="Bill No"
            text={isEditMode ? billNo : "Auto-generated on save"}
            hint={
              isEditMode
                ? "Bill number cannot be changed."
                : "The next bill number will be generated automatically."
            }
          />

          <VendorSelect
            vendorSearch={vendorSearch}
            setVendorSearch={setVendorSearch}
            vendorCode={hdr.vendor_code}
            setVendorCode={(value) => setHdrField("vendor_code", value)}
            vendors={filteredVendors}
            disabled={disableFullEditFields}
          />

          <Field
            label="Bill Date"
            type="date"
            value={hdr.bill_date}
            onChange={(e) => setHdrField("bill_date", e.target.value)}
            disabled={disableFullEditFields}
          />

          <Field
            label="Due Date"
            type="date"
            value={hdr.due_date}
            onChange={(e) => setHdrField("due_date", e.target.value)}
            disabled={!canChangeDueDateRemark}
          />

          <Field
            label="Tax %"
            type="number"
            value={hdr.tax_percent}
            onChange={(e) => setHdrField("tax_percent", e.target.value)}
            placeholder="0"
            disabled={disableFullEditFields}
          />

          <Field
            label="Remark"
            value={hdr.remark}
            onChange={(e) => setHdrField("remark", e.target.value)}
            placeholder="Optional note"
            disabled={!canChangeDueDateRemark}
          />
        </div>

        {selectedVendor ? (
          <div style={{ marginTop: 18 }}>
            <div style={subSectionCard}>
              <div style={subSectionHeader}>
                <h3 style={subSectionTitle}>Selected Vendor</h3>
              </div>

              <div style={infoGrid}>
                <InfoMini label="Code" value={selectedVendor.vendor_code || "-"} />
                <InfoMini label="Name" value={selectedVendor.vendor_name || "-"} />
                <InfoMini label="City" value={selectedVendor.city || "-"} />
                <InfoMini label="Mobile" value={selectedVendor.mobile_no || "-"} />
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
              Add bill rows, quantities, rates, and review totals.
            </p>
          </div>

          <button
            type="button"
            onClick={addLine}
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
              {lines.map((ln, idx) => {
                const qty = Number(ln.qty || 0);
                const rate = Number(ln.rate || 0);
                const lineTotal = round2(qty * rate);

                return (
                  <tr key={idx} style={tr}>
                    <td style={{ ...td, minWidth: 320 }}>
                      <input
                        value={itemSearches[idx] || ""}
                        onChange={(e) => setItemSearch(idx, e.target.value)}
                        placeholder="Search item by code, name, units"
                        style={!canEditLines ? disabledInput : input}
                        disabled={!canEditLines}
                      />

                      <div style={{ height: 8 }} />

                      <select
                        value={ln.item_code}
                        onChange={(e) => onSelectItem(idx, e.target.value)}
                        style={!canEditLines ? disabledInput : input}
                        disabled={!canEditLines}
                      >
                        <option value="">-- Select Item --</option>
                        {filteredItemsForRow(idx).map((it) => (
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
                        onChange={(e) => setLine(idx, "qty", e.target.value)}
                        style={!canEditLines ? disabledInput : input}
                        disabled={!canEditLines}
                      />
                    </td>

                    <td style={tdSmall}>
                      <input
                        type="number"
                        value={ln.rate}
                        onChange={(e) => setLine(idx, "rate", e.target.value)}
                        style={!canEditLines ? disabledInput : input}
                        disabled={!canEditLines}
                      />
                    </td>

                    <td style={tdAmount}>{lineTotal}</td>

                    <td style={tdAction}>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
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
              ? "Save to create the purchase bill and generate the bill number automatically."
              : access.readOnly
              ? "This purchase bill is locked. Editing is not allowed."
              : access.restricted
              ? "Restricted edit mode is active. Only due date and remark can be updated."
              : "Full edit mode is active. Totals will be recalculated when you save."}
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Bill Summary</div>
            <Row label="Subtotal" value={money(computed.subtotal)} />
            <Row label="Tax Amount" value={money(computed.taxAmount)} />
            <Row label="Grand Total" value={money(computed.grandTotal)} bold />
          </div>
        </div>

        <div style={actionBar}>
          <div style={saveActions}>
            {!isEditMode ? (
              <button
                type="button"
                onClick={clearAll}
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
                  : "Update Purchase Bill"
                : "Save Purchase Bill"}
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
        value={value ?? ""}
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

function VendorSelect({
  vendorSearch,
  setVendorSearch,
  vendorCode,
  setVendorCode,
  vendors,
  disabled = false,
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>Vendor</label>

      <input
        type="text"
        value={vendorSearch}
        onChange={(e) => setVendorSearch(e.target.value)}
        placeholder="Search by code, name, city"
        style={disabled ? disabledInput : input}
        disabled={disabled}
      />

      <select
        value={vendorCode}
        onChange={(e) => setVendorCode(e.target.value)}
        style={disabled ? disabledInput : input}
        disabled={disabled}
      >
        <option value="">-- Select Vendor --</option>
        {vendors.map((v) => (
          <option key={v.vendor_code} value={v.vendor_code}>
            {v.vendor_code} - {v.vendor_name}
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
  minWidth: 980,
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