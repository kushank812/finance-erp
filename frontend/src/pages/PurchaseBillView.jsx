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
  return String(value);
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

function hasPayment(row) {
  return Number(row?.amount_paid || 0) > 0;
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

function canFullEditBill(row) {
  return !isCancelled(row) && !isPaid(row) && !hasPayment(row);
}

function canRestrictedEditBill(row) {
  return !isCancelled(row) && isPartial(row);
}

function canEditBill(row) {
  return canFullEditBill(row) || canRestrictedEditBill(row);
}

function canCancelBill(row) {
  return !isCancelled(row) && !hasPayment(row);
}

function canDeleteBill(row) {
  return !isCancelled(row) && !hasPayment(row);
}

function getEditMode(row) {
  if (canFullEditBill(row)) return "FULL";
  if (canRestrictedEditBill(row)) return "RESTRICTED";
  return "NONE";
}

function actionDisabledStyle(baseStyle) {
  return {
    ...baseStyle,
    opacity: 0.5,
    cursor: "not-allowed",
  };
}

function sortBillsLatestFirst(rows) {
  return [...rows].sort((a, b) => {
    const dateA = a?.bill_date ? new Date(a.bill_date).getTime() : 0;
    const dateB = b?.bill_date ? new Date(b.bill_date).getTime() : 0;

    if (dateB !== dateA) return dateB - dateA;

    const noA = String(a?.bill_no || "");
    const noB = String(b?.bill_no || "");
    return noB.localeCompare(noA, undefined, { numeric: true, sensitivity: "base" });
  });
}

export default function PurchaseBillView({ currentUser }) {
  const nav = useNavigate();
  const isViewer = currentUser?.role === "VIEWER";
  const isAdmin = currentUser?.role === "ADMIN";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busyBillNo, setBusyBillNo] = useState("");

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

  async function loadBills(activeFilters = appliedFilters) {
    setLoading(true);
    setErr("");
    setActionMsg("");

    try {
      const query = buildQuery(activeFilters);
      const data = await apiGet(`/purchase-invoices${query}`);
      const safeRows = Array.isArray(data) ? data : [];
      setRows(sortBillsLatestFirst(safeRows));
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e) {
    e?.preventDefault?.();
    setAppliedFilters(filters);
    await loadBills(filters);
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
    await loadBills(cleared);
  }

  function onEditBill(row) {
    const billNo = row.bill_no;
    const editMode = getEditMode(row);

    if (editMode === "NONE") return;

    nav(`/purchase/edit/${encodeURIComponent(billNo)}`, {
      state: {
        editMode,
        billStatus: getStatus(row),
        hasPayment: hasPayment(row),
      },
    });
  }

  async function onCancelBill(billNo) {
    const ok = window.confirm(
      `Are you sure you want to cancel bill ${billNo}?\n\nThis is allowed only if no payment exists.\nThe bill will remain in the system with CANCELLED status.`
    );
    if (!ok) return;

    setBusyBillNo(billNo);
    setErr("");
    setActionMsg("");

    try {
      await apiPatch(`/purchase-invoices/${encodeURIComponent(billNo)}/cancel`, {
        remark: "CANCELLED BY USER",
      });
      setActionMsg(`Bill ${billNo} cancelled successfully.`);
      await loadBills(appliedFilters);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusyBillNo("");
    }
  }

  async function onDeleteBill(billNo) {
    const ok = window.confirm(
      `Are you sure you want to delete bill ${billNo}?\n\nDelete is allowed only when no payment exists.\nUse delete only for wrong entry / mistaken bill.\nThis action cannot be undone.`
    );
    if (!ok) return;

    setBusyBillNo(billNo);
    setErr("");
    setActionMsg("");

    try {
      await apiDelete(`/purchase-invoices/${encodeURIComponent(billNo)}`);
      setActionMsg(`Bill ${billNo} deleted successfully.`);
      await loadBills(appliedFilters);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusyBillNo("");
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
        eyebrowText="PURCHASE"
        title="Purchase Bill Management"
        subtitle="Search, view, edit, cancel, and delete purchase bills."
        actions={
          !isViewer ? (
            <button
              style={btnPrimary}
              onClick={() => nav("/purchase")}
              type="button"
            >
              + Create Bill
            </button>
          ) : null
        }
      />

      <form onSubmit={onSearch} style={filterCard}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Search Filters</h2>
            <p style={cardSubtitle}>
              Filter bills by search text, date range, and status.
            </p>
          </div>
        </div>

        <div style={filterGrid}>
          <div style={field}>
            <label style={labelStyle}>Search</label>
            <input
              style={input}
              placeholder="Bill No / Vendor Code"
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
              onChange={(e) =>
                setFilters((s) => ({ ...s, fromDate: e.target.value }))
              }
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
        <SummaryCard title="Total Bills" value={summary.totalCount} />
        <SummaryCard title="Active Bills" value={summary.activeCount} />
        <SummaryCard title="Cancelled" value={summary.cancelledCount} />
        <SummaryCard title="Grand Total" value={summary.grandTotal} />
        <SummaryCard title="Outstanding Balance" value={summary.balanceTotal} />
      </div>

      <div style={infoCard}>
        <div style={infoTitle}>Rules</div>
        <div style={infoText}>
          Latest bills are shown first. PENDING / OVERDUE bills can be fully edited.
          PARTIAL bills can be edited in restricted mode only. PAID and CANCELLED
          bills are view-only. Cancel is allowed only when no payment exists. Delete
          is allowed only for ADMIN when no payment exists.
        </div>
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Bills</h2>
            <p style={cardSubtitle}>
              {loading ? "Loading bills..." : `${rows.length} record(s) found`}
            </p>
          </div>

          <button
            style={btnGhost}
            onClick={() => loadBills(appliedFilters)}
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
                <th style={th}>Bill No</th>
                <th style={th}>Bill Date</th>
                <th style={th}>Due Date</th>
                <th style={th}>Vendor</th>
                <th style={thRight}>Grand Total</th>
                <th style={thRight}>Paid</th>
                <th style={thRight}>Balance</th>
                <th style={th}>Status</th>
                <th style={thCenter}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="9" style={emptyTd}>
                    No bills found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const billNo = row.bill_no;
                  const status = getStatus(row);
                  const cancelled = isCancelled(row);
                  const paymentExists = hasPayment(row);
                  const editAllowed = canEditBill(row);
                  const cancelAllowed = canCancelBill(row);
                  const deleteAllowed = canDeleteBill(row);
                  const busy = busyBillNo === billNo;
                  const editMode = getEditMode(row);

                  let editTitle = "Edit bill";
                  if (editMode === "RESTRICTED") {
                    editTitle = "Restricted edit only: non-financial fields only";
                  } else if (cancelled) {
                    editTitle = "Cancelled bill cannot be edited";
                  } else if (isPaid(row)) {
                    editTitle = "Paid bill cannot be edited";
                  } else {
                    editTitle = "Full edit allowed";
                  }

                  let cancelTitle = "Cancel bill";
                  if (cancelled) cancelTitle = "Already cancelled";
                  else if (paymentExists)
                    cancelTitle = "Reverse payment(s) first before cancelling";

                  let deleteTitle = "Delete bill";
                  if (!isAdmin) deleteTitle = "Only ADMIN can delete bills";
                  else if (cancelled) deleteTitle = "Cancelled bill cannot be deleted";
                  else if (paymentExists)
                    deleteTitle = "Reverse payment(s) first before deleting";

                  return (
                    <tr key={billNo} style={tr}>
                      <td style={tdCode}>{billNo}</td>
                      <td style={td}>{fmtDate(row.bill_date)}</td>
                      <td style={td}>{fmtDate(row.due_date)}</td>
                      <td style={td}>{row.vendor_code}</td>
                      <td style={tdRight}>{money(row.grand_total)}</td>
                      <td style={tdRight}>{money(row.amount_paid)}</td>
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
                              nav(`/purchase/view/${encodeURIComponent(billNo)}`)
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
                                onClick={() => onEditBill(row)}
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
                                onClick={() => onCancelBill(billNo)}
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
                                  onClick={() => onDeleteBill(billNo)}
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
          * Edit on PARTIAL bill means restricted edit only. Do not allow item
          lines, quantities, rates, tax, vendor, or grand total changes on the edit
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