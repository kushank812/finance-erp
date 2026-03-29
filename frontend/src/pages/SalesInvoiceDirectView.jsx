import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch } from "../api/client";
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
  actionBar,
  saveActions,
  tableWrap,
  table,
  th,
  thCenter,
  thRight,
  tr,
  td,
  tdCode,
  tdCenter,
  tdRight,
  emptyTd,
  btnPrimary,
  btnSecondary,
  btnGhost,
  btnMini,
  btnDangerMini,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function fmtDate(value) {
  if (!value) return "-";
  const s = String(value).trim();
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return s;
  return `${dd}/${mm}/${yyyy}`;
}

function buildQuery(params) {
  const qs = new URLSearchParams();

  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.fromDate) qs.set("from_date", params.fromDate);
  if (params.toDate) qs.set("to_date", params.toDate);
  if (params.status) qs.set("status", params.status);

  const s = qs.toString();
  return s ? `?${s}` : "";
}

function getStatus(row) {
  return String(row?.status || "").toUpperCase();
}

function hasReceipt(row) {
  return Number(row?.amount_received || 0) > 0;
}

function isCancelled(row) {
  return getStatus(row) === "CANCELLED";
}

function isPaid(row) {
  return getStatus(row) === "PAID";
}

function isPartial(row) {
  return getStatus(row) === "PARTIAL";
}

function canFullEditInvoice(row) {
  return !isCancelled(row) && !isPaid(row) && !hasReceipt(row);
}

function canRestrictedEditInvoice(row) {
  return !isCancelled(row) && isPartial(row);
}

function canEditInvoice(row) {
  return canFullEditInvoice(row) || canRestrictedEditInvoice(row);
}

function canCancelInvoice(row) {
  return !isCancelled(row) && !hasReceipt(row);
}

function canDeleteInvoice(row) {
  return !isCancelled(row) && Number(row?.balance || 0) === 0;
}

function getEditMode(row) {
  if (canFullEditInvoice(row)) return "FULL";
  if (canRestrictedEditInvoice(row)) return "RESTRICTED";
  return "NONE";
}

function actionDisabledStyle(baseStyle) {
  return {
    ...baseStyle,
    opacity: 0.5,
    cursor: "not-allowed",
  };
}

function sortInvoicesLatestFirst(rows) {
  return [...rows].sort((a, b) => {
    const dateA = a?.invoice_date ? new Date(a.invoice_date).getTime() : 0;
    const dateB = b?.invoice_date ? new Date(b.invoice_date).getTime() : 0;

    if (dateB !== dateA) return dateB - dateA;

    const noA = String(a?.invoice_no || "");
    const noB = String(b?.invoice_no || "");
    return noB.localeCompare(noA, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export default function SalesInvoiceDirectView({ currentUser }) {
  const nav = useNavigate();
  const isViewer = currentUser?.role === "VIEWER";
  const isAdmin = currentUser?.role === "ADMIN";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busyInvoiceNo, setBusyInvoiceNo] = useState("");

  const [filters, setFilters] = useState({
    q: "",
    fromDate: "",
    toDate: "",
    status: "",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    q: "",
    fromDate: "",
    toDate: "",
    status: "",
  });

  async function loadInvoices(activeFilters = appliedFilters) {
    setLoading(true);
    setErr("");
    setActionMsg("");

    try {
      const query = buildQuery(activeFilters);
      const data = await apiGet(`/sales-invoices${query}`);
      const safeRows = Array.isArray(data) ? data : [];
      setRows(sortInvoicesLatestFirst(safeRows));
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e) {
    e?.preventDefault?.();
    setAppliedFilters(filters);
    await loadInvoices(filters);
  }

  async function onReset() {
    const cleared = {
      q: "",
      fromDate: "",
      toDate: "",
      status: "",
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
    await loadInvoices(cleared);
  }

  function onEditInvoice(row) {
    const invoiceNo = row.invoice_no;
    const editMode = getEditMode(row);

    if (editMode === "NONE") return;

    nav(`/billing/edit/${encodeURIComponent(invoiceNo)}`, {
      state: {
        editMode,
        invoiceStatus: getStatus(row),
        hasReceipt: hasReceipt(row),
      },
    });
  }

  async function onCancelInvoice(invoiceNo) {
    const ok = window.confirm(
      `Are you sure you want to cancel invoice ${invoiceNo}?\n\nThis is allowed only if no receipt exists.\nThe invoice will remain in the system with CANCELLED status.`
    );
    if (!ok) return;

    setBusyInvoiceNo(invoiceNo);
    setErr("");
    setActionMsg("");

    try {
      await apiPatch(`/sales-invoices/${encodeURIComponent(invoiceNo)}/cancel`, {
        remark: "CANCELLED BY USER",
      });
      setActionMsg(`Invoice ${invoiceNo} cancelled successfully.`);
      await loadInvoices(appliedFilters);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusyInvoiceNo("");
    }
  }

  async function onDeleteInvoice(invoiceNo) {
    const ok = window.confirm(
      `Are you sure you want to delete invoice ${invoiceNo}?\n\nDelete is allowed only when balance is 0.\nAll linked receipts will be automatically deleted.\nThis action cannot be undone.`
    );
    if (!ok) return;

    setBusyInvoiceNo(invoiceNo);
    setErr("");
    setActionMsg("");

    try {
      await apiDelete(`/sales-invoices/${encodeURIComponent(invoiceNo)}`);
      setActionMsg(`Invoice ${invoiceNo} deleted successfully.`);
      await loadInvoices(appliedFilters);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusyInvoiceNo("");
    }
  }

  const summary = useMemo(() => {
    const totalCount = rows.length;
    const activeCount = rows.filter((r) => getStatus(r) !== "CANCELLED").length;
    const cancelledCount = rows.filter((r) => getStatus(r) === "CANCELLED").length;

    const grandTotal = rows.reduce((sum, r) => sum + Number(r.grand_total || 0), 0);
    const balanceTotal = rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);

    return {
      totalCount,
      activeCount,
      cancelledCount,
      grandTotal: money(grandTotal),
      balanceTotal: money(balanceTotal),
    };
  }, [rows]);

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="BILLING"
        title="Sales Invoice Management"
        subtitle="Search, view, edit, cancel, and delete sales invoices."
        actions={
          !isViewer ? (
            <button style={btnPrimary} onClick={() => nav("/billing")} type="button">
              + Create Invoice
            </button>
          ) : null
        }
      />

      <form onSubmit={onSearch} style={filterCard}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Search Filters</h2>
            <p style={cardSubtitle}>
              Filter invoices by search text, date range, and status.
            </p>
          </div>
        </div>

        <div style={filterGrid}>
          <div style={field}>
            <label style={labelStyle}>Search</label>
            <input
              style={input}
              placeholder="Invoice No / Customer Code"
              value={filters.q}
              onChange={(e) =>
                setFilters((s) => ({ ...s, q: e.target.value.toUpperCase() }))
              }
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>From Date</label>
            <input
              type="date"
              style={input}
              value={filters.fromDate}
              onChange={(e) => setFilters((s) => ({ ...s, fromDate: e.target.value }))}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>To Date</label>
            <input
              type="date"
              style={input}
              value={filters.toDate}
              onChange={(e) => setFilters((s) => ({ ...s, toDate: e.target.value }))}
            />
          </div>

          <div style={field}>
            <label style={labelStyle}>Status</label>
            <select
              style={input}
              value={filters.status}
              onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}
            >
              <option value="">ALL</option>
              <option value="PENDING">PENDING</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <div style={actionBar}>
          <div style={saveActions}>
            <button type="submit" style={btnPrimary} disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </button>
            <button type="button" style={btnSecondary} onClick={onReset} disabled={loading}>
              Reset
            </button>
          </div>
        </div>
      </form>

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {actionMsg ? <AlertBox kind="success" message={actionMsg} /> : null}
      </div>

      <div style={summaryGrid}>
        <SummaryCard title="Total Invoices" value={summary.totalCount} />
        <SummaryCard title="Active Invoices" value={summary.activeCount} />
        <SummaryCard title="Cancelled" value={summary.cancelledCount} />
        <SummaryCard title="Grand Total" value={summary.grandTotal} />
        <SummaryCard title="Outstanding Balance" value={summary.balanceTotal} />
      </div>

      <div style={infoCard}>
        <div style={infoTitle}>Rules</div>
        <div style={infoText}>
          Latest invoices are shown first. PENDING / OVERDUE invoices can be fully
          edited. PARTIAL invoices can be edited in restricted mode only. PAID and
          CANCELLED invoices are view-only. Cancel is allowed only when no receipt
          exists. Delete is allowed only for ADMIN when balance is 0, and linked
          receipts will be deleted automatically.
        </div>
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Invoices</h2>
            <p style={cardSubtitle}>
              {loading ? "Loading invoices..." : `${rows.length} record(s) found`}
            </p>
          </div>

          <button
            style={btnGhost}
            onClick={() => loadInvoices(appliedFilters)}
            disabled={loading}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 1120 }}>
            <thead>
              <tr>
                <th style={th}>Invoice No</th>
                <th style={th}>Invoice Date</th>
                <th style={th}>Due Date</th>
                <th style={th}>Customer</th>
                <th style={thRight}>Grand Total</th>
                <th style={thRight}>Received</th>
                <th style={thRight}>Balance</th>
                <th style={th}>Status</th>
                <th style={thCenter}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="9" style={emptyTd}>
                    No invoices found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const invoiceNo = row.invoice_no;
                  const status = getStatus(row);
                  const cancelled = isCancelled(row);
                  const receiptExists = hasReceipt(row);
                  const editAllowed = canEditInvoice(row);
                  const cancelAllowed = canCancelInvoice(row);
                  const deleteAllowed = canDeleteInvoice(row);
                  const busy = busyInvoiceNo === invoiceNo;
                  const editMode = getEditMode(row);

                  let editTitle = "Edit invoice";
                  if (editMode === "RESTRICTED") {
                    editTitle = "Restricted edit only: non-financial fields only";
                  } else if (cancelled) {
                    editTitle = "Cancelled invoice cannot be edited";
                  } else if (isPaid(row)) {
                    editTitle = "Paid invoice cannot be edited";
                  } else {
                    editTitle = "Full edit allowed";
                  }

                  let cancelTitle = "Cancel invoice";
                  if (cancelled) cancelTitle = "Already cancelled";
                  else if (receiptExists)
                    cancelTitle = "Reverse receipt(s) first before cancelling";

                  let deleteTitle = "Delete invoice";
                  if (!isAdmin) {
                    deleteTitle = "Only ADMIN can delete invoices";
                  } else if (cancelled) {
                    deleteTitle = "Cancelled invoice cannot be deleted";
                  } else if (Number(row.balance || 0) !== 0) {
                    deleteTitle = "Invoice can be deleted only when balance is 0";
                  } else {
                    deleteTitle =
                      "Delete allowed. Linked receipts will be automatically deleted.";
                  }

                  return (
                    <tr key={invoiceNo} style={tr}>
                      <td style={tdCode}>{invoiceNo}</td>
                      <td style={td}>{fmtDate(row.invoice_date)}</td>
                      <td style={td}>{fmtDate(row.due_date)}</td>
                      <td style={td}>{row.customer_code}</td>
                      <td style={tdRight}>{money(row.grand_total)}</td>
                      <td style={tdRight}>{money(row.amount_received)}</td>
                      <td style={tdRight}>{money(row.balance)}</td>
                      <td style={td}>
                        <span style={statusBadge(status)}>{status}</span>
                      </td>
                      <td style={tdCenter}>
                        <div style={rowActionWrap}>
                          <button
                            type="button"
                            style={btnMini}
                            onClick={() =>
                              nav(`/sales-invoice-view/${encodeURIComponent(invoiceNo)}`)
                            }
                          >
                            View
                          </button>

                          {!isViewer && (
                            <>
                              <button
                                type="button"
                                style={
                                  editAllowed
                                    ? miniBtnBlue
                                    : actionDisabledStyle(miniBtnBlue)
                                }
                                disabled={!editAllowed || busy}
                                title={editTitle}
                                onClick={() => onEditInvoice(row)}
                              >
                                {editMode === "RESTRICTED" ? "Edit*" : "Edit"}
                              </button>

                              <button
                                type="button"
                                style={
                                  cancelAllowed
                                    ? miniBtnWarning
                                    : actionDisabledStyle(miniBtnWarning)
                                }
                                disabled={!cancelAllowed || busy}
                                title={cancelTitle}
                                onClick={() => onCancelInvoice(invoiceNo)}
                              >
                                {busy ? "Working..." : "Cancel"}
                              </button>

                              {isAdmin && (
                                <button
                                  type="button"
                                  style={
                                    deleteAllowed
                                      ? btnDangerMini
                                      : actionDisabledStyle(btnDangerMini)
                                  }
                                  disabled={!deleteAllowed || busy}
                                  title={deleteTitle}
                                  onClick={() => onDeleteInvoice(invoiceNo)}
                                >
                                  {busy ? "Working..." : "Delete"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={footNote}>
          * Edit on PARTIAL invoice means restricted edit only. Do not allow item
          lines, quantities, rates, tax, customer, or grand total changes on the edit
          form.
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div style={summaryCard}>
      <div style={summaryTitle}>{title}</div>
      <div style={summaryValue}>{value}</div>
    </div>
  );
}

function statusBadge(status) {
  const s = String(status || "").toUpperCase();

  const base = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  };

  if (s === "PAID") {
    return {
      ...base,
      background: "#ecfff1",
      color: "#116b2f",
      border: "1px solid #a6e0b8",
    };
  }

  if (s === "PARTIAL") {
    return {
      ...base,
      background: "#fff8e8",
      color: "#8a5a00",
      border: "1px solid #edd28a",
    };
  }

  if (s === "OVERDUE") {
    return {
      ...base,
      background: "#fff2f2",
      color: "#c40000",
      border: "1px solid #efb0b0",
    };
  }

  if (s === "CANCELLED") {
    return {
      ...base,
      background: "#f0f0f0",
      color: "#555",
      border: "1px solid #d5d5dd",
    };
  }

  return {
    ...base,
    background: "#eef4ff",
    color: "#0b5cff",
    border: "1px solid #b7cbff",
  };
}

const filterCard = {
  ...card,
  gap: 14,
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryCard = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
};

const summaryTitle = {
  fontSize: 12,
  color: "#666",
  fontWeight: 800,
};

const summaryValue = {
  marginTop: 8,
  fontSize: 22,
  fontWeight: 900,
  color: "#111",
};

const infoCard = {
  background: "#f8fbff",
  border: "1px solid #dbe8ff",
  borderRadius: 16,
  padding: 14,
};

const infoTitle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0b3d91",
  marginBottom: 6,
};

const infoText = {
  fontSize: 13,
  color: "#28456b",
  lineHeight: 1.5,
};

const rowActionWrap = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  flexWrap: "wrap",
};

const miniBtnBlue = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0b5cff",
  background: "#eef4ff",
  color: "#0b5cff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const miniBtnWarning = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #d9a100",
  background: "#fff8e1",
  color: "#8a5a00",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const footNote = {
  marginTop: 12,
  fontSize: 12,
  color: "#666",
};