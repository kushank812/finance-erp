import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/client";

import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import {
  page,
  stack,
  btnPrimary,
  btnSecondary,
} from "../components/ui/uiStyles";

function money(n) {
  return Number(n || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatReason(value) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

function badgeStyle(status) {
  const s = String(status || "").toUpperCase();

  if (s === "POSTED" || s === "ACTIVE") {
    return {
      ...statusBadgeBase,
      background: "#ecfdf5",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (s === "CANCELLED") {
    return {
      ...statusBadgeBase,
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  if (s === "DRAFT") {
    return {
      ...statusBadgeBase,
      background: "#fff7ed",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  return {
    ...statusBadgeBase,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

export default function JournalVoucherList() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);

    try {
      const data = await apiGet("/journal-vouchers/");
      const safeRows = Array.isArray(data) ? data : [];

      const sorted = [...safeRows].sort((a, b) => {
        const dateA = String(a?.voucher_date || "");
        const dateB = String(b?.voucher_date || "");
        if (dateB !== dateA) return dateB.localeCompare(dateA);

        return String(b?.voucher_no || "").localeCompare(
          String(a?.voucher_no || ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      });

      setRows(sorted);
    } catch (e) {
      setErr(String(e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="JOURNAL VOUCHER"
        title="Journal Voucher List"
        subtitle="View all adjustment vouchers"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/journal-voucher/new")}
              style={btnPrimary}
              disabled={loading}
            >
              Create JV
            </button>

            <button
              type="button"
              onClick={load}
              style={btnSecondary}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {loading ? <AlertBox kind="info" message="Loading JV list..." /> : null}
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>JV No</th>
              <th style={th}>Date</th>
              <th style={th}>Reference Type</th>
              <th style={th}>Reference No</th>
              <th style={th}>Party</th>
              <th style={th}>Amount</th>
              <th style={th}>Reason</th>
              <th style={th}>Status</th>
              <th style={th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td style={tdCenter} colSpan={9}>
                  {loading ? "Loading..." : "No Journal Vouchers found."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.voucher_no} style={trRow}>
                  <td style={tdStrong}>{r.voucher_no || "-"}</td>
                  <td style={td}>{formatDate(r.voucher_date)}</td>
                  <td style={td}>{r.reference_type || "-"}</td>
                  <td style={td}>{r.reference_no || "-"}</td>
                  <td style={td}>{r.party_code || "-"}</td>
                  <td style={tdRight}>{money(r.amount)}</td>
                  <td style={td}>{formatReason(r.reason_code)}</td>
                  <td style={td}>
                    <span style={badgeStyle(r.status)}>{r.status || "-"}</span>
                  </td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/journal-voucher/view/${encodeURIComponent(r.voucher_no)}`
                        )
                      }
                      style={btnMini}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tableWrap = {
  width: "100%",
  overflowX: "auto",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
};

const table = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const trRow = {
  background: "#ffffff",
};

const td = {
  padding: "12px 14px",
  borderBottom: "1px solid #eef2f7",
  color: "#0f172a",
  fontSize: 14,
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
  fontWeight: 800,
};

const tdCenter = {
  ...td,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const btnMini = {
  border: "1px solid #cbd5e1",
  background: "#eff6ff",
  color: "#0b5cff",
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const statusBadgeBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 90,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};