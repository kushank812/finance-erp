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
    <div>
      <div style={lbl}>{label}</div>
      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          ...inp,
          background: disabled || readOnly ? "#f4f4f4" : "#fff",
          cursor: disabled || readOnly ? "not-allowed" : "text",
          opacity: disabled || readOnly ? 0.85 : 1,
        }}
      />
      {hint ? <div style={hintTxt}>{hint}</div> : null}
    </div>
  );
}

export default function ItemMaster() {
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [editingCode, setEditingCode] = useState(null);
  const [viewingCode, setViewingCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const role = String(currentUser?.role || "").toUpperCase();
  const isEditing = !!editingCode;
  const isViewing = !!viewingCode && !editingCode;
  const isViewer = role === "VIEWER";
  const canWrite = role === "ADMIN" || role === "OPERATOR";

  const saveLabel = useMemo(() => (isEditing ? "Update Item" : "Save Item"), [isEditing]);

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
    try {
      const data = await apiGet("/items/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
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
        await apiPut(`/items/${encodeURIComponent(editingCode)}`, buildUpdatePayload());
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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Item Master</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        {isViewer
          ? "View item list and details in read-only mode."
          : "Create, edit, delete and view items (responsive for phone + laptop)."}
      </p>

      <div style={debugBox}>
        ROLE: {role || "NO ROLE"} | CAN WRITE: {canWrite ? "YES" : "NO"}
      </div>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#111" }}>
            {isViewer
              ? viewingCode
                ? `View Item (${viewingCode})`
                : "Item Details"
              : isEditing
              ? `Edit Item (${editingCode})`
              : isViewing
              ? `View Item (${viewingCode})`
              : "Create Item"}
          </h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={load} style={btnGhost} disabled={saving}>
              Refresh
            </button>

            {(isEditing || isViewing) && (
              <button onClick={cancelEdit} style={btnGhost} disabled={saving}>
                {isViewer ? "Clear View" : isEditing ? "Cancel Edit" : "Clear View"}
              </button>
            )}
          </div>
        </div>

        <div style={{ height: 12 }} />

        {isViewer && (
          <div style={readOnlyBanner}>
            VIEWER MODE: You can view item details, but you cannot create, edit, or delete items.
          </div>
        )}

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Item Details</div>

        <div style={grid2}>
          {isEditing || isViewing ? (
            <Field
              label="Item Code"
              value={form.item_code}
              disabled
              onChange={() => {}}
              hint="Item code is system-generated and cannot be changed."
            />
          ) : (
            <div>
              <div style={lbl}>Item Code</div>
              <div style={autoCodeBox}>
                {isViewer ? "Visible after selecting an item" : "Auto-generated on save"}
              </div>
              <div style={hintTxt}>
                {isViewer
                  ? "Select an item from the list to view the item code."
                  : "The system will generate the next item code automatically."}
              </div>
            </div>
          )}

          <Field
            label="Item Name *"
            value={form.item_name}
            onChange={(e) => update("item_name", e.target.value)}
            placeholder="Item Name"
            readOnly={!canWrite}
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Stock & Pricing</div>

        <div style={grid3}>
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

        <div style={{ height: 12 }} />

        <div style={grid1}>
          <Field
            label="Selling Price"
            type="number"
            value={form.selling_price}
            onChange={(e) => update("selling_price", e.target.value)}
            placeholder="0.00"
            readOnly={!canWrite}
          />
        </div>

        {canWrite && (
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={saveOrUpdate} style={btnPrimary} disabled={saving}>
              {saving ? "Saving..." : saveLabel}
            </button>

            <button
              onClick={clearCreateForm}
              disabled={isEditing || saving}
              style={{
                ...btnGhost,
                cursor: isEditing || saving ? "not-allowed" : "pointer",
                opacity: isEditing || saving ? 0.6 : 1,
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#111" }}>Items List</h3>
          <button onClick={load} style={btnGhost} disabled={saving}>
            Refresh
          </button>
        </div>

        <div style={{ height: 10 }} />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, name, units, opening, cost, or selling..."
          style={searchInp}
        />

        <div style={{ height: 10 }} />

        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f6f7f9" }}>
                <th align="left">Code</th>
                <th align="left">Name</th>
                <th align="left">Units</th>
                <th align="right">Opening</th>
                <th align="right">Cost</th>
                <th align="right">Selling</th>
                <th align="center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.item_code} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ color: "#111", fontWeight: 900 }}>{r.item_code}</td>
                  <td style={{ color: "#111" }}>{r.item_name}</td>
                  <td style={{ color: "#111" }}>{r.units || ""}</td>
                  <td style={{ color: "#111" }} align="right">
                    {num(r.opening_balance)}
                  </td>
                  <td style={{ color: "#111" }} align="right">
                    {num(r.cost_price)}
                  </td>
                  <td style={{ color: "#111" }} align="right">
                    {num(r.selling_price)}
                  </td>
                  <td align="center">
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button onClick={() => startView(r)} style={btnViewMini} disabled={saving}>
                        View
                      </button>

                      {canWrite && (
                        <>
                          <button onClick={() => startEdit(r)} style={btnMini} disabled={saving}>
                            Edit
                          </button>
                          <button onClick={() => remove(r.item_code)} style={btnDangerMini} disabled={saving}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: 12, color: "#666" }}>
                    No matching items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          {canWrite ? (
            <>
              Tip: Tap <b>Edit</b> to load an item into the form, then press <b>Update Item</b>.
            </>
          ) : (
            <>
              Tip: Tap <b>View</b> to load item details in read-only mode.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Styles ---- */

const card = { background: "white", border: "1px solid #e6e6e6", borderRadius: 16, padding: 16 };

const sectionTitle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111",
  marginBottom: 8,
};

const lbl = { fontSize: 13, color: "#111", display: "block", marginBottom: 6, fontWeight: 800 };
const hintTxt = { fontSize: 12, color: "#666", marginTop: 6 };

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

const autoCodeBox = {
  width: "100%",
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  background: "#f7f7f7",
  color: "#555",
  fontWeight: 700,
  boxSizing: "border-box",
};

const searchInp = {
  width: "100%",
  maxWidth: 420,
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
  boxSizing: "border-box",
};

const grid1 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const grid3 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontWeight: 900,
};

const btnMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnViewMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #4b5563",
  background: "#4b5563",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnDangerMini = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ffb3b3",
  background: "#ffecec",
  color: "#a40000",
  cursor: "pointer",
  fontWeight: 900,
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
  background: "#eaffea",
  border: "1px solid #bde7bd",
  padding: 10,
  borderRadius: 12,
  color: "#0a6a0a",
  marginBottom: 12,
};

const readOnlyBanner = {
  background: "#f4f7ff",
  border: "1px solid #cdd9ff",
  padding: 10,
  borderRadius: 12,
  color: "#1d3f91",
  fontWeight: 700,
  marginBottom: 4,
};

const debugBox = {
  background: "#fff7d6",
  border: "1px solid #e5d37a",
  padding: 10,
  borderRadius: 12,
  color: "#5c4700",
  marginBottom: 12,
  fontWeight: 800,
};