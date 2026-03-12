// src/pages/ReceiptNew.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function ReceiptNew() {
  const [rows, setRows] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setErr("");
    setOk("");
    try {
      const data = await apiGet("/sales-invoices/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(() => rows.find((r) => r.invoice_no === invoiceNo), [rows, invoiceNo]);

  const selectedBalance = useMemo(() => Number(selected?.balance || 0), [selected]);

  async function save() {
    setErr("");
    setOk("");

    if (!invoiceNo) return setErr("Select an invoice.");

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setErr("Enter a valid received amount (> 0).");

    // ✅ Step 4 validation: receipt cannot exceed invoice balance
    if (selected && amt > selectedBalance) {
      return setErr(`Receipt amount cannot exceed invoice balance. Balance is ${money(selectedBalance)}.`);
    }

    try {
      await apiPost(`/sales-invoices/${encodeURIComponent(invoiceNo)}/receive`, {
        amount: amt,
        remark: remark || null,
      });

      setOk("✅ Receipt saved. Ledger updated.");
      setAmount("");
      setRemark("");
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Create New Receipt</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Record amount received against a sales invoice (updates balance + status).
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <h3 style={{ marginTop: 0, color: "#111" }}>Receipt Details</h3>

        {/* ✅ responsive grid */}
        <div style={grid}>
          <div>
            <label style={lbl}>Invoice No</label>
            <select value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} style={inp}>
              <option value="">-- Select Invoice --</option>
              {rows.map((r) => (
                <option key={r.invoice_no} value={r.invoice_no}>
                  {r.invoice_no} (Bal: {money(r.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={lbl}>Amount Received Now</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inp}
              placeholder="0.00"
            />
            {selected && (
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                Max allowed: <b>{money(selectedBalance)}</b>
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Remark</label>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              style={inp}
              placeholder="Optional note..."
            />
          </div>
        </div>

        <div style={{ height: 12 }} />

        {/* ✅ responsive stat grid */}
        <div style={statGrid}>
          <Info title="Customer" value={selected?.customer_code || "-"} />
          <Info title="Invoice Total" value={selected ? money(selected.grand_total) : "-"} />
          <Info title="Current Balance" value={selected ? money(selected.balance) : "-"} />
        </div>

        <div style={toolbarWrap}>
          <button onClick={save} style={btnPrimary}>
            Save Receipt
          </button>
          <button onClick={load} style={btnGhost}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div style={infoBox}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#111" }}>{value}</div>
    </div>
  );
}

/* ---- styles ---- */

const card = { background: "white", border: "1px solid #e6e6e6", borderRadius: 16, padding: 16 };

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  alignItems: "end",
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const toolbarWrap = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", marginTop: 16 };

const infoBox = { background: "#f7f8fa", border: "1px solid #eee", borderRadius: 14, padding: 12 };

const lbl = { fontSize: 13, color: "#111", display: "block", marginBottom: 6, fontWeight: 800 };

const inp = {
  width: "100%",
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
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
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
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