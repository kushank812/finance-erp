import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch } from "../api/client";

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

function isPendingLike(row) {
  const s = getStatus(row);
  return s === "PENDING" || s === "OVERDUE";
}

function canFullEditBill(row) {
  return isPendingLike(row) && !hasPayment(row) && !isCancelled(row);
}

function canRestrictedEditBill(row) {
  return isPartial(row) && !isCancelled(row);
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

export default function PurchaseBillView() {
  const nav = useNavigate();

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
      setRows(Array.isArray(data) ? data : []);
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
    <div style={{ maxWidth: 1250, margin: "0 auto", padding: 14 }}>
      <div style={pageHeader}>
        <div>
          <h2 style={{ margin: 0, color: "#fff" }}>Purchase Bill Management</h2>
          <p style={{ margin: "6px 0 0", color: "#b8b8b8" }}>
            Search, view, edit, cancel, and delete purchase bills.
          </p>
        </div>

        <div style={headerActions}>
          <button style={btnPrimary} onClick={() => nav("/purchase/new")}>
            + Create Bill
          </button>
        </div>
      </div>

      <form onSubmit={onSearch} style={filterCard}>
        <div style={filterGrid}>
          <div>
            <label style={label}>Search</label>
            <input
              style={input}
              placeholder="Bill No / Vendor Code"
              value={filters.q}
              onChange={(e) =>
                setFilters((s) => ({ ...s, q: e.target.value.toUpperCase() }))
              }
            />
          </div>

          <div>
            <label style={label}>From Date</label>
            <input
              type="date"
              style={input}
              value={filters.fromDate}
              onChange={(e) => setFilters((s) => ({ ...s, fromDate: e.target.value }))}
            />
          </div>

          <div>
            <label style={label}>To Date</label>
            <input
              type="date"
              style={input}
              value={filters.toDate}
              onChange={(e) => setFilters((s) => ({ ...s, toDate: e.target.value }))}
            />
          </div>

          <div>
            <label style={label}>Status</label>
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

        <div style={filterActions}>
          <button type="submit" style={btnPrimary} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>
          <button type="button" style={btnGhost} onClick={onReset} disabled={loading}>
            Reset
          </button>
        </div>
      </form>

      {err ? <div style={msgErr}>{err}</div> : null}
      {actionMsg ? <div style={msgOk}>{actionMsg}</div> : null}

      <div style={summaryGrid}>
        <SummaryCard title="Total Bills" value={summary.totalCount} />
        <SummaryCard title="Active Bills" value={summary.activeCount} />
        <SummaryCard title="Cancelled" value={summary.cancelledCount} />
        <SummaryCard title="Grand Total" value={summary.grandTotal} />
        <SummaryCard title="Outstanding Balance" value={summary.balanceTotal} />
      </div>

      <div style={infoCard}>
        <div style={infoTitle}>Real-life action rules</div>
        <div style={infoText}>
          PENDING / OVERDUE bills can be fully edited. PARTIAL bills can be edited
          in restricted mode only. PAID and CANCELLED bills are view-only. Cancel and
          Delete are allowed only when no payment exists.
        </div>
      </div>

      <div style={tableCard}>
        <div style={tableHeader}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#111" }}>Bills</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              {loading ? "Loading bills..." : `${rows.length} record(s) found`}
            </div>
          </div>

          <button
            style={btnGhost}
            onClick={() => loadBills(appliedFilters)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Bill No</th>
                <th style={th}>Bill Date</th>
                <th style={th}>Due Date</th>
                <th style={th}>Vendor</th>
                <th style={{ ...th, textAlign: "right" }}>Grand Total</th>
                <th style={{ ...th, textAlign: "right" }}>Paid</th>
                <th style={{ ...th, textAlign: "right" }}>Balance</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "center" }}>Actions</th>
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
                  const paymentExists = hasPayment(row);
                  const editAllowed = canEditBill(row);
                  const cancelAllowed = canCancelBill(row);
                  const deleteAllowed = canDeleteBill(row);
                  const editMode = getEditMode(row);
                  const busy = busyBillNo === billNo;

                  let editTitle = "Edit bill";
                  if (editMode === "RESTRICTED") {
                    editTitle = "Restricted edit only: non-financial fields only";
                  } else if (isCancelled(row)) {
                    editTitle = "Cancelled bill cannot be edited";
                  } else if (isPaid(row)) {
                    editTitle = "Paid bill cannot be edited";
                  } else if (paymentExists && !isPartial(row)) {
                    editTitle = "Bill with payment cannot be fully edited";
                  } else {
                    editTitle = "Full edit allowed";
                  }

                  let cancelTitle = "Cancel bill";
                  if (isCancelled(row)) {
                    cancelTitle = "Already cancelled";
                  } else if (paymentExists) {
                    cancelTitle = "Reverse payment(s) first before cancelling";
                  }

                  let deleteTitle = "Delete bill";
                  if (isCancelled(row)) {
                    deleteTitle = "Cancelled bill cannot be deleted";
                  } else if (paymentExists) {
                    deleteTitle = "Reverse payment(s) first before deleting";
                  }

                  return (
                    <tr key={billNo} style={tr}>
                      <td style={tdStrong}>{billNo}</td>
                      <td style={td}>{fmtDate(row.bill_date)}</td>
                      <td style={td}>{fmtDate(row.due_date)}</td>
                      <td style={td}>{row.vendor_code}</td>
                      <td style={tdRight}>{money(row.grand_total)}</td>
                      <td style={tdRight}>{money(row.amount_paid)}</td>
                      <td style={tdRight}>{money(row.balance)}</td>
                      <td style={td}>
                        <span style={statusBadge(status)}>{status}</span>
                      </td>
                      <td style={td}>
                        <div style={rowActionWrap}>
                          <button
                            type="button"
                            style={miniBtn}
                            onClick={() =>
                              nav(`/purchase/view/${encodeURIComponent(billNo)}`)
                            }
                          >
                            View
                          </button>

                          <button
                            type="button"
                            style={editAllowed ? miniBtnBlue : actionDisabledStyle(miniBtnBlue)}
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

                          <button
                            type="button"
                            style={
                              deleteAllowed
                                ? miniBtnDanger
                                : actionDisabledStyle(miniBtnDanger)
                            }
                            disabled={!deleteAllowed || busy}
                            title={deleteTitle}
                            onClick={() => onDeleteBill(billNo)}
                          >
                            {busy ? "Working..." : "Delete"}
                          </button>
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
          * Edit on PARTIAL bill means restricted edit only. Do not allow item lines,
          quantities, rates, tax, vendor, or grand total changes on the edit form.
        </div>
      </div>
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

const pageHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const headerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const filterCard = {
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 14,
  marginBottom: 14,
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const filterActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const label = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#444",
  marginBottom: 6,
};

const input = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #cfcfcf",
  background: "#fff",
  color: "#111",
  outline: "none",
  boxSizing: "border-box",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const summaryCard = {
  background: "#fff",
  border: "1px solid #e6e6e6",
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
  marginBottom: 14,
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

const tableCard = {
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 14,
};

const tableHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const table = {
  width: "100%",
  minWidth: 1120,
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  padding: "12px 10px",
  background: "#f7f8fa",
  color: "#444",
  fontSize: 13,
  fontWeight: 900,
  borderBottom: "1px solid #e6e6e6",
};

const tr = {
  borderBottom: "1px solid #efefef",
};

const td = {
  padding: "12px 10px",
  color: "#111",
  verticalAlign: "middle",
};

const tdStrong = {
  ...td,
  fontWeight: 900,
};

const tdRight = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const emptyTd = {
  padding: 18,
  textAlign: "center",
  color: "#666",
};

const rowActionWrap = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  flexWrap: "wrap",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
};

const miniBtn = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #cfcfcf",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontWeight: 800,
};

const miniBtnBlue = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #0b5cff",
  background: "#eef4ff",
  color: "#0b5cff",
  cursor: "pointer",
  fontWeight: 800,
};

const miniBtnWarning = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #d9a100",
  background: "#fff8e1",
  color: "#8a5a00",
  cursor: "pointer",
  fontWeight: 800,
};

const miniBtnDanger = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #d33",
  background: "#fff2f2",
  color: "#c40000",
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
  background: "#ecfff1",
  border: "1px solid #a6e0b8",
  padding: 10,
  borderRadius: 12,
  color: "#116b2f",
  marginBottom: 12,
};

const footNote = {
  marginTop: 12,
  fontSize: 12,
  color: "#666",
};

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
      border: "1px solid #d5d5d5",
    };
  }

  return {
    ...base,
    background: "#eef4ff",
    color: "#0b5cff",
    border: "1px solid #b7cbff",
  };
}