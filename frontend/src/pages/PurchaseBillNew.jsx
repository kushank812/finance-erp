// src/pages/PurchaseBillNew.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client";

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
  bill_no: "",
  vendor_code: "",
  bill_date: todayISO(),
  due_date: "",
  tax_percent: 0,
  remark: "",
};

const emptyLine = { item_code: "", qty: 1, rate: 0 };

export default function PurchaseBillNew() {
  const [hdr, setHdr] = useState(emptyHdr);
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);

  const [vendorSearch, setVendorSearch] = useState("");
  const [itemSearches, setItemSearches] = useState([""]);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMasters();
  }, []);

  async function loadMasters() {
    setErr("");
    try {
      const [v, it] = await Promise.all([apiGet("/vendors/"), apiGet("/items/")]);
      setVendors(Array.isArray(v) ? v : []);
      setItems(Array.isArray(it) ? it : []);
    } catch (e) {
      setErr(String(e.message || e));
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

  async function save() {
    setErr("");
    setOk("");

    if (!hdr.bill_no.trim()) return setErr("Bill No is required (Example: BILL-001).");
    if (!hdr.vendor_code) return setErr("Vendor is required.");
    if (!hdr.bill_date) return setErr("Bill Date is required.");

    const validLines = lines.filter((l) => l.item_code);
    if (validLines.length === 0) return setErr("Add at least 1 item line (select an item).");

    for (let i = 0; i < validLines.length; i++) {
      const l = validLines[i];
      if (num(l.qty) <= 0) return setErr(`Line ${i + 1}: Qty must be > 0`);
      if (num(l.rate) < 0) return setErr(`Line ${i + 1}: Rate cannot be negative`);
    }

    const payload = {
      bill_no: hdr.bill_no.trim(),
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

    try {
      setSaving(true);
      await apiPost("/purchase-invoices/", payload);
      setOk(`✅ Purchase Bill "${payload.bill_no}" saved. Payables updated.`);
      clearAll();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <h2 style={{ margin: 0, color: "#fff" }}>Create Purchase Bill</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Select vendor + items from masters and save purchase bill.
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      {/* Header */}
      <div style={card}>
        <h3 style={{ marginTop: 0, color: "#111" }}>Bill Header</h3>

        <div style={formGrid}>
          <Field
            label="Bill No"
            value={hdr.bill_no}
            onChange={(e) => setHdrField("bill_no", e.target.value)}
            placeholder="BILL001"
          />

          <VendorSelect
            vendorSearch={vendorSearch}
            setVendorSearch={setVendorSearch}
            vendorCode={hdr.vendor_code}
            setVendorCode={(value) => setHdrField("vendor_code", value)}
            vendors={filteredVendors}
          />

          <Field
            label="Bill Date"
            type="date"
            value={hdr.bill_date}
            onChange={(e) => setHdrField("bill_date", e.target.value)}
          />

          <Field
            label="Due Date"
            type="date"
            value={hdr.due_date}
            onChange={(e) => setHdrField("due_date", e.target.value)}
          />

          <Field
            label="Tax %"
            type="number"
            value={hdr.tax_percent}
            onChange={(e) => setHdrField("tax_percent", e.target.value)}
            placeholder="0"
          />

          <Field
            label="Remark"
            value={hdr.remark}
            onChange={(e) => setHdrField("remark", e.target.value)}
            placeholder="Optional note..."
          />
        </div>
      </div>

      <div style={{ height: 14 }} />

      {/* Lines */}
      <div style={card}>
        <div style={toolbarWrap}>
          <h3 style={{ margin: 0, color: "#111" }}>Line Items</h3>
          <button onClick={addLine} style={btnPrimary}>
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
                      />

                      <div style={{ height: 6 }} />

                      <select
                        value={ln.item_code}
                        onChange={(e) => onSelectItem(idx, e.target.value)}
                        style={input}
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
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={ln.rate}
                        onChange={(e) => setLine(idx, "rate", e.target.value)}
                        style={input}
                      />
                    </td>

                    <td style={{ color: "#111", fontWeight: 800 }}>{lineTotal}</td>

                    <td>
                      <button onClick={() => removeLine(idx)} style={btnDanger} disabled={saving}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
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

        <div style={toolbarWrap}>
          <button onClick={save} style={btnPrimary} disabled={saving}>
            {saving ? "Saving..." : "Save Purchase Bill"}
          </button>
          <button onClick={clearAll} style={btnGhost} disabled={saving}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} style={input} />
    </div>
  );
}

function VendorSelect({
  vendorSearch,
  setVendorSearch,
  vendorCode,
  setVendorCode,
  vendors,
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
      />

      <select
        value={vendorCode}
        onChange={(e) => setVendorCode(e.target.value)}
        style={input}
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
    <div style={{ display: "flex", justifyContent: "space-between", color: "#111", fontWeight: bold ? 900 : 600 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function round2(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

/* ---- styles ---- */

const page = { maxWidth: 1100, margin: "0 auto", padding: 14 };

const card = { background: "white", border: "1px solid #e6e6e6", borderRadius: 16, padding: 16 };

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