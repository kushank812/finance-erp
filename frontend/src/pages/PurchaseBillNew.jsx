import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField, AutoField } from "../components/ui/FormField";
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
      reason:
        "Partial purchase bill allows restricted edit only. Only due date and remark can be changed.",
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
      reason:
        "Purchase bill has payment entries. Only due date and remark can be changed.",
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
      <PageHeaderBlock
        eyebrowText="PURCHASE"
        title={getPageTitle()}
        subtitle={getPageSubtitle()}
        actions={
          <>
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
          </>
        }
      />

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

        <div style={formGridLike}>
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

          <FormField
            label="Bill Date"
            type="date"
            value={hdr.bill_date}
            onChange={(e) => setHdrField("bill_date", e.target.value)}
            disabled={disableFullEditFields}
          />

          <FormField
            label="Due Date"
            type="date"
            value={hdr.due_date}
            onChange={(e) => setHdrField("due_date", e.target.value)}
            disabled={!canChangeDueDateRemark}
          />

          <FormField
            label="Tax %"
            type="number"
            value={hdr.tax_percent}
            onChange={(e) => setHdrField("tax_percent", e.target.value)}
            placeholder="0"
            disabled={disableFullEditFields}
          />

          <FormField
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
          <table style={{ ...table, minWidth: 980 }}>
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
              ? "Save to create the purchase bill and generate the bill number automatically."
              : access.readOnly
              ? "This purchase bill is locked. Editing is not allowed."
              : access.restricted
              ? "Restricted edit mode is active. Only due date and remark can be updated."
              : "Full edit mode is active. Totals will be recalculated when you save."}
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Bill Summary</div>
            <SummaryRow label="Subtotal" value={money(computed.subtotal)} />
            <SummaryRow label="Tax Amount" value={money(computed.taxAmount)} />
            <SummaryRow label="Grand Total" value={money(computed.grandTotal)} bold />
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

const formGridLike = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
  alignItems: "end",
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