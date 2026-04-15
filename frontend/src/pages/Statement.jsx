// src/pages/Statement.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../api/client";

import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
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
  tableWrap,
  table,
  th,
  thRight,
  tr,
  td,
  tdCode,
  tdRight,
  emptyTd,
  btnGhost,
  btnPrimary,
  btnSecondary,
  badgeBlue,
  badgeGreen,
} from "../components/ui/uiStyles";

import { toDisplayDate, toISODate } from "../utils/date";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function safeDisplayDate(value) {
  if (!value) return "-";

  try {
    let s = String(value).trim();
    if (!s) return "-";

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split("/");
      return `${dd}-${mm}-${yyyy}`;
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

    if (s.includes("T")) s = s.split("T")[0];
    if (s.includes(" ")) s = s.split(" ")[0];

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const display = toDisplayDate(s);
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(display)) {
        const [dd, mm, yyyy] = display.split("/");
        return `${dd}-${mm}-${yyyy}`;
      }
      return display;
    }

    return "-";
  } catch {
    return "-";
  }
}

function normalizeISODate(value) {
  if (!value) return "";

  try {
    let s = String(value).trim();
    if (!s) return "";

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      s = toISODate(s);
    } else {
      if (s.includes("T")) s = s.split("T")[0];
      if (s.includes(" ")) s = s.split(" ")[0];
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    return s;
  } catch {
    return "";
  }
}

function getRowDate(row, mode) {
  if (mode === "CUSTOMER") {
    return (
      row?.date ||
      row?.doc_date ||
      row?.invoice_date ||
      row?.receipt_date ||
      row?.transaction_date ||
      ""
    );
  }

  return (
    row?.date ||
    row?.doc_date ||
    row?.bill_date ||
    row?.payment_date ||
    row?.transaction_date ||
    ""
  );
}

function getRowDocNo(row, mode) {
  if (mode === "CUSTOMER") {
    return row?.doc_no || row?.invoice_no || row?.receipt_no || row?.document_no || "-";
  }

  return row?.doc_no || row?.bill_no || row?.payment_no || row?.document_no || "-";
}

function getRowType(row, mode) {
  if (mode === "CUSTOMER") {
    return (
      row?.type ||
      row?.doc_type ||
      (row?.receipt_no ? "Receipt" : row?.invoice_no || row?.doc_no ? "Invoice" : "-")
    );
  }

  return (
    row?.type ||
    row?.doc_type ||
    (row?.payment_no ? "Payment" : row?.bill_no || row?.doc_no ? "Bill" : "-")
  );
}

function getRowDebit(row, mode) {
  if (row?.debit != null) return Number(row.debit || 0);

  if (mode === "CUSTOMER") {
    const type = String(getRowType(row, mode) || "").toLowerCase();
    if (type === "invoice") return Number(row?.grand_total || row?.amount || 0);
    return 0;
  }

  const type = String(getRowType(row, mode) || "").toLowerCase();
  if (type === "bill") return Number(row?.grand_total || row?.amount || 0);
  return 0;
}

function getRowCredit(row, mode) {
  if (row?.credit != null) return Number(row.credit || 0);

  if (mode === "CUSTOMER") {
    const type = String(getRowType(row, mode) || "").toLowerCase();
    if (type === "receipt") {
      return Number(row?.amount_received || row?.received_amount || row?.amount || 0);
    }
    return 0;
  }

  const type = String(getRowType(row, mode) || "").toLowerCase();
  if (type === "payment") {
    return Number(row?.amount_paid || row?.paid_amount || row?.amount || 0);
  }
  return 0;
}

function sortRowsByDateAsc(list, mode) {
  return [...list].sort((a, b) => {
    const da = normalizeISODate(getRowDate(a, mode));
    const db = normalizeISODate(getRowDate(b, mode));

    if (da !== db) return da.localeCompare(db);

    const docA = String(getRowDocNo(a, mode) || "");
    const docB = String(getRowDocNo(b, mode) || "");

    return docA.localeCompare(docB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function rebuildRunningBalance(list, mode) {
  let balance = 0;

  return list.map((row) => {
    const debit = getRowDebit(row, mode);
    const credit = getRowCredit(row, mode);
    balance += debit - credit;

    return {
      ...row,
      balance,
    };
  });
}

function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const header = Object.keys(rows[0] || {});
  const lines = [
    header.join(","),
    ...rows.map((r) => header.map((h) => esc(r[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getCustomerAddress(customer) {
  if (!customer) return "-";
  return (
    customer.customer_address_line1 ||
    customer.address_line1 ||
    customer.customer_address ||
    "-"
  );
}

function getVendorAddress(vendor) {
  if (!vendor) return "-";
  return (
    vendor.vendor_address_line1 ||
    vendor.address_line1 ||
    vendor.vendor_address ||
    "-"
  );
}

export default function Statement() {
  const location = useLocation();

  const [mode, setMode] = useState("CUSTOMER");
  const [customerCode, setCustomerCode] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [mastersLoaded, setMastersLoaded] = useState(false);

  async function loadMastersAndData(activeMode = mode) {
    setErr("");
    setLoading(true);

    try {
      const [cData, vData] = await Promise.all([
        apiGet("/customers/"),
        apiGet("/vendors/"),
      ]);

      const customerList = Array.isArray(cData) ? cData : [];
      const vendorList = Array.isArray(vData) ? vData : [];

      setCustomers(customerList);
      setVendors(vendorList);
      setCustomerCode("");
      setVendorCode("");
      setMastersLoaded(true);

      if (activeMode === "CUSTOMER") {
        await loadAllStatements("CUSTOMER", customerList, vendorList);
      } else {
        await loadAllStatements("VENDOR", customerList, vendorList);
      }
    } catch (e) {
      setErr(String(e.message || e));
      setCustomers([]);
      setVendors([]);
      setRows([]);
      setMastersLoaded(true);
      setLoading(false);
    }
  }

  async function loadAllStatements(type, customerList = [], vendorList = []) {
    setErr("");

    try {
      if (type === "CUSTOMER") {
        const codes = customerList.map((c) => c.customer_code).filter(Boolean);

        if (codes.length === 0) {
          setRows([]);
          return;
        }

        const results = await Promise.allSettled(
          codes.map(async (code) => {
            const data = await apiGet(`/customers/${encodeURIComponent(code)}/statement`);
            const list = Array.isArray(data) ? data : [];
            return list.map((row) => ({
              ...row,
              customer_code: code,
            }));
          })
        );

        const successRows = results
          .filter((r) => r.status === "fulfilled")
          .flatMap((r) => r.value);

        const failures = results.filter((r) => r.status === "rejected");

        const sorted = sortRowsByDateAsc(successRows, "CUSTOMER");
        const balanced = rebuildRunningBalance(sorted, "CUSTOMER");
        setRows(balanced);

        if (failures.length > 0 && successRows.length === 0) {
          const firstError = failures[0]?.reason;
          setErr(
            String(
              firstError?.message ||
                firstError ||
                "Failed to load customer statements"
            )
          );
        } else if (failures.length > 0) {
          setErr(
            `Some customer statements could not be loaded (${failures.length} failed, ${
              results.length - failures.length
            } loaded).`
          );
        }
      } else {
        const codes = vendorList.map((v) => v.vendor_code).filter(Boolean);

        if (codes.length === 0) {
          setRows([]);
          return;
        }

        const results = await Promise.allSettled(
          codes.map(async (code) => {
            const data = await apiGet(`/vendors/${encodeURIComponent(code)}/statement`);
            const list = Array.isArray(data) ? data : [];
            return list.map((row) => ({
              ...row,
              vendor_code: code,
            }));
          })
        );

        const successRows = results
          .filter((r) => r.status === "fulfilled")
          .flatMap((r) => r.value);

        const failures = results.filter((r) => r.status === "rejected");

        const sorted = sortRowsByDateAsc(successRows, "VENDOR");
        const balanced = rebuildRunningBalance(sorted, "VENDOR");
        setRows(balanced);

        if (failures.length > 0 && successRows.length === 0) {
          const firstError = failures[0]?.reason;
          setErr(
            String(
              firstError?.message ||
                firstError ||
                "Failed to load vendor statements"
            )
          );
        } else if (failures.length > 0) {
          setErr(
            `Some vendor statements could not be loaded (${failures.length} failed, ${
              results.length - failures.length
            } loaded).`
          );
        }
      }
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatement(type, code) {
    if (!code) {
      if (type === "CUSTOMER") {
        await loadAllStatements("CUSTOMER", customers, vendors);
      } else {
        await loadAllStatements("VENDOR", customers, vendors);
      }
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
      const list = Array.isArray(data) ? data : [];
      const sorted = sortRowsByDateAsc(list, type);
      const balanced = rebuildRunningBalance(sorted, type);
      setRows(balanced);
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMastersAndData(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    if (!mastersLoaded) return;

    setSearch("");
    setCustomerCode("");
    setVendorCode("");
    setRows([]);

    if (mode === "CUSTOMER") {
      loadAllStatements("CUSTOMER", customers, vendors);
    } else {
      loadAllStatements("VENDOR", customers, vendors);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!mastersLoaded || mode !== "CUSTOMER") return;
    loadStatement("CUSTOMER", customerCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerCode]);

  useEffect(() => {
    if (!mastersLoaded || mode !== "VENDOR") return;
    loadStatement("VENDOR", vendorCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorCode]);

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

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.customer_code === customerCode) || null;
  }, [customers, customerCode]);

  const selectedVendor = useMemo(() => {
    return vendors.find((v) => v.vendor_code === vendorCode) || null;
  }, [vendors, vendorCode]);

  const filteredRows = useMemo(() => {
    const fromIso = normalizeISODate(fromDate);
    const toIso = normalizeISODate(toDate);

    const out = rows.filter((r) => {
      const rowIso = normalizeISODate(getRowDate(r, mode));
      if (!rowIso) return false;
      if (fromIso && rowIso < fromIso) return false;
      if (toIso && rowIso > toIso) return false;
      return true;
    });

    return rebuildRunningBalance(sortRowsByDateAsc(out, mode), mode);
  }, [rows, fromDate, toDate, mode]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let closing = 0;

    for (const r of filteredRows) {
      debit += getRowDebit(r, mode);
      credit += getRowCredit(r, mode);
      closing = Number(r?.balance || 0);
    }

    const opening =
      filteredRows.length > 0
        ? Number(filteredRows[0]?.balance || 0) -
          getRowDebit(filteredRows[0], mode) +
          getRowCredit(filteredRows[0], mode)
        : 0;

    return {
      opening,
      debit,
      credit,
      closing,
    };
  }, [filteredRows, mode]);

  const pageTitle =
    mode === "CUSTOMER" ? "Customer Statement" : "Vendor Statement";

  const pageDesc =
    mode === "CUSTOMER"
      ? "View invoice and receipt movement with running balance."
      : "View purchase bill and vendor payment movement with running balance.";

  async function handleRefresh() {
    if (mode === "CUSTOMER") {
      await loadStatement("CUSTOMER", customerCode);
    } else {
      await loadStatement("VENDOR", vendorCode);
    }
  }

  function handleExportCSV() {
    if (filteredRows.length === 0) return;

    const selectedCode =
      mode === "CUSTOMER"
        ? customerCode || "ALL_CUSTOMERS"
        : vendorCode || "ALL_VENDORS";

    const out = filteredRows.map((r) => ({
      Date: safeDisplayDate(getRowDate(r, mode)),
      DocNo: getRowDocNo(r, mode),
      Type: getRowType(r, mode),
      Debit: money(getRowDebit(r, mode)),
      Credit: money(getRowCredit(r, mode)),
      Balance: money(r?.balance || 0),
    }));

    const fromIso = normalizeISODate(fromDate) || "START";
    const toIso = normalizeISODate(toDate) || "END";

    downloadCSV(
      `${mode}_STATEMENT_${selectedCode}_${fromIso}_${toIso}.csv`,
      out
    );
  }

  function handleClearDateFilter() {
    setFromDate("");
    setToDate("");
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="STATEMENTS"
        title={pageTitle}
        subtitle={pageDesc}
        actions={
          <>
            <button
              type="button"
              onClick={() => setMode("CUSTOMER")}
              style={mode === "CUSTOMER" ? tabActiveBlue : tabButton}
            >
              Customer Statement
            </button>

            <button
              type="button"
              onClick={() => setMode("VENDOR")}
              style={mode === "VENDOR" ? tabActiveGreen : tabButton}
            >
              Vendor Statement
            </button>
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {loading ? <AlertBox kind="info" message="Loading statement..." /> : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Filters</h2>
            <p style={cardSubtitle}>
              Search, select, and filter the statement by date range.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            style={btnGhost}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={filterGrid}>
          <div style={field}>
            <label style={labelStyle}>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                mode === "CUSTOMER"
                  ? "Search customer code / customer name"
                  : "Search vendor code / vendor name"
              }
              style={input}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>
              {mode === "CUSTOMER" ? "Customer" : "Vendor"}
            </label>

            {mode === "CUSTOMER" ? (
              <select
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value)}
                style={input}
              >
                <option value="">ALL CUSTOMERS</option>
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
                style={input}
              >
                <option value="">ALL VENDORS</option>
                {filteredVendors.map((v) => (
                  <option key={v.vendor_code} value={v.vendor_code}>
                    {v.vendor_code} - {v.vendor_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={field}>
            <label style={labelStyle}>From Date</label>
            <input
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              style={input}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>To Date</label>
            <input
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              style={input}
            />
          </div>
        </div>

        <div style={actionRow}>
          <button
            type="button"
            onClick={handleClearDateFilter}
            style={btnGhost}
          >
            Clear Dates
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={filteredRows.length === 0 ? disabledLike(btnPrimary) : btnPrimary}
            disabled={filteredRows.length === 0}
          >
            Export CSV
          </button>

          <button type="button" onClick={() => window.print()} style={btnSecondary}>
            Print
          </button>
        </div>

        <div style={infoStrip}>
          {mode === "CUSTOMER" ? (
            <>
              <InfoMini
                title="Selected Customer"
                value={
                  selectedCustomer
                    ? `${selectedCustomer.customer_code} - ${selectedCustomer.customer_name}`
                    : "ALL CUSTOMERS"
                }
                badge={badgeBlue}
              />
              <InfoMini
                title="Address"
                value={getCustomerAddress(selectedCustomer)}
              />
            </>
          ) : (
            <>
              <InfoMini
                title="Selected Vendor"
                value={
                  selectedVendor
                    ? `${selectedVendor.vendor_code} - ${selectedVendor.vendor_name}`
                    : "ALL VENDORS"
                }
                badge={badgeGreen}
              />
              <InfoMini
                title="Address"
                value={getVendorAddress(selectedVendor)}
              />
            </>
          )}

          <InfoMini
            title="Date Range"
            value={`${fromDate || "START"} to ${toDate || "END"}`}
          />
        </div>
      </section>

      <div style={statGrid}>
        <Stat title="Opening Balance" value={money(totals.opening)} badge={badgeBlue} />
        <Stat title="Total Debit" value={money(totals.debit)} badge={badgeBlue} />
        <Stat title="Total Credit" value={money(totals.credit)} badge={badgeGreen} />
        <Stat title="Closing Balance" value={money(totals.closing)} strong />
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {mode === "CUSTOMER" ? "Customer Statement Rows" : "Vendor Statement Rows"}
            </h2>
            <p style={cardSubtitle}>Rows: {filteredRows.length}</p>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Doc No</th>
                <th style={th}>Type</th>
                <th style={thRight}>Debit</th>
                <th style={thRight}>Credit</th>
                <th style={thRight}>Balance</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={`${getRowDocNo(r, mode)}-${getRowType(r, mode)}-${i}`} style={tr}>
                  <td style={td}>{safeDisplayDate(getRowDate(r, mode))}</td>
                  <td style={tdCode}>{getRowDocNo(r, mode)}</td>
                  <td style={td}>{getRowType(r, mode)}</td>
                  <td style={tdRight}>{money(getRowDebit(r, mode))}</td>
                  <td style={tdRight}>{money(getRowCredit(r, mode))}</td>
                  <td style={{ ...tdRight, fontWeight: 900 }}>
                    {money(r?.balance || 0)}
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" style={emptyTd}>
                    No statement rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={footNote}>
          Statement is shown in date order with running balance. Opening balance is
          derived from the first row in the filtered range.
        </div>
      </section>

      <style>{printCss}</style>
    </div>
  );
}

function Stat({ title, value, strong = false, badge = null }) {
  return (
    <div style={statCard}>
      <div style={statHead}>
        <div style={statTitle}>{title}</div>
        {badge ? <span style={badge}>LIVE</span> : null}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: strong ? 950 : 900,
          color: "#111",
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoMini({ title, value, badge = null }) {
  return (
    <div style={miniCard}>
      <div style={miniHead}>
        <div style={miniTitle}>{title}</div>
        {badge ? <span style={badge}>LIVE</span> : null}
      </div>
      <div style={miniValue}>{value}</div>
    </div>
  );
}

function disabledLike(base) {
  return {
    ...base,
    opacity: 0.6,
    cursor: "not-allowed",
  };
}

const tabButton = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tabActiveBlue = {
  ...tabButton,
  background: "#eef4ff",
  color: "#0b5cff",
  border: "1px solid #b7cbff",
};

const tabActiveGreen = {
  ...tabButton,
  background: "#ecfff1",
  color: "#116b2f",
  border: "1px solid #a6e0b8",
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const actionRow = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const infoStrip = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  marginTop: 14,
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

const statHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const statTitle = {
  fontSize: 12,
  color: "#666",
};

const miniCard = {
  background: "#f7f8fa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
};

const miniHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const miniTitle = {
  fontSize: 12,
  color: "#666",
};

const miniValue = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111",
  marginTop: 4,
  wordBreak: "break-word",
};

const footNote = {
  marginTop: 12,
  fontSize: 12,
  color: "#666",
};

const printCss = `
@media print {
  body { background: white !important; }
  nav { display: none !important; }
  button, input, select, textarea { display: none !important; }
  #root { padding: 0 !important; }
}
`;