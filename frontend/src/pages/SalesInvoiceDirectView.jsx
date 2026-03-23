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
  return !isCancelled(row) && !hasReceipt(row);
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

export default function SalesInvoiceDirectView() {
  const nav = useNavigate();

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
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices(appliedFilters);
    // eslint-disable-next-line
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
    const ok = window.confirm(`Cancel invoice ${invoiceNo}?`);
    if (!ok) return;

    setBusyInvoiceNo(invoiceNo);

    try {
      await apiPatch(`/sales-invoices/${encodeURIComponent(invoiceNo)}/cancel`, {
        remark: "CANCELLED BY USER",
      });
      setActionMsg(`Invoice ${invoiceNo} cancelled.`);
      await loadInvoices(appliedFilters);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusyInvoiceNo("");
    }
  }

  async function onDeleteInvoice(invoiceNo) {
    const ok = window.confirm(`Delete invoice ${invoiceNo}?`);
    if (!ok) return;

    setBusyInvoiceNo(invoiceNo);

    try {
      await apiDelete(`/sales-invoices/${encodeURIComponent(invoiceNo)}`);
      setActionMsg(`Invoice ${invoiceNo} deleted.`);
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

    const grandTotal = rows.reduce((s, r) => s + Number(r.grand_total || 0), 0);
    const balanceTotal = rows.reduce((s, r) => s + Number(r.balance || 0), 0);

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
      />

      {/* FILTERS */}
      <form onSubmit={onSearch} style={card}>
        <h2 style={cardTitle}>Search Filters</h2>

        <input
          style={input}
          placeholder="Invoice No / Customer Code"
          value={filters.q}
          onChange={(e) =>
            setFilters((s) => ({ ...s, q: e.target.value.toUpperCase() }))
          }
        />

        <div style={actionBar}>
          <button style={btnPrimary}>Search</button>
          <button type="button" style={btnSecondary} onClick={onReset}>
            Reset
          </button>
        </div>
      </form>

      {/* SUMMARY */}
      <div style={{ display: "flex", gap: 12 }}>
        <div>Total: {summary.totalCount}</div>
        <div>Active: {summary.activeCount}</div>
        <div>Cancelled: {summary.cancelledCount}</div>
      </div>

      {/* ✅ FIXED HERE */}
      <div style={{ marginTop: 20 }}>
        <strong>Rules</strong>
        <p>
          PENDING / OVERDUE invoices can be fully edited. PARTIAL invoices can be
          edited in restricted mode only. PAID and CANCELLED invoices are view-only.
        </p>
      </div>

      {/* TABLE */}
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Invoice No</th>
            <th style={th}>Customer</th>
            <th style={thRight}>Total</th>
            <th style={thCenter}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.invoice_no}>
              <td style={tdCode}>{row.invoice_no}</td>
              <td style={td}>{row.customer_code}</td>
              <td style={tdRight}>{money(row.grand_total)}</td>
              <td style={tdCenter}>
                <button onClick={() => onEditInvoice(row)}>Edit</button>
                <button onClick={() => onCancelInvoice(row.invoice_no)}>Cancel</button>
                <button onClick={() => onDeleteInvoice(row.invoice_no)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}