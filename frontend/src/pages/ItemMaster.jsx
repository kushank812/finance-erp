import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField, AutoField } from "../components/ui/FormField";
import {
  page,
  stack,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle,
  sectionBlock,
  sectionTitle,
  formGrid2,
  formGrid3,
  actionBar,
  saveActions,
  listToolbar,
  searchInput,
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
  rowActions,
  emptyTd,
  footerNote,
  btnPrimary,
  btnSecondary,
  btnGhost,
  btnMini,
  btnViewMini,
  btnDangerMini,
  badgeBlue,
  badgeGray,
  badgeAmber,
  badgeGreen,
  disabledBtn,
} from "../components/ui/uiStyles";

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
      <PageHeaderBlock
        eyebrowText="MASTER DATA"
        title="Item Master"
        subtitle={getPageSubtitle()}
        actions={
          <>
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
          </>
        }
      />

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
              <FormField
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

            <FormField
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
            <FormField
              label="Units"
              value={form.units}
              onChange={(e) => update("units", e.target.value)}
              placeholder="pcs / kg / box"
              readOnly={!canWrite}
            />
            <FormField
              label="Opening Balance"
              type="number"
              value={form.opening_balance}
              onChange={(e) => update("opening_balance", e.target.value)}
              placeholder="0"
              readOnly={!canWrite}
            />
            <FormField
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
            <FormField
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
                style={isEditing || saving ? disabledBtn(btnSecondary) : btnSecondary}
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