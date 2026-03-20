import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function ReceiptNew() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceList, setShowInvoiceList] = useState(false);

  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const pickerRef = useRef(null);

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

  useEffect(() => {
    function handleOutsideClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowInvoiceList(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selected = useMemo(
    () => rows.find((r) => r.invoice_no === invoiceNo),
    [rows, invoiceNo]
  );

  const selectedBalance = useMemo(
    () => Number(selected?.balance || 0),
    [selected]
  );

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toUpperCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const invoice = String(r.invoice_no || "").toUpperCase();
      const customer = String(r.customer_code || "").toUpperCase();
      const total = String(r.grand_total || "");
      const balance = String(r.balance || "");
      return (
        invoice.includes(q) ||
        customer.includes(q) ||
        total.includes(q) ||
        balance.includes(q)
      );
    });
  }, [rows, invoiceSearch]);

  function selectInvoice(row) {
    setInvoiceNo(row.invoice_no);
    setInvoiceSearch(
      `${row.invoice_no} | ${row.customer_code || "-"} | BAL ${money(row.balance)}`
    );
    setShowInvoiceList(false);
  }

  async function save() {
    setErr("");
    setOk("");

    if (!invoiceNo) {
      setErr("Select an invoice.");
      return;
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Enter a valid received amount (> 0).");
      return;
    }

    if (selected && amt > selectedBalance) {
      setErr(
        `Receipt amount cannot exceed invoice balance. Balance is ${money(selectedBalance)}.`
      );
      return;
    }

    try {
      const saved = await apiPost(
        `/sales-invoices/${encodeURIComponent(invoiceNo)}/receive`,
        {
          amount: amt,
          remark: remark || null,
        }
      );

      const receiptNo = saved?.receipt_no || "";
      const savedInvoiceNo = saved?.invoice_no || invoiceNo;

      setOk(
        receiptNo
          ? `Receipt ${receiptNo} saved successfully for invoice ${savedInvoiceNo}.`
          : `Receipt saved successfully for invoice ${savedInvoiceNo}.`
      );

      setAmount("");
      setRemark("");
      await load();

      if (receiptNo) {
        navigate(`/receipt/view/${encodeURIComponent(receiptNo)}`);
      } else {
        setErr(
          "Receipt was saved, but receipt number was not returned from backend."
        );
      }
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Create New Receipt</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Record amount received against a sales invoice.
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <h3 style={{ marginTop: 0, color: "#111" }}>Receipt Details</h3>

        <div style={grid}>
          <div style={{ position: "relative" }} ref={pickerRef}>
            <label style={lbl}>Invoice Search</label>

            <input
              value={invoiceSearch}
              onChange={(e) => {
                setInvoiceSearch(e.target.value);
                setShowInvoiceList(true);
                if (!e.target.value.trim()) {
                  setInvoiceNo("");
                }
              }}
              onFocus={() => setShowInvoiceList(true)}
              placeholder="Search by invoice no / customer / amount"
              style={inp}
            />

            {showInvoiceList && (
              <div style={dropdown}>
                <div style={dropdownHead}>
                  {filteredInvoices.length} invoice
                  {filteredInvoices.length === 1 ? "" : "s"} found
                </div>

                <div style={dropdownList}>
                  {filteredInvoices.length === 0 ? (
                    <div style={emptyRow}>No matching invoices found.</div>
                  ) : (
                    filteredInvoices.map((r) => {
                      const active = r.invoice_no === invoiceNo;
                      return (
                        <button
                          key={r.invoice_no}
                          type="button"
                          onClick={() => selectInvoice(r)}
                          style={{
                            ...dropdownItem,
                            ...(active ? dropdownItemActive : {}),
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{r.invoice_no}</div>
                          <div style={dropdownSub}>
                            Customer: {r.customer_code || "-"}
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

        <div style={statGrid}>
          <Info title="Selected Invoice" value={selected?.invoice_no || "-"} />
          <Info title="Customer" value={selected?.customer_code || "-"} />
          <Info
            title="Invoice Total"
            value={selected ? money(selected.grand_total) : "-"}
          />
          <Info
            title="Current Balance"
            value={selected ? money(selected.balance) : "-"}
          />
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

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr",
  gap: 12,
  alignItems: "start",
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
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

const lbl = {
  fontSize: 13,
  color: "#111",
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
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