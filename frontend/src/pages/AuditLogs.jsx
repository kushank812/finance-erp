import { useEffect, useMemo, useRef, useState } from "react";
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

function parseUserAgent(ua) {
  if (!ua) {
    return {
      browser: "—",
      os: "—",
      device: "—",
      summary: "—",
      raw: "—",
    };
  }

  const text = String(ua);

  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let device = "Desktop";

  if (/Edg\//i.test(text)) browser = "Microsoft Edge";
  else if (/OPR\//i.test(text) || /Opera/i.test(text)) browser = "Opera";
  else if (/Chrome\//i.test(text) && !/Edg\//i.test(text)) browser = "Chrome";
  else if (/Firefox\//i.test(text)) browser = "Firefox";
  else if (/Safari\//i.test(text) && !/Chrome\//i.test(text)) browser = "Safari";

  if (/Windows NT 10\.0/i.test(text)) os = "Windows 10/11";
  else if (/Windows/i.test(text)) os = "Windows";
  else if (/Android/i.test(text)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(text)) os = "iOS";
  else if (/Mac OS X/i.test(text)) os = "macOS";
  else if (/Linux/i.test(text)) os = "Linux";

  if (/Tablet|iPad/i.test(text)) device = "Tablet";
  else if (/Mobile/i.test(text)) device = "Mobile";
  else device = "Desktop";

  return {
    browser,
    os,
    device,
    summary: `${browser} • ${os} • ${device}`,
    raw: text,
  };
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

      setModuleOptions(nextModules.length > 0 ? nextModules : fallbackModuleOptions);
      setActionOptions(nextActions.length > 0 ? nextActions : fallbackActionOptions);
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

  const parsedAgent = useMemo(() => parseUserAgent(selected?.user_agent), [selected]);

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
            <textarea
              value={filters.user_id}
              onChange={(e) => setFilter("user_id", e.target.value)}
              placeholder="ADMIN"
              rows={1}
              style={userIdScrollBox}
            />
          </Field>

          <Field label="Module">
            <InlineDropdown
              value={filters.module}
              onChange={(value) => setFilter("module", value)}
              options={[
                { value: "", label: "ALL MODULES" },
                ...moduleOptions.map((opt) => ({
                  value: opt,
                  label: prettifyEnum(opt),
                })),
              ]}
              placeholder="ALL MODULES"
              disabled={metaLoading}
            />
          </Field>

          <Field label="Action">
            <InlineDropdown
              value={filters.action}
              onChange={(value) => setFilter("action", value)}
              options={[
                { value: "", label: "ALL ACTIONS" },
                ...actionOptions.map((opt) => ({
                  value: opt,
                  label: prettifyEnum(opt),
                })),
              ]}
              placeholder="ALL ACTIONS"
              disabled={metaLoading}
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
            <InlineDropdown
              value={filters.limit}
              onChange={(value) => setFilter("limit", value)}
              options={[
                { value: "50", label: "50" },
                { value: "100", label: "100" },
                { value: "200", label: "200" },
                { value: "500", label: "500" },
              ]}
              placeholder="100"
            />
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
            <Detail label="User ID" value={selected.user_id} scrollable />
            <Detail label="Module" value={prettifyEnum(selected.module)} />
            <Detail label="Action" value={prettifyEnum(selected.action)} />
            <Detail label="Record ID" value={selected.record_id} scrollable />
            <Detail label="Record Name" value={selected.record_name} scrollable />
            <Detail label="Details" value={selected.details} scrollable />

            <div style={infoPanel}>
              <div style={infoPanelTitle}>Device & Session</div>

              <div style={infoGrid}>
                <MiniInfoCard label="Browser" value={parsedAgent.browser} />
                <MiniInfoCard label="Operating System" value={parsedAgent.os} />
                <MiniInfoCard label="Device" value={parsedAgent.device} />
                <MiniInfoCard
                  label="IP Address"
                  value={selected.ip_address || "—"}
                  scrollable
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={detailLabel}>User Agent Summary</div>
                <div style={agentSummaryBox}>{parsedAgent.summary}</div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={detailLabel}>Raw User Agent</div>
                <div style={scrollValueBox}>{parsedAgent.raw}</div>
              </div>
            </div>

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

function Detail({ label, value, scrollable = false }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={detailLabel}>{label}</div>
      <div style={scrollable ? scrollValueBox : detailValue}>{value || "—"}</div>
    </div>
  );
}

function MiniInfoCard({ label, value, scrollable = false }) {
  return (
    <div style={miniInfoCard}>
      <div style={miniInfoLabel}>{label}</div>
      <div style={scrollable ? miniInfoValueScroll : miniInfoValue}>
        {value || "—"}
      </div>
    </div>
  );
}

function InlineDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const visibleLabel = selectedOption?.label || placeholder;

  return (
    <div ref={wrapRef} style={dropdownWrap}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        disabled={disabled}
        style={dropdownTrigger(open, disabled)}
      >
        <span style={dropdownValue}>{visibleLabel}</span>
        <span style={dropdownArrow(open)}>▾</span>
      </button>

      {open ? (
        <div style={dropdownMenu}>
          {options.map((opt) => {
            const isSelected = opt.value === value;

            return (
              <button
                key={`${opt.value}-${opt.label}`}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={dropdownItem(isSelected)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
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
  overflow: "visible",
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
  overflow: "visible",
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
  minHeight: 46,
};

const userIdScrollBox = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
  height: 46,
  minHeight: 46,
  maxHeight: 46,
  resize: "none",
  overflowX: "auto",
  overflowY: "hidden",
  whiteSpace: "nowrap",
  lineHeight: "22px",
  fontFamily: "inherit",
};

const dropdownWrap = {
  position: "relative",
  width: "100%",
};

const dropdownTrigger = (open, disabled) => ({
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: open
    ? "1px solid rgba(75,130,255,0.55)"
    : "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
  minHeight: 46,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: open ? "0 0 0 2px rgba(52, 108, 255, 0.12)" : "none",
  opacity: disabled ? 0.65 : 1,
});

const dropdownValue = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  textAlign: "left",
  flex: 1,
};

const dropdownArrow = (open) => ({
  color: "#cfdcff",
  fontSize: 12,
  lineHeight: 1,
  transform: open ? "rotate(180deg)" : "rotate(0deg)",
  transition: "transform 0.18s ease",
  flexShrink: 0,
});

const dropdownMenu = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  background: "rgba(16,24,43,0.99)",
  border: "1px solid rgba(75,130,255,0.35)",
  borderRadius: 12,
  boxShadow: "0 16px 36px rgba(0,0,0,0.35)",
  zIndex: 1000,
  overflow: "hidden",
  maxHeight: 280,
  overflowY: "auto",
  backdropFilter: "blur(6px)",
};

const dropdownItem = (selected) => ({
  width: "100%",
  border: "none",
  background: selected ? "rgba(50,110,255,0.22)" : "transparent",
  color: selected ? "#ffffff" : "#d9e5ff",
  padding: "12px 12px",
  textAlign: "left",
  fontSize: 14,
  cursor: "pointer",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
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
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const scrollValueBox = {
  color: "#ffffff",
  fontSize: 14,
  lineHeight: 1.5,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  overflowX: "auto",
  overflowY: "hidden",
  whiteSpace: "nowrap",
  maxWidth: "100%",
};

const infoPanel = {
  marginTop: 16,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const infoPanelTitle = {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 12,
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const miniInfoCard = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  minWidth: 0,
};

const miniInfoLabel = {
  color: "#8ea6d6",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 6,
};

const miniInfoValue = {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const miniInfoValueScroll = {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.4,
  overflowX: "auto",
  overflowY: "hidden",
  whiteSpace: "nowrap",
};

const agentSummaryBox = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(43,108,255,0.10)",
  border: "1px solid rgba(75,130,255,0.20)",
  color: "#dce7ff",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.5,
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