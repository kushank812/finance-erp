// src/pages/VendorMaster.jsx
import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField, FormSelect, AutoField } from "../components/ui/FormField";
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
  tr,
  td,
  tdCode,
  tdCenter,
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

const INDIAN_STATES = [
  "ANDHRA PRADESH",
  "ARUNACHAL PRADESH",
  "ASSAM",
  "BIHAR",
  "CHHATTISGARH",
  "GOA",
  "GUJARAT",
  "HARYANA",
  "HIMACHAL PRADESH",
  "JHARKHAND",
  "KARNATAKA",
  "KERALA",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "MANIPUR",
  "MEGHALAYA",
  "MIZORAM",
  "NAGALAND",
  "ODISHA",
  "PUNJAB",
  "RAJASTHAN",
  "SIKKIM",
  "TAMIL NADU",
  "TELANGANA",
  "TRIPURA",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "WEST BENGAL",
  "ANDAMAN AND NICOBAR ISLANDS",
  "CHANDIGARH",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DELHI",
  "JAMMU AND KASHMIR",
  "LADAKH",
  "LAKSHADWEEP",
  "PUDUCHERRY",
];

const empty = {
  vendor_code: "",
  vendor_name: "",
  vendor_address_line1: "",
  vendor_address_line2: "",
  vendor_address_line3: "",
  city: "",
  state: "",
  pincode: "",
  mobile_no: "",
  ph_no: "",
  email_id: "",
  gst_no: "",
};

export default function VendorMaster() {
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [mode, setMode] = useState("create");
  const [editingCode, setEditingCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const isEditing = mode === "edit";
  const isViewing = mode === "view";
  const isViewer = currentUser?.role === "VIEWER";
  const canWrite =
    currentUser?.role === "ADMIN" || currentUser?.role === "OPERATOR";

  const saveLabel = useMemo(
    () => (isEditing ? "Update Vendor" : "Save Vendor"),
    [isEditing]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.vendor_code || "").toLowerCase().includes(q) ||
        String(r.vendor_name || "").toLowerCase().includes(q) ||
        String(r.city || "").toLowerCase().includes(q) ||
        String(r.mobile_no || "").toLowerCase().includes(q) ||
        String(r.gst_no || "").toLowerCase().includes(q) ||
        String(r.email_id || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await apiGet("/vendors/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e?.message || e));
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

  function resetForm() {
    setForm({ ...empty });
    setMode(isViewer ? "view" : "create");
    setEditingCode("");
    setErr("");
    setOk("");
  }

  function buildCreatePayload() {
    return {
      vendor_name: form.vendor_name,
      vendor_address_line1: form.vendor_address_line1,
      vendor_address_line2: form.vendor_address_line2,
      vendor_address_line3: form.vendor_address_line3,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      mobile_no: form.mobile_no,
      ph_no: form.ph_no,
      email_id: form.email_id,
      gst_no: form.gst_no,
    };
  }

  function buildUpdatePayload() {
    return {
      vendor_name: form.vendor_name,
      vendor_address_line1: form.vendor_address_line1,
      vendor_address_line2: form.vendor_address_line2,
      vendor_address_line3: form.vendor_address_line3,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      mobile_no: form.mobile_no,
      ph_no: form.ph_no,
      email_id: form.email_id,
      gst_no: form.gst_no,
    };
  }

  async function save() {
    if (!canWrite) {
      setErr("Viewer access is read-only.");
      return;
    }

    setErr("");
    setOk("");

    if (!form.vendor_name?.trim()) {
      setErr("Vendor Name is required.");
      return;
    }

    try {
      setSaving(true);

      if (!isEditing) {
        const created = await apiPost("/vendors/", buildCreatePayload());
        const code = created?.vendor_code || "";
        setOk(`✅ Vendor created successfully. Generated Code: ${code}`);
      } else {
        await apiPut(
          `/vendors/${encodeURIComponent(editingCode)}`,
          buildUpdatePayload()
        );
        setOk(`✅ Vendor "${editingCode}" updated.`);
      }

      await load();
      resetForm();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function loadIntoForm(row, nextMode = "view") {
    setErr("");
    setOk("");
    setMode(nextMode);
    setEditingCode(row.vendor_code);

    setForm({
      ...empty,
      ...row,
      vendor_code: row.vendor_code ?? "",
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

  async function del(code) {
    if (!canWrite) {
      setErr("Viewer access is read-only.");
      return;
    }

    setErr("");
    setOk("");

    const yes = window.confirm(`Delete vendor "${code}"?`);
    if (!yes) return;

    try {
      setSaving(true);
      await apiDelete(`/vendors/${encodeURIComponent(code)}`);
      await load();
      setOk(`✅ Vendor "${code}" deleted.`);

      if ((isEditing || isViewing) && editingCode === code) {
        resetForm();
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function getPageTitle() {
    return "Vendor Master";
  }

  function getPageSubtitle() {
    if (isViewer) {
      return "View vendor records and details in read-only mode.";
    }
    if (isEditing) {
      return `Edit vendor ${editingCode} and update the saved master record.`;
    }
    if (isViewing) {
      return `Review vendor ${editingCode} details.`;
    }
    return "Create, view, edit, and manage vendor master records.";
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
        title={getPageTitle()}
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
                onClick={resetForm}
                style={btnGhost}
                disabled={saving || loading}
              >
                {isViewer
                  ? "Clear View"
                  : isEditing
                  ? "Cancel Edit"
                  : "Clear View"}
              </button>
            )}
          </>
        }
      />

      <div style={stack}>
        {err ? <AlertBox kind="error" message={err} /> : null}
        {ok ? <AlertBox kind="success" message={ok} /> : null}
        {loading ? <AlertBox kind="info" message="Loading vendors..." /> : null}
        {isViewer ? (
          <AlertBox
            kind="info"
            message="Viewer mode is active. You can view vendor details, but you cannot create, edit, or delete vendors."
          />
        ) : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {isViewer
                ? editingCode
                  ? `Vendor Details (${editingCode})`
                  : "Vendor Details"
                : isEditing
                ? `Edit Vendor (${editingCode})`
                : isViewing
                ? `Vendor Details (${editingCode})`
                : "Create Vendor"}
            </h2>
            <p style={cardSubtitle}>
              Manage vendor identity, address, location, and contact details.
            </p>
          </div>
          <div>{getModeBadge()}</div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Basic Details</div>
          <div style={formGrid2}>
            {isEditing || isViewing ? (
              <FormField
                label="Vendor Code"
                value={form.vendor_code}
                onChange={() => {}}
                hint="Vendor code is system-generated and cannot be changed."
                disabled
              />
            ) : (
              <AutoField
                label="Vendor Code"
                text={
                  isViewer
                    ? "Visible after selecting a vendor"
                    : "Auto-generated on save"
                }
                hint={
                  isViewer
                    ? "Select a vendor from the list to view the vendor code."
                    : "The system will generate the next vendor code automatically."
                }
              />
            )}

            <FormField
              label="Vendor Name *"
              value={form.vendor_name}
              onChange={(e) => update("vendor_name", e.target.value)}
              placeholder="Vendor Name"
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Address Details</div>
          <div style={formGrid3}>
            <FormField
              label="Address Line 1"
              value={form.vendor_address_line1}
              onChange={(e) => update("vendor_address_line1", e.target.value)}
              readOnly={!canWrite}
            />
            <FormField
              label="Address Line 2"
              value={form.vendor_address_line2}
              onChange={(e) => update("vendor_address_line2", e.target.value)}
              readOnly={!canWrite}
            />
            <FormField
              label="Address Line 3"
              value={form.vendor_address_line3}
              onChange={(e) => update("vendor_address_line3", e.target.value)}
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Location Details</div>
          <div style={formGrid3}>
            <FormField
              label="City"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              readOnly={!canWrite}
            />
            <FormSelect
              label="State"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              options={INDIAN_STATES}
              placeholder="-- Select State --"
              disabled={!canWrite}
            />
            <FormField
              label="Pin Code"
              value={form.pincode}
              onChange={(e) => update("pincode", e.target.value)}
              placeholder="560001"
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Contact Details</div>
          <div style={formGrid2}>
            <FormField
              label="Mobile No"
              value={form.mobile_no}
              onChange={(e) => update("mobile_no", e.target.value)}
              placeholder="10 digit mobile"
              readOnly={!canWrite}
            />
            <FormField
              label="Phone No"
              value={form.ph_no}
              onChange={(e) => update("ph_no", e.target.value)}
              placeholder="Optional"
              readOnly={!canWrite}
            />
            <FormField
              label="Email ID"
              value={form.email_id}
              onChange={(e) => update("email_id", e.target.value)}
              placeholder="name@email.com"
              type="email"
              readOnly={!canWrite}
            />
            <FormField
              label="GST No"
              value={form.gst_no}
              onChange={(e) => update("gst_no", e.target.value)}
              placeholder="Optional"
              readOnly={!canWrite}
            />
          </div>
        </div>

        {canWrite ? (
          <div style={actionBar}>
            <div style={saveActions}>
              <button
                type="button"
                onClick={save}
                style={saving ? disabledBtn(btnPrimary) : btnPrimary}
                disabled={saving}
              >
                {saving ? "Saving..." : saveLabel}
              </button>

              <button
                type="button"
                onClick={resetForm}
                style={btnSecondary}
                disabled={saving}
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
            <h2 style={cardTitle}>Vendors List</h2>
            <p style={cardSubtitle}>
              Search, view, and manage saved vendor records.
            </p>
          </div>

          <div style={listToolbar}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, city, mobile, GST, or email"
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
                <th style={th}>City</th>
                <th style={th}>Mobile</th>
                <th style={th}>GST</th>
                <th style={thCenter}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.vendor_code} style={tr}>
                  <td style={tdCode}>{r.vendor_code}</td>
                  <td style={td}>{r.vendor_name}</td>
                  <td style={td}>{r.city || ""}</td>
                  <td style={td}>{r.mobile_no || ""}</td>
                  <td style={td}>{r.gst_no || ""}</td>
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
                            onClick={() => del(r.vendor_code)}
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
                  <td colSpan="6" style={emptyTd}>
                    No matching vendors found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={footerNote}>
          {canWrite ? (
            <>
              Tip: Use <b>Edit</b> to load a vendor into the form, then click{" "}
              <b>Update Vendor</b>.
            </>
          ) : (
            <>
              Tip: Use <b>View</b> to load vendor details in read-only mode.
            </>
          )}
        </div>
      </section>
    </div>
  );
}