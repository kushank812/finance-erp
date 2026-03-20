import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function safeJson(value) {
  if (!value) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function prettifyEnum(value) {
  if (!value) return "";
  return String(value).replaceAll("_", " ");
}

function normalizeOptions(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
}

function actionBadgeStyle(action) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.3,
    border: "1px solid rgba(255,255,255,0.12)",
    textTransform: "uppercase",
  };

  switch (action) {
    case "CREATE":
      return {
        ...base,
        color: "#9ff7b2",
        background: "rgba(30, 180, 90, 0.16)",
      };
    case "UPDATE":
      return {
        ...base,
        color: "#8fd3ff",
        background: "rgba(35, 120, 255, 0.16)",
      };
    case "DELETE":
      return {
        ...base,
        color: "#ff9c9c",
        background: "rgba(255, 70, 70, 0.16)",
      };
    case "DEACTIVATE":
      return {
        ...base,
        color: "#ffd48f",
        background: "rgba(255, 170, 40, 0.16)",
      };
    case "LOGIN":
    case "LOGOUT":
      return {
        ...base,
        color: "#d2b4ff",
        background: "rgba(146, 80, 255, 0.16)",
      };
    case "PASSWORD_CHANGE":
    case "PASSWORD_RESET":
      return {
        ...base,
        color: "#ffb7df",
        background: "rgba(255, 75, 160, 0.16)",
      };
    default:
      return {
        ...base,
        color: "#d8e2ff",
        background: "rgba(255,255,255,0.06)",
      };
  }
}

const fallbackModuleOptions = [
  "USER",
  "CUSTOMER",
  "VENDOR",
  "ITEM",
  "SALES_INVOICE",
  "PURCHASE_INVOICE",
  "RECEIPT",
  "VENDOR_PAYMENT",
  "AUTH",
];

const fallbackActionOptions = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "DEACTIVATE",
  "LOGIN",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "PASSWORD_RESET",
];

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);

  const [moduleOptions, setModuleOptions] = useState(fallbackModuleOptions);
  const [actionOptions, setActionOptions] = useState(fallbackActionOptions);

  const [filters, setFilters] = useState({
    user_id: "",
    module: "",
    action: "",
    record_id: "",
    date_from: "",
    date_to: "",
    limit: "100",
  });

  async function loadMeta() {
    try {
      setMetaLoading(true);

      const data = await apiGet("/audit-meta/");

      const nextModules = normalizeOptions(data?.modules);
      const nextActions = normalizeOptions(data?.actions);

      if (nextModules.length > 0) {
        setModuleOptions(nextModules);
      } else {
        setModuleOptions(fallbackModuleOptions);
      }

      if (nextActions.length > 0) {
        setActionOptions(nextActions);
      } else {
        setActionOptions(fallbackActionOptions);
      }
    } catch {
      setModuleOptions(fallbackModuleOptions);
      setActionOptions(fallbackActionOptions);
    } finally {
      setMetaLoading(false);
    }
  }

  async function loadLogs(customFilters = filters) {
    try {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();

      if (customFilters.user_id.trim()) {
        params.set("user_id", customFilters.user_id.trim().toUpperCase());
      }
      if (customFilters.module) {
        params.set("module", customFilters.module);
      }
      if (customFilters.action) {
        params.set("action", customFilters.action);
      }
      if (customFilters.record_id.trim()) {
        params.set("record_id", customFilters.record_id.trim().toUpperCase());
      }
      if (customFilters.date_from) {
        const start = new Date(customFilters.date_from);
        start.setHours(0, 0, 0, 0);
        params.set("date_from", start.toISOString());
      }
      if (customFilters.date_to) {
        const end = new Date(customFilters.date_to);
        end.setHours(23, 59, 59, 999);
        params.set("date_to", end.toISOString());
      }

      params.set("limit", customFilters.limit || "100");

      const data = await apiGet(`/audit/?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load audit logs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeta();
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function applyFilters(e) {
    e.preventDefault();
    setSelected(null);
    await loadLogs(filters);
  }

  async function resetFilters() {
    const fresh = {
      user_id: "",
      module: "",
      action: "",
      record_id: "",
      date_from: "",
      date_to: "",
      limit: "100",
    };
    setFilters(fresh);
    setSelected(null);
    await loadLogs(fresh);
  }

  const recordsLoadedText = useMemo(() => {
    if (loading) return "…";
    return String(rows.length);
  }, [loading, rows.length]);

  const visibleModuleOptions = useMemo(() => {
    return ["", ...moduleOptions];
  }, [moduleOptions]);

  const visibleActionOptions = useMemo(() => {
    return ["", ...actionOptions];
  }, [actionOptions]);

  return (
    <div style={pageWrap}>
      <div style={heroCard}>
        <div>
          <h1 style={heroTitle}>Audit Logs</h1>
          <p style={heroSub}>
            Track user actions across masters, transactions, payments, password
            changes, and authentication activity.
          </p>
        </div>

        <div style={summaryChip}>
          <div style={summaryValue}>{recordsLoadedText}</div>
          <div style={summaryLabel}>Records Loaded</div>
        </div>
      </div>

      <form onSubmit={applyFilters} style={filterCard}>
        <div style={sectionTitle}>Filters</div>

        <div style={filterGrid}>
          <Field label="User ID">
            <input
              value={filters.user_id}
              onChange={(e) => setFilter("user_id", e.target.value)}
              placeholder="ADMIN"
              style={inputStyle}
            />
          </Field>

          <Field label="Record ID">
            <input
              value={filters.record_id}
              onChange={(e) => setFilter("record_id", e.target.value)}
              placeholder="INV0001 / RCPT0001 / ADMIN"
              style={inputStyle}
            />
          </Field>

          <Field label="Date From">
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilter("date_from", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Date To">
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilter("date_to", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Limit">
            <select
              value={filters.limit}
              onChange={(e) => setFilter("limit", e.target.value)}
              style={inputStyle}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Module">
            <div style={chipBox(metaLoading)}>
              {visibleModuleOptions.map((opt) => {
                const label = opt ? prettifyEnum(opt) : "ALL MODULES";
                const active = filters.module === opt;

                return (
                  <button
                    key={opt || "__ALL_MODULES__"}
                    type="button"
                    onClick={() => setFilter("module", opt)}
                    disabled={metaLoading}
                    style={chipStyle(active)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Action">
            <div style={chipBox(metaLoading)}>
              {visibleActionOptions.map((opt) => {
                const label = opt ? prettifyEnum(opt) : "ALL ACTIONS";
                const active = filters.action === opt;

                return (
                  <button
                    key={opt || "__ALL_ACTIONS__"}
                    type="button"
                    onClick={() => setFilter("action", opt)}
                    disabled={metaLoading}
                    style={chipStyle(active)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div style={buttonRow}>
          <button type="submit" style={primaryBtn} disabled={loading}>
            {loading ? "Loading..." : "Apply Filters"}
          </button>

          <button
            type="button"
            onClick={resetFilters}
            style={secondaryBtn}
            disabled={loading}
          >
            Reset
          </button>
        </div>

        {err ? <div style={errorBox}>{err}</div> : null}
      </form>

      <div style={contentGrid(selected)}>
        <div style={tableCard}>
          <div style={cardHeaderRow}>
            <div style={sectionTitle}>Activity List</div>
            <div style={hintText}>Click a row to view full details</div>
          </div>

          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Module</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Record ID</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={emptyCell}>
                      Loading audit logs...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={emptyCell}>
                      No audit records found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isSelected = selected?.id === row.id;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelected(row)}
                        style={rowStyle(isSelected)}
                      >
                        <td style={tdStyle}>{fmtDateTime(row.created_at)}</td>
                        <td style={tdStyle}>{row.user_id || "—"}</td>
                        <td style={tdStyle}>
                          {prettifyEnum(row.module) || "—"}
                        </td>
                        <td style={tdStyle}>
                          <span style={actionBadgeStyle(row.action)}>
                            {prettifyEnum(row.action) || "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>{row.record_id || "—"}</td>
                        <td style={tdStyleDetails}>{row.details || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected ? (
          <div style={detailsCard}>
            <div style={cardHeaderRow}>
              <div style={sectionTitle}>Log Details</div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={closeBtn}
              >
                Close
              </button>
            </div>

            <Detail label="Log ID" value={selected.id} />
            <Detail label="Created At" value={fmtDateTime(selected.created_at)} />
            <Detail label="User ID" value={selected.user_id} />
            <Detail label="Module" value={prettifyEnum(selected.module)} />
            <Detail label="Action" value={prettifyEnum(selected.action)} />
            <Detail label="Record ID" value={selected.record_id} />
            <Detail label="Record Name" value={selected.record_name} />
            <Detail label="Details" value={selected.details} />
            <Detail label="IP Address" value={selected.ip_address} />
            <Detail label="User Agent" value={selected.user_agent} />

            <div style={{ marginTop: 18 }}>
              <div style={subHeading}>Old Values</div>
              <pre style={jsonBox}>{safeJson(selected.old_values)}</pre>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={subHeading}>New Values</div>
              <pre style={jsonBox}>{safeJson(selected.new_values)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={detailLabel}>{label}</div>
      <div style={detailValue}>{value || "—"}</div>
    </div>
  );
}

const pageWrap = {
  display: "grid",
  gap: 18,
};

const heroCard = {
  background: "linear-gradient(180deg, rgba(19,29,52,0.96), rgba(13,20,37,0.96))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 22,
  padding: 20,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
};

const heroTitle = {
  margin: 0,
  color: "#ffffff",
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const heroSub = {
  margin: "8px 0 0 0",
  color: "#9fb2d9",
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 760,
};

const summaryChip = {
  minWidth: 150,
  padding: "16px 18px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "center",
};

const summaryValue = {
  fontSize: 28,
  fontWeight: 900,
  color: "#ffffff",
  lineHeight: 1,
};

const summaryLabel = {
  marginTop: 6,
  fontSize: 12,
  color: "#97abd2",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const filterCard = {
  background: "rgba(14,22,39,0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
};

const sectionTitle = {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 14,
};

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  color: "#9fb2d9",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const chipBox = (disabled) => ({
  width: "100%",
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  boxSizing: "border-box",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  opacity: disabled ? 0.75 : 1,
});

const chipStyle = (active) => ({
  border: active
    ? "1px solid rgba(75,130,255,0.70)"
    : "1px solid rgba(255,255,255,0.12)",
  background: active
    ? "linear-gradient(180deg, #2b6cff, #1147c8)"
    : "rgba(255,255,255,0.05)",
  color: "#ffffff",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: 0.4,
});

const buttonRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const primaryBtn = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid rgba(75,130,255,0.45)",
  background: "linear-gradient(180deg, #2b6cff, #1147c8)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#d6e1ff",
  fontWeight: 800,
  cursor: "pointer",
};

const errorBox = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  background: "rgba(255, 70, 70, 0.14)",
  border: "1px solid rgba(255, 90, 90, 0.24)",
  color: "#ffb5b5",
  fontWeight: 700,
};

const contentGrid = (selected) => ({
  display: "grid",
  gridTemplateColumns: selected ? "1.45fr 1fr" : "1fr",
  gap: 18,
});

const tableCard = {
  background: "rgba(14,22,39,0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const detailsCard = {
  background: "rgba(14,22,39,0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
  height: "fit-content",
};

const cardHeaderRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 14,
};

const hintText = {
  color: "#8ea6d6",
  fontSize: 12,
  fontWeight: 700,
};

const tableWrap = {
  overflowX: "auto",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
  background: "rgba(255,255,255,0.02)",
};

const thStyle = {
  textAlign: "left",
  padding: "14px 12px",
  background: "rgba(255,255,255,0.04)",
  color: "#9fb2d9",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "12px 12px",
  color: "#e8efff",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  verticalAlign: "top",
};

const tdStyleDetails = {
  ...tdStyle,
  minWidth: 260,
  color: "#c9d7f7",
};

const rowStyle = (selected) => ({
  cursor: "pointer",
  background: selected ? "rgba(48, 101, 255, 0.14)" : "transparent",
});

const emptyCell = {
  padding: 28,
  textAlign: "center",
  color: "#a3b4d8",
  fontWeight: 700,
};

const closeBtn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#d6e1ff",
  fontWeight: 800,
  cursor: "pointer",
};

const detailLabel = {
  color: "#8ea6d6",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 4,
};

const detailValue = {
  color: "#ffffff",
  fontSize: 14,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const subHeading = {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 8,
};

const jsonBox = {
  margin: 0,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#d9e5ff",
  fontSize: 12,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 260,
  overflow: "auto",
};