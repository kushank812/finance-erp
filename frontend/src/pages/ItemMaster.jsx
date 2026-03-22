// src/pages/ItemMaster.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api/client";

const empty = {
  item_code: "",
  item_name: "",
  units: "",
  opening_balance: 0,
  cost_price: 0,
  selling_price: 0,
};

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function ItemMaster() {
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [editingCode, setEditingCode] = useState(null);
  const [viewingCode, setViewingCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const role = String(currentUser?.role || "").toUpperCase();
  const isEditing = !!editingCode;
  const isViewing = !!viewingCode && !editingCode;
  const isViewer = role === "VIEWER";
  const canWrite = role === "ADMIN" || role === "OPERATOR";

  const saveLabel = useMemo(
    () => (isEditing ? "Update Item" : "Save Item"),
    [isEditing]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.item_code || "").toLowerCase().includes(q) ||
        String(r.item_name || "").toLowerCase().includes(q) ||
        String(r.units || "").toLowerCase().includes(q) ||
        String(r.opening_balance ?? "").toLowerCase().includes(q) ||
        String(r.cost_price ?? "").toLowerCase().includes(q) ||
        String(r.selling_price ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await apiGet("/items/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const me = await apiGet("/auth/me");
      setCurrentUser(me || null);
    } catch {
      setCurrentUser(null);
    }
  }

  useEffect(() => {
    loadCurrentUser();
    load();
  }, []);

  function update(key, val) {
    if (!canWrite) return;
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function loadIntoForm(row, mode = "view") {
    setErr("");
    setOk("");

    if (mode === "edit") {
      if (!canWrite) {
        setErr("Viewer access is read-only.");
        return;
      }
      setEditingCode(row.item_code);
      setViewingCode(null);
    } else {
      setViewingCode(row.item_code);
      setEditingCode(null);
    }

    setForm({
      item_code: row.item_code ?? "",
      item_name: row.item_name ?? "",
      units: row.units ?? "",
      opening_balance: row.opening_balance ?? 0,
      cost_price: row.cost_price ?? 0,
      selling_price: row.selling_price ?? 0,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(row) {
    if (!canWrite) {
      setErr("Viewer access is read-only.");
      return;
    }
    loadIntoForm(row, "edit");
  }

  function startView(row) {
    loadIntoForm(row, "view");
  }

  function cancelEdit() {
    setErr("");
    setOk("");
    setEditingCode(null);
    setViewingCode(null);
    setForm({ ...empty });
  }

  function buildCreatePayload() {
    return {
      item_name: String(form.item_name || "").trim(),
      units: String(form.units || "").trim(),
      opening_balance: num(form.opening_balance),
      cost_price: num(form.cost_price),
      selling_price: num(form.selling_price),
    };
  }

  function buildUpdatePayload() {
    return {
      item_name: String(form.item_name || "").trim(),
      units: String(form.units || "").trim(),
      opening_balance: num(form.opening_balance),
      cost_price: num(form.cost_price),
      selling_price: num(form.selling_price),
    };
  }

  async function saveOrUpdate() {
    if (!canWrite) {
      setErr("Viewer access is read-only.");
      return;
    }

    setErr("");
    setOk("");

    if (!String(form.item_name || "").trim()) {
      setErr("Item Name is required.");
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        await apiPut(
          `/items/${encodeURIComponent(editingCode)}`,
          buildUpdatePayload()
        );
        setOk(`✅ Item "${editingCode}" updated.`);
      } else {
        const created = await apiPost("/items/", buildCreatePayload());
        const code = created?.item_code || "";
        setOk(`✅ Item created successfully. Generated Code: ${code}`);
      }

      cancelEdit();
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(code) {
    if (!canWrite) {
      setErr("Viewer access is read-only.");
      return;
    }

    const yes = window.confirm(`Delete item "${code}"?`);
    if (!yes) return;

    setErr("");
    setOk("");

    try {
      setSaving(true);
      await apiDelete(`/items/${encodeURIComponent(code)}`);
      if (editingCode === code || viewingCode === code) cancelEdit();
      setOk(`✅ Item "${code}" deleted.`);
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  function clearCreateForm() {
    if (!canWrite || isEditing) return;
    setForm({ ...empty });
    setErr("");
    setOk("");
  }

  function getPageSubtitle() {
    if (isViewer) {
      return "View item records and details in read-only mode.";
    }
    if (isEditing) {
      return `Edit item ${editingCode} and update the saved master record.`;
    }
    if (isViewing) {
      return `Review item ${viewingCode} details.`;
    }
    return "Create, view, edit, and manage item master records.";
  }

  function getModeBadge() {
    if (isViewer) return <span style={badgeGray}>VIEWER</span>;
    if (isEditing) return <span style={badgeAmber}>EDIT</span>;
    if (isViewing) return <span style={badgeBlue}>VIEW</span>;
    return <span style={badgeGreen}>CREATE</span>;
  }

  return (
    <div style={page}>
      <div style={pageHeader}>
        <div>
          <div style={eyebrow}>MASTER DATA</div>
          <h1 style={pageTitle}>Item Master</h1>
          <p style={pageSubtitle}>{getPageSubtitle()}</p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={load}
            style={btnSecondary}
            disabled={saving || loading}
          >
            Refresh
          </button>

          {(isEditing || isViewing) && (
            <button
              type="button"
              onClick={cancelEdit}
              style={btnGhost}
              disabled={saving || loading}
            >
              {isViewer ? "Clear View" : isEditing ? "Cancel Edit" : "Clear View"}
            </button>
          )}
        </div>
      </div>

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {ok ? <AlertBox kind="success" message={ok} /> : null}
        {loading ? <AlertBox kind="info" message="Loading items..." /> : null}
        {isViewer ? (
          <AlertBox
            kind="info"
            message="Viewer mode is active. You can view item details, but you cannot create, edit, or delete items."
          />
        ) : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {isViewer
                ? viewingCode
                  ? `Item Details (${viewingCode})`
                  : "Item Details"
                : isEditing
                ? `Edit Item (${editingCode})`
                : isViewing
                ? `Item Details (${viewingCode})`
                : "Create Item"}
            </h2>
            <p style={cardSubtitle}>
              Manage item identity, units, opening stock, and pricing details.
            </p>
          </div>
          <div>{getModeBadge()}</div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Basic Details</div>
          <div style={formGrid2}>
            {isEditing || isViewing ? (
              <Field
                label="Item Code"
                value={form.item_code}
                disabled
                onChange={() => {}}
                hint="Item code is system-generated and cannot be changed."
              />
            ) : (
              <AutoField
                label="Item Code"
                text={
                  isViewer
                    ? "Visible after selecting an item"
                    : "Auto-generated on save"
                }
                hint={
                  isViewer
                    ? "Select an item from the list to view the item code."
                    : "The system will generate the next item code automatically."
                }
              />
            )}

            <Field
              label="Item Name *"
              value={form.item_name}
              onChange={(e) => update("item_name", e.target.value)}
              placeholder="Item Name"
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Stock & Pricing</div>
          <div style={formGrid3}>
            <Field
              label="Units"
              value={form.units}
              onChange={(e) => update("units", e.target.value)}
              placeholder="pcs / kg / box"
              readOnly={!canWrite}
            />
            <Field
              label="Opening Balance"
              type="number"
              value={form.opening_balance}
              onChange={(e) => update("opening_balance", e.target.value)}
              placeholder="0"
              readOnly={!canWrite}
            />
            <Field
              label="Cost Price"
              type="number"
              value={form.cost_price}
              onChange={(e) => update("cost_price", e.target.value)}
              placeholder="0.00"
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Selling Details</div>
          <div style={formGrid2}>
            <Field
              label="Selling Price"
              type="number"
              value={form.selling_price}
              onChange={(e) => update("selling_price", e.target.value)}
              placeholder="0.00"
              readOnly={!canWrite}
            />
          </div>
        </div>

        {canWrite ? (
          <div style={actionBar}>
            <div style={saveActions}>
              <button
                type="button"
                onClick={saveOrUpdate}
                style={saving ? disabledBtn(btnPrimary) : btnPrimary}
                disabled={saving}
              >
                {saving ? "Saving..." : saveLabel}
              </button>

              <button
                type="button"
                onClick={clearCreateForm}
                disabled={isEditing || saving}
                style={
                  isEditing || saving
                    ? disabledBtn(btnSecondary)
                    : btnSecondary
                }
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Items List</h2>
            <p style={cardSubtitle}>
              Search, view, and manage saved item records.
            </p>
          </div>

          <div style={listToolbar}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, units, opening, cost, or selling"
              style={searchInput}
            />
            <button
              type="button"
              onClick={load}
              style={btnGhost}
              disabled={saving || loading}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Code</th>
                <th style={th}>Name</th>
                <th style={th}>Units</th>
                <th style={thRight}>Opening</th>
                <th style={thRight}>Cost</th>
                <th style={thRight}>Selling</th>
                <th style={thCenter}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.item_code} style={tr}>
                  <td style={tdCode}>{r.item_code}</td>
                  <td style={td}>{r.item_name}</td>
                  <td style={td}>{r.units || ""}</td>
                  <td style={tdRight}>{num(r.opening_balance)}</td>
                  <td style={tdRight}>{num(r.cost_price)}</td>
                  <td style={tdRight}>{num(r.selling_price)}</td>
                  <td style={tdCenter}>
                    <div style={rowActions}>
                      <button
                        type="button"
                        onClick={() => startView(r)}
                        style={btnViewMini}
                        disabled={saving}
                      >
                        View
                      </button>

                      {canWrite ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            style={btnMini}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(r.item_code)}
                            style={btnDangerMini}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={emptyTd}>
                    No matching items found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={footerNote}>
          {canWrite ? (
            <>
              Tip: Use <b>Edit</b> to load an item into the form, then click{" "}
              <b>Update Item</b>.
            </>
          ) : (
            <>
              Tip: Use <b>View</b> to load item details in read-only mode.
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  readOnly = false,
  placeholder,
  hint,
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        placeholder={placeholder}
        style={disabled || readOnly ? disabledInput : input}
      />
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}

function AutoField({ label, text, hint }) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <div style={autoBox}>{text}</div>
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}

function AlertBox({ kind, message }) {
  const styleMap = {
    error: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#b42318",
    },
    success: {
      background: "#ecfdf3",
      border: "1px solid #b7ebc6",
      color: "#027a48",
    },
    warning: {
      background: "#fffaeb",
      border: "1px solid #fedf89",
      color: "#b54708",
    },
    info: {
      background: "#eff8ff",
      border: "1px solid #b2ddff",
      color: "#175cd3",
    },
  };

  return (
    <div
      style={{
        ...styleMap[kind],
        padding: "12px 14px",
        borderRadius: 14,
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}

function disabledBtn(base) {
  return {
    ...base,
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  };
}

/* ------------------ shared page styles ------------------ */

const page = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "18px 16px 28px",
  display: "grid",
  gap: 18,
};

const pageHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrow = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  color: "#94a3b8",
  marginBottom: 6,
};

const pageTitle = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  color: "#f8fafc",
  fontWeight: 900,
};

const pageSubtitle = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: 14,
  maxWidth: 760,
};

const headerActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const stack = {
  display: "grid",
  gap: 10,
};

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 18,
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const cardTitle = {
  margin: 0,
  fontSize: 20,
  color: "#0f172a",
  fontWeight: 900,
};

const cardSubtitle = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#64748b",
};

const sectionBlock = {
  display: "grid",
  gap: 10,
};

const sectionTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#334155",
};

const formGrid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const formGrid3 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const labelStyle = {
  fontSize: 12,
  color: "#334155",
  fontWeight: 900,
  letterSpacing: 0.3,
};

const input = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const disabledInput = {
  ...input,
  background: "#f8fafc",
  color: "#64748b",
  cursor: "not-allowed",
  opacity: 0.85,
};

const autoBox = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 800,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
};

const hintText = {
  fontSize: 12,
  color: "#64748b",
};

const actionBar = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const saveActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const listToolbar = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const searchInput = {
  width: "100%",
  minWidth: 280,
  maxWidth: 420,
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const tableWrap = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 920,
  background: "#ffffff",
};

const th = {
  textAlign: "left",
  padding: "14px 14px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  borderBottom: "1px solid #e2e8f0",
};

const thRight = {
  ...th,
  textAlign: "right",
};

const thCenter = {
  ...th,
  textAlign: "center",
};

const tr = {
  borderBottom: "1px solid #eef2f7",
};

const td = {
  padding: 12,
  verticalAlign: "middle",
  color: "#0f172a",
};

const tdCode = {
  ...td,
  fontWeight: 900,
};

const tdRight = {
  ...td,
  textAlign: "right",
};

const tdCenter = {
  ...td,
  textAlign: "center",
};

const rowActions = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
  flexWrap: "wrap",
};

const emptyTd = {
  padding: 18,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const footerNote = {
  marginTop: 2,
  color: "#64748b",
  fontSize: 12,
};

const btnPrimary = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.22)",
};

const btnSecondary = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const btnGhost = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#f8fafc",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const btnViewMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #475569",
  background: "#475569",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const btnMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const btnDangerMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #fda4af",
  background: "#fff1f2",
  color: "#b42318",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const badgeBlue = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#eff8ff",
  color: "#175cd3",
  border: "1px solid #b2ddff",
};

const badgeGray = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#f2f4f7",
  color: "#475467",
  border: "1px solid #d0d5dd",
};

const badgeAmber = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#fffaeb",
  color: "#b54708",
  border: "1px solid #fedf89",
};

const badgeGreen = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  background: "#ecfdf3",
  color: "#027a48",
  border: "1px solid #abefc6",
};