import { useEffect, useMemo, useRef, useState } from "react";
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
  const [billSearch, setBillSearch] = useState("");
  const [showBillList, setShowBillList] = useState(false);

  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const pickerRef = useRef(null);

  async function load() {
    setErr("");
    setOk("");
    try {
      const [b, v] = await Promise.all([
        apiGet("/purchase-invoices/"),
        apiGet("/vendors/"),
      ]);
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
    function handleOutsideClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowBillList(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const openBills = useMemo(() => {
    return bills
      .filter((r) => num(r.balance) > 0)
      .sort((a, b) =>
        String(a.bill_no || "").localeCompare(String(b.bill_no || ""))
      );
  }, [bills]);

  const vendorNameByCode = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.vendor_code, v.vendor_name);
    return m;
  }, [vendors]);

  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toUpperCase();
    if (!q) return openBills;

    return openBills.filter((r) => {
      const bill = String(r.bill_no || "").toUpperCase();
      const vendorCode = String(r.vendor_code || "").toUpperCase();
      const vendorName = String(vendorNameByCode.get(r.vendor_code) || "").toUpperCase();
      const total = String(r.grand_total || "");
      const balance = String(r.balance || "");

      return (
        bill.includes(q) ||
        vendorCode.includes(q) ||
        vendorName.includes(q) ||
        total.includes(q) ||
        balance.includes(q)
      );
    });
  }, [openBills, billSearch, vendorNameByCode]);

  const selected = useMemo(
    () => openBills.find((r) => r.bill_no === billNo),
    [openBills, billNo]
  );

  const maxPayable = selected ? num(selected.balance) : 0;

  function selectBill(row) {
    const vendorName = vendorNameByCode.get(row.vendor_code) || "";
    setBillNo(row.bill_no);
    setBillSearch(
      `${row.bill_no} | ${row.vendor_code}${vendorName ? " - " + vendorName : ""} | BAL ${money(row.balance)}`
    );
    setShowBillList(false);
  }

  async function save() {
    setErr("");
    setOk("");

    if (!billNo) return setErr("Select a purchase bill.");

    const amt = num(amount);
    if (amt <= 0) return setErr("Enter a valid paid amount (> 0).");

    if (!selected) return setErr("Selected bill not found. Click Refresh.");

    if (amt > maxPayable) {
      return setErr(
        `Payment amount cannot exceed bill balance. Balance is ${money(maxPayable)}.`
      );
    }

    try {
      await apiPost(`/purchase-invoices/${encodeURIComponent(billNo)}/pay`, {
        amount: amt,
        remark: remark?.trim() || null,
      });

      setOk("Payment saved successfully.");
      setAmount("");
      setRemark("");
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  function clear() {
    setBillNo("");
    setBillSearch("");
    setAmount("");
    setRemark("");
    setErr("");
    setOk("");
    setShowBillList(false);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Vendor Payment</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Record payment against a Purchase Bill.
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <div style={toolbarBetween}>
          <h3 style={{ marginTop: 0, marginBottom: 0, color: "#111" }}>
            Payment Details
          </h3>
          <button onClick={load} style={btnGhost}>
            Refresh
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div style={grid}>
          <div style={{ position: "relative" }} ref={pickerRef}>
            <label style={lbl}>Purchase Bill Search *</label>

            <input
              value={billSearch}
              onChange={(e) => {
                setBillSearch(e.target.value);
                setShowBillList(true);
                if (!e.target.value.trim()) {
                  setBillNo("");
                }
              }}
              onFocus={() => setShowBillList(true)}
              placeholder="Search bill / vendor"
              style={inp}
            />

            {showBillList && (
              <div style={dropdown}>
                <div style={dropdownHead}>
                  {filteredBills.length} bill{filteredBills.length === 1 ? "" : "s"} found
                </div>

                <div style={dropdownList}>
                  {filteredBills.length === 0 ? (
                    <div style={emptyRow}>No matching unpaid bills found.</div>
                  ) : (
                    filteredBills.map((r) => {
                      const vendorName = vendorNameByCode.get(r.vendor_code) || "";
                      const active = r.bill_no === billNo;

                      return (
                        <button
                          key={r.bill_no}
                          type="button"
                          onClick={() => selectBill(r)}
                          style={{
                            ...dropdownItem,
                            ...(active ? dropdownItemActive : {}),
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{r.bill_no}</div>
                          <div style={dropdownSub}>
                            Vendor: {vendorName || r.vendor_code}
                          </div>
                          <div style={dropdownSub}>
                            Total: {money(r.grand_total)} | Balance: {money(r.balance)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

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
              placeholder="Optional note"
            />
            <div style={hint}>Optional.</div>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div style={statGrid}>
          <Info title="Selected Bill" value={selected?.bill_no || "-"} />
          <Info
            title="Vendor"
            value={
              selected
                ? vendorNameByCode.get(selected.vendor_code) || selected.vendor_code
                : "-"
            }
          />
          <Info title="Bill Total" value={selected ? money(selected.grand_total) : "-"} />
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
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111", lineHeight: 1.2 }}>
        {value}
      </div>
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

const grid = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1.2fr",
  gap: 16,
  alignItems: "start",
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
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

const dropdown = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 6,
  background: "#fff",
  border: "1px solid #d9d9d9",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
  zIndex: 30,
  overflow: "hidden",
};

const dropdownHead = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
  color: "#555",
  background: "#f8f9fb",
  borderBottom: "1px solid #ececec",
};

const dropdownList = {
  maxHeight: 240,
  overflowY: "auto",
};

const dropdownItem = {
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid #f0f0f0",
  background: "#fff",
  padding: "10px 12px",
  cursor: "pointer",
};

const dropdownItemActive = {
  background: "#eef4ff",
};

const dropdownSub = {
  fontSize: 12,
  color: "#666",
  marginTop: 2,
};

const emptyRow = {
  padding: 12,
  color: "#666",
  fontSize: 13,
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