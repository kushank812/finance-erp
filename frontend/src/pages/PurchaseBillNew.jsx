import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function PurchaseBillNew() {
  const nav = useNavigate();
  const { billNo } = useParams();
  const isEditMode = Boolean(billNo);

  const [hdr, setHdr] = useState(emptyHdr);
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);

  const [vendorSearch, setVendorSearch] = useState("");
  const [itemSearches, setItemSearches] = useState([""]);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [loadingBill, setLoadingBill] = useState(false);

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
        const bill = await apiGet(`/purchase-invoices/${encodeURIComponent(billNo)}`);
        const data = normalizeBillToForm(bill);
        setHdr(data.hdr);
        setLines(data.lines);
        setItemSearches(data.itemSearches);
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
    const q = String(itemSearches[idx] || "").trim().toLowerCase();
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
    setLines((p) => [...p, { ...emptyLine }]);
    setItemSearches((p) => [...p, ""]);
  }

  function removeLine(idx) {
    setLines((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
    setItemSearches((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  }

  function onSelectItem(idx, item_code) {
    setErr("");

    const it = items.find((x) => x.item_code === item_code);

    setLines((prev) => {
      const alreadyUsed = prev.some((ln, i) => i !== idx && ln.item_code === item_code);
      if (item_code && alreadyUsed) {
        setErr(`Item "${item_code}" already added in another line. Increase Qty instead.`);
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
    setErr("");
    setOk("");
  }

  function validateAndBuildPayload() {
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

  async function save() {
    setErr("");
    setOk("");

    const payload = validateAndBuildPayload();
    if (!payload) return;

    try {
      setSaving(true);

      if (isEditMode) {
        const updated = await apiPut(`/purchase-invoices/${encodeURIComponent(billNo)}`, payload);
        setOk(`✅ Purchase Bill "${updated?.bill_no || billNo}" updated successfully.`);
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

  const pageLoading = loadingMasters || loadingBill;

  return (
    <div style={page}>
      <div style={headerWrap}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>
            {isEditMode ? "Edit Purchase Bill" : "Create Purchase Bill"}
          </h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            {isEditMode
              ? `Update purchase bill ${billNo}.`
              : "Select vendor + items from masters and save purchase bill."}
          </p>
        </div>

        <div style={headerActions}>
          <button
            onClick={() => nav("/purchase-bills")}
            style={btnGhost}
            disabled={saving || pageLoading}
          >
            Back to Bills
          </button>

          {isEditMode ? (
            <button
              onClick={() => nav(`/purchase/view/${encodeURIComponent(billNo)}`)}
              style={btnGhost}
              disabled={saving || pageLoading}
            >
              View Bill
            </button>
          ) : null}
        </div>
      </div>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}
      {pageLoading && <div style={msgInfo}>Loading data...</div>}

      <div style={card}>
        <div style={sectionHeader}>
          <h3 style={{ marginTop: 0, marginBottom: 0, color: "#111" }}>Bill Header</h3>

          {isEditMode ? (
            <div style={modeBadge}>EDIT MODE</div>
          ) : (
            <div style={modeBadgeBlue}>NEW BILL</div>
          )}
        </div>

        <div style={formGrid}>
          <AutoField
            label="Bill No"
            text={isEditMode ? billNo : "Auto-generated on save"}
            hint={
              isEditMode
                ? "Bill number cannot be changed."
                : "The system will generate the next bill number automatically."
            }
          />

          <VendorSelect
            vendorSearch={vendorSearch}
            setVendorSearch={setVendorSearch}
            vendorCode={hdr.vendor_code}
            setVendorCode={(value) => setHdrField("vendor_code", value)}
            vendors={filteredVendors}
            disabled={saving || pageLoading}
          />

          <Field
            label="Bill Date"
            type="date"
            value={hdr.bill_date}
            onChange={(e) => setHdrField("bill_date", e.target.value)}
            disabled={saving || pageLoading}
          />

          <Field
            label="Due Date"
            type="date"
            value={hdr.due_date}
            onChange={(e) => setHdrField("due_date", e.target.value)}
            disabled={saving || pageLoading}
          />

          <Field
            label="Tax %"
            type="number"
            value={hdr.tax_percent}
            onChange={(e) => setHdrField("tax_percent", e.target.value)}
            placeholder="0"
            disabled={saving || pageLoading}
          />

          <Field
            label="Remark"
            value={hdr.remark}
            onChange={(e) => setHdrField("remark", e.target.value)}
            placeholder="Optional note..."
            disabled={saving || pageLoading}
          />
        </div>

        {selectedVendor ? (
          <div style={{ marginTop: 14 }}>
            <div style={vendorInfoCard}>
              <div style={vendorInfoTitle}>Selected Vendor</div>
              <div style={vendorInfoGrid}>
                <InfoMini label="Code" value={selectedVendor.vendor_code || "-"} />
                <InfoMini label="Name" value={selectedVendor.vendor_name || "-"} />
                <InfoMini label="City" value={selectedVendor.city || "-"} />
                <InfoMini label="Mobile" value={selectedVendor.mobile_no || "-"} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={toolbarWrap}>
          <h3 style={{ margin: 0, color: "#111" }}>Line Items</h3>
          <button onClick={addLine} style={btnPrimary} disabled={saving || pageLoading}>
            + Add Row
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 980 }}>
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
              {lines.map((ln, idx) => {
                const qty = Number(ln.qty || 0);
                const rate = Number(ln.rate || 0);
                const lineTotal = round2(qty * rate);

                return (
                  <tr key={idx} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ minWidth: 300 }}>
                      <input
                        value={itemSearches[idx] || ""}
                        onChange={(e) => setItemSearch(idx, e.target.value)}
                        placeholder="Search item by code, name, units..."
                        style={input}
                        disabled={saving || pageLoading}
                      />

                      <div style={{ height: 6 }} />

                      <select
                        value={ln.item_code}
                        onChange={(e) => onSelectItem(idx, e.target.value)}
                        style={input}
                        disabled={saving || pageLoading}
                      >
                        <option value="">-- Select Item --</option>
                        {filteredItemsForRow(idx).map((it) => (
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
                        onChange={(e) => setLine(idx, "qty", e.target.value)}
                        style={input}
                        disabled={saving || pageLoading}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={ln.rate}
                        onChange={(e) => setLine(idx, "rate", e.target.value)}
                        style={input}
                        disabled={saving || pageLoading}
                      />
                    </td>

                    <td style={{ color: "#111", fontWeight: 800 }}>{lineTotal}</td>

                    <td>
                      <button
                        onClick={() => removeLine(idx)}
                        style={btnDanger}
                        disabled={saving || pageLoading}
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
            <Row label="Subtotal" value={money(computed.subtotal)} />
            <Row label="Tax Amount" value={money(computed.taxAmount)} />
            <Row label="Grand Total" value={money(computed.grandTotal)} bold />
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div style={toolbarWrap}>
          <div style={{ color: "#666", fontSize: 13 }}>
            {isEditMode
              ? "Update the purchase bill carefully. Existing totals will be recalculated."
              : "Save to generate bill number automatically."}
          </div>

          <div style={saveActions}>
            {!isEditMode ? (
              <button onClick={clearAll} style={btnGhost} disabled={saving || pageLoading}>
                Clear
              </button>
            ) : null}

            <button onClick={save} style={btnPrimary} disabled={saving || pageLoading}>
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Saving..."
                : isEditMode
                ? "Update Purchase Bill"
                : "Save Purchase Bill"}
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
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        style={input}
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
        placeholder="Search vendor by code, name, city..."
        style={input}
        disabled={disabled}
      />

      <select
        value={vendorCode}
        onChange={(e) => setVendorCode(e.target.value)}
        style={input}
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

function round2(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
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
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
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

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginBottom: 12,
};

const msgOk = {
  background: "#eaffea",
  border: "1px solid #bde7bd",
  padding: 10,
  borderRadius: 12,
  color: "#0a6a0a",
  marginBottom: 12,
};

const msgInfo = {
  background: "#eef4ff",
  border: "1px solid #b7cbff",
  padding: 10,
  borderRadius: 12,
  color: "#0b5cff",
  marginBottom: 12,
};

const modeBadge = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#fff2f2",
  color: "#c40000",
  border: "1px solid #efb0b0",
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

const vendorInfoCard = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const vendorInfoTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111",
  marginBottom: 10,
};

const vendorInfoGrid = {
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