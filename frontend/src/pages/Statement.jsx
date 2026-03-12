// src/pages/Statement.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function Statement() {
  const [mode, setMode] = useState("CUSTOMER"); // CUSTOMER | VENDOR

  const [customerCode, setCustomerCode] = useState("");
  const [vendorCode, setVendorCode] = useState("");

  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadMasters() {
    setErr("");
    try {
      const [cData, vData] = await Promise.all([
        apiGet("/customers/"),
        apiGet("/vendors/"),
      ]);

      const cList = Array.isArray(cData) ? cData : [];
      const vList = Array.isArray(vData) ? vData : [];

      setCustomers(cList);
      setVendors(vList);

      if (cList.length > 0 && !customerCode) {
        setCustomerCode(cList[0].customer_code);
      }

      if (vList.length > 0 && !vendorCode) {
        setVendorCode(vList[0].vendor_code);
      }
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function loadStatement(type, code) {
    if (!code) {
      setRows([]);
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const url =
        type === "CUSTOMER"
          ? `/customers/${encodeURIComponent(code)}/statement`
          : `/vendors/${encodeURIComponent(code)}/statement`;

      const data = await apiGet(url);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (mode === "CUSTOMER" && customerCode) {
      loadStatement("CUSTOMER", customerCode);
    }
    if (mode === "VENDOR" && vendorCode) {
      loadStatement("VENDOR", vendorCode);
    }
  }, [mode, customerCode, vendorCode]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((c) => {
      return (
        String(c.customer_code || "").toLowerCase().includes(q) ||
        String(c.customer_name || "").toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;

    return vendors.filter((v) => {
      return (
        String(v.vendor_code || "").toLowerCase().includes(q) ||
        String(v.vendor_name || "").toLowerCase().includes(q)
      );
    });
  }, [vendors, search]);

  const totals = useMemo(() => {
    return rows.reduce(
      (a, r) => {
        a.debit += Number(r.debit || 0);
        a.credit += Number(r.credit || 0);
        a.balance = Number(r.balance || 0);
        return a;
      },
      { debit: 0, credit: 0, balance: 0 }
    );
  }, [rows]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.customer_code === customerCode) || null;
  }, [customers, customerCode]);

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.vendor_code === vendorCode) || null;
  }, [vendors, vendorCode]);

  const pageTitle = mode === "CUSTOMER" ? "Customer Statement" : "Vendor Statement";
  const pageDesc =
    mode === "CUSTOMER"
      ? "View invoice and receipt movement with running balance."
      : "View purchase bill and vendor payment movement with running balance.";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>{pageTitle}</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>{pageDesc}</p>

      {err && <div style={msgErr}>{err}</div>}

      <div style={topTabs}>
        <button onClick={() => setMode("CUSTOMER")} style={tabBtn(mode === "CUSTOMER")}>
          Customer Statement
        </button>
        <button onClick={() => setMode("VENDOR")} style={tabBtn(mode === "VENDOR")}>
          Vendor Statement
        </button>
      </div>

      <div style={card}>
        <div style={toolbar}>
          <div style={toolbarLeft}>
            <div style={{ minWidth: 260, flex: 1 }}>
              <div style={lbl}>Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  mode === "CUSTOMER"
                    ? "Search customer code / customer name..."
                    : "Search vendor code / vendor name..."
                }
                style={inp}
              />
            </div>

            <div style={{ minWidth: 300, flex: 1 }}>
              <div style={lbl}>{mode === "CUSTOMER" ? "Customer" : "Vendor"}</div>

              {mode === "CUSTOMER" ? (
                <select
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  style={inp}
                >
                  <option value="">Select customer</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.customer_code} value={c.customer_code}>
                      {c.customer_code} - {c.customer_name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value)}
                  style={inp}
                >
                  <option value="">Select vendor</option>
                  {filteredVendors.map((v) => (
                    <option key={v.vendor_code} value={v.vendor_code}>
                      {v.vendor_code} - {v.vendor_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <button
            onClick={() =>
              loadStatement(mode, mode === "CUSTOMER" ? customerCode : vendorCode)
            }
            style={btnGhost}
            disabled={loading || (mode === "CUSTOMER" ? !customerCode : !vendorCode)}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div style={infoStrip}>
          {mode === "CUSTOMER" ? (
            <>
              <InfoMini
                title="Selected Customer"
                value={
                  selectedCustomer
                    ? `${selectedCustomer.customer_code} - ${selectedCustomer.customer_name}`
                    : "-"
                }
              />
              <InfoMini title="Address" value={selectedCustomer?.address_line1 || "-"} />
            </>
          ) : (
            <>
              <InfoMini
                title="Selected Vendor"
                value={
                  selectedVendor
                    ? `${selectedVendor.vendor_code} - ${selectedVendor.vendor_name}`
                    : "-"
                }
              />
              <InfoMini title="Address" value={selectedVendor?.address_line1 || "-"} />
            </>
          )}
        </div>

        <div style={{ height: 12 }} />

        <div style={statGrid}>
          <Stat title="Total Debit" value={money(totals.debit)} />
          <Stat title="Total Credit" value={money(totals.credit)} />
          <Stat title="Closing Balance" value={money(totals.balance)} strong />
        </div>

        <div style={{ height: 12 }} />

        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f6f7f9" }}>
                <th align="left">Date</th>
                <th align="left">Doc No</th>
                <th align="left">Type</th>
                <th align="right">Debit</th>
                <th align="right">Credit</th>
                <th align="right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.doc_no}-${r.type}-${i}`} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ color: "#111" }}>{String(r.date || "")}</td>
                  <td style={{ color: "#111", fontWeight: 900 }}>{r.doc_no}</td>
                  <td style={{ color: "#111" }}>{r.type}</td>
                  <td align="right" style={{ color: "#111" }}>
                    {money(r.debit)}
                  </td>
                  <td align="right" style={{ color: "#111" }}>
                    {money(r.credit)}
                  </td>
                  <td align="right" style={{ color: "#111", fontWeight: 900 }}>
                    {money(r.balance)}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" style={{ padding: 12, color: "#666" }}>
                    No statement rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, strong }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: strong ? 950 : 900, color: "#111" }}>
        {value}
      </div>
    </div>
  );
}

function InfoMini({ title, value }) {
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function tabBtn(active) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: active ? "1px solid #0b5cff" : "1px solid #ccc",
    background: active ? "#0b5cff" : "white",
    color: active ? "white" : "#111",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const topTabs = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 12,
};

const toolbar = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  justifyContent: "space-between",
};

const toolbarLeft = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
  flex: 1,
};

const infoStrip = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const statCard = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const miniCard = {
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

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginBottom: 12,
};