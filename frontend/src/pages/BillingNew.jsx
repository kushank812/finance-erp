import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../api/client";

const emptyLine = { item_code: "", qty: 1, rate: 0 };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function normalizeInvoiceToForm(inv) {
  return {
    customerCode: inv?.customer_code || "",
    customerSearch: "",
    invoiceDate: inv?.invoice_date ? String(inv.invoice_date) : todayStr(),
    dueDate: inv?.due_date ? String(inv.due_date) : "",
    taxPercent: Number(inv?.tax_percent || 0),
    remark: inv?.remark || "",
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

export default function BillingNew() {
  const nav = useNavigate();
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

  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

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
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoadingInvoice(false);
      }
    })();
  }, [invoiceNo, isEditMode]);

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
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeRow(i) {
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
    setErr("");
  }

  function validate() {
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

  async function save() {
    setErr("");
    setOkMsg("");

    const payload = validate();
    if (!payload) return;

    try {
      setSaving(true);

      if (isEditMode) {
        const updated = await apiPut(`/sales-invoices/${encodeURIComponent(invoiceNo)}`, payload);
        setOkMsg(`✅ Invoice "${updated?.invoice_no || invoiceNo}" updated successfully.`);
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

  const pageLoading = loadingMasters || loadingInvoice;

  return (
    <div style={page}>
      <div style={headerWrap}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>
            {isEditMode ? "Edit Sales Invoice" : "Create New Bill (Sales Invoice)"}
          </h2>
          <p style={{ marginTop: 6, color: "#b8b8b8" }}>
            {isEditMode
              ? `Update invoice ${invoiceNo}.`
              : "Select customer + items from masters and save invoice."}
          </p>
        </div>

        <div style={headerActions}>
          <button
            onClick={() => nav("/sales-invoices")}
            style={btnGhost}
            disabled={saving || pageLoading}
          >
            Back to Invoices
          </button>

          {isEditMode ? (
            <button
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

      <div style={card}>
        <div style={sectionHeader}>
          <h3 style={{ marginTop: 0, marginBottom: 0, color: "#111" }}>Invoice Header</h3>
          {isEditMode ? (
            <div style={modeBadge}>EDIT MODE</div>
          ) : (
            <div style={modeBadgeBlue}>NEW INVOICE</div>
          )}
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
            disabled={saving || pageLoading}
          />

          <Field
            label="Invoice Date"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            disabled={saving || pageLoading}
          />

          <Field
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={saving || pageLoading}
          />

          <Field
            label="Tax %"
            type="number"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
            placeholder="0"
            disabled={saving || pageLoading}
          />

          <Field
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Optional note..."
            disabled={saving || pageLoading}
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
          <button onClick={addRow} style={btnPrimary} disabled={saving || pageLoading}>
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
                        disabled={saving || pageLoading}
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
                        disabled={saving || pageLoading}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={ln.rate}
                        onChange={(e) => setLine(i, { rate: e.target.value })}
                        style={input}
                        disabled={saving || pageLoading}
                      />
                    </td>

                    <td style={{ color: "#111", fontWeight: 800 }}>{lineTotal}</td>

                    <td>
                      <button
                        onClick={() => removeRow(i)}
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
            <Row label="Subtotal" value={calc.subtotal} />
            <Row label="Tax Amount" value={calc.taxAmt} />
            <Row label="Grand Total" value={calc.grand} bold />
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div style={toolbarWrap}>
          <div style={{ color: "#666", fontSize: 13 }}>
            {isEditMode
              ? "Update the invoice carefully. Existing totals will be recalculated."
              : "Save to generate invoice number automatically."}
          </div>

          <div style={saveActions}>
            {!isEditMode ? (
              <button
                onClick={clearForm}
                style={btnGhost}
                disabled={saving || pageLoading}
              >
                Clear
              </button>
            ) : null}

            <button onClick={save} style={btnPrimary} disabled={saving || pageLoading}>
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Saving..."
                : isEditMode
                ? "Update Invoice"
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
        style={input}
        disabled={disabled}
      />

      <select
        value={customerCode}
        onChange={(e) => setCustomerCode(e.target.value)}
        style={input}
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