// src/pages/VendorPaymentNew.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function VendorPaymentNew() {
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [billNo, setBillNo] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  async function load() {
    setErr("");
    setOk("");
    try {
      const [b, v] = await Promise.all([apiGet("/purchase-invoices/"), apiGet("/vendors/")]);
      setBills(Array.isArray(b) ? b : []);
      setVendors(Array.isArray(v) ? v : []);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openBills = useMemo(() => {
    return bills
      .filter((r) => num(r.balance) > 0)
      .sort((a, b) => String(a.bill_no || "").localeCompare(String(b.bill_no || "")));
  }, [bills]);

  const vendorNameByCode = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.vendor_code, v.vendor_name);
    return m;
  }, [vendors]);

  const selected = useMemo(() => openBills.find((r) => r.bill_no === billNo), [openBills, billNo]);

  const maxPayable = selected ? num(selected.balance) : 0;

  async function save() {
    setErr("");
    setOk("");

    if (!billNo) return setErr("Select a purchase bill.");
    const amt = num(amount);
    if (amt <= 0) return setErr("Enter a valid paid amount (> 0).");

    if (!selected) return setErr("Selected bill not found. Click Refresh.");
    if (amt > maxPayable) {
      return setErr(`Payment amount cannot exceed bill balance. Balance is ${money(maxPayable)}.`);
    }

    try {
      await apiPost(`/purchase-invoices/${encodeURIComponent(billNo)}/pay`, {
        amount: amt,
        remark: remark?.trim() || null,
      });

      setOk("✅ Payment saved. Accounts Payable updated.");
      setAmount("");
      setRemark("");
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  function clear() {
    setBillNo("");
    setAmount("");
    setRemark("");
    setErr("");
    setOk("");
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Vendor Payment</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Record payment against a Purchase Bill (updates amount_paid, balance, status).
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <div style={toolbarBetween}>
          <h3 style={{ marginTop: 0, marginBottom: 0, color: "#111" }}>Payment Details</h3>
          <button onClick={load} style={btnGhost}>
            Refresh
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.35fr 1fr 1.35fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <label style={lbl}>Purchase Bill *</label>
            <select value={billNo} onChange={(e) => setBillNo(e.target.value)} style={inp}>
              <option value="">-- Select Unpaid Bill --</option>
              {openBills.map((r) => {
                const vName = vendorNameByCode.get(r.vendor_code) || "";
                const label = `${r.bill_no} — ${r.vendor_code}${vName ? " (" + vName + ")" : ""} — Bal: ${money(
                  r.balance
                )}`;
                return (
                  <option key={r.bill_no} value={r.bill_no}>
                    {label}
                  </option>
                );
              })}
            </select>

            <div style={hint}>
              Only bills with <b>Balance &gt; 0</b> are shown.
            </div>
          </div>

          <div>
            <label style={lbl}>Amount Paid Now *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inp}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <div style={hint}>
              Max payable now: <b>{selected ? money(maxPayable) : "-"}</b>
            </div>
          </div>

          <div>
            <label style={lbl}>Remark</label>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              style={inp}
              placeholder="Optional note (UTR / cheque / bank / reference)"
            />
            <div style={hint}>Optional.</div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <Info
            title="Vendor"
            value={selected ? vendorNameByCode.get(selected.vendor_code) || selected.vendor_code : "-"}
          />
          <Info title="Bill Total" value={selected ? money(selected.grand_total) : "-"} />
          <Info title="Paid So Far" value={selected ? money(selected.amount_paid) : "-"} />
          <Info title="Current Balance" value={selected ? money(selected.balance) : "-"} />
        </div>

        <div style={toolbarWrap}>
          <button onClick={save} style={btnPrimary}>
            Save Payment
          </button>
          <button onClick={clear} style={btnGhost}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div style={infoBox}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

/* ---- styles ---- */

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const lbl = {
  fontSize: 13,
  color: "#111",
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
};

const hint = {
  marginTop: 6,
  fontSize: 12,
  color: "#666",
};

const inp = {
  width: "100%",
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
  boxSizing: "border-box",
};

const toolbarBetween = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
  justifyContent: "space-between",
};

const toolbarWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
  marginTop: 16,
};

const infoBox = {
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