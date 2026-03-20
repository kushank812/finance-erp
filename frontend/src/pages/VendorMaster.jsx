// src/pages/VendorMaster.jsx
import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api/client";

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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  disabled = false,
  readOnly = false,
}) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <input
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        readOnly={readOnly}
        style={{
          ...inp,
          background: disabled || readOnly ? "#f4f4f4" : "#fff",
          cursor: disabled || readOnly ? "not-allowed" : "text",
        }}
      />
      {hint ? <div style={hintTxt}>{hint}</div> : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  disabled = false,
}) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <select
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        style={{
          ...inp,
          background: disabled ? "#f4f4f4" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <option value="">{placeholder || "-- Select --"}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {hint ? <div style={hintTxt}>{hint}</div> : null}
    </div>
  );
}

export default function VendorMaster() {
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [mode, setMode] = useState("create"); // "create" | "edit" | "view"
  const [editingCode, setEditingCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const isEditing = mode === "edit";
  const isViewing = mode === "view";
  const isViewer = currentUser?.role === "VIEWER";
  const canWrite = currentUser?.role === "ADMIN" || currentUser?.role === "OPERATOR";

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
    try {
      const data = await apiGet("/vendors/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e?.message || e));
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
        await apiPut(`/vendors/${encodeURIComponent(editingCode)}`, buildUpdatePayload());
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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Vendor Master</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        {isViewer
          ? "View vendor list and details in read-only mode."
          : "Create, edit, delete and view vendors."}
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#111" }}>
            {isViewer
              ? editingCode
                ? `View Vendor (${editingCode})`
                : "Vendor Details"
              : isEditing
              ? `Edit Vendor (${editingCode})`
              : isViewing
              ? `View Vendor (${editingCode})`
              : "Create Vendor"}
          </h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={load} style={btnGhost} disabled={saving}>
              Refresh
            </button>

            {(isEditing || isViewing) && (
              <button onClick={resetForm} style={btnGhost} disabled={saving}>
                {isViewer ? "Clear View" : isEditing ? "Cancel Edit" : "Clear View"}
              </button>
            )}
          </div>
        </div>

        <div style={{ height: 12 }} />

        {isViewer && (
          <div style={readOnlyBanner}>
            VIEWER MODE: You can view vendor details, but you cannot create, edit, or
            delete vendors.
          </div>
        )}

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Vendor Details</div>
        <div style={grid2}>
          {isEditing || isViewing ? (
            <Field
              label="Vendor Code"
              value={form.vendor_code}
              onChange={() => {}}
              placeholder=""
              hint="Vendor code is system-generated and cannot be changed."
              disabled
            />
          ) : (
            <div>
              <div style={lbl}>Vendor Code</div>
              <div style={autoCodeBox}>
                {isViewer ? "Visible after selecting a vendor" : "Auto-generated on save"}
              </div>
              <div style={hintTxt}>
                {isViewer
                  ? "Select a vendor from the list to view the vendor code."
                  : "The system will generate the next vendor code automatically."}
              </div>
            </div>
          )}

          <Field
            label="Vendor Name *"
            value={form.vendor_name}
            onChange={(e) => update("vendor_name", e.target.value)}
            placeholder="Vendor Name"
            readOnly={!canWrite}
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Address Details</div>
        <div style={grid1}>
          <Field
            label="Address Line 1"
            value={form.vendor_address_line1}
            onChange={(e) => update("vendor_address_line1", e.target.value)}
            readOnly={!canWrite}
          />
          <Field
            label="Address Line 2"
            value={form.vendor_address_line2}
            onChange={(e) => update("vendor_address_line2", e.target.value)}
            readOnly={!canWrite}
          />
          <Field
            label="Address Line 3"
            value={form.vendor_address_line3}
            onChange={(e) => update("vendor_address_line3", e.target.value)}
            readOnly={!canWrite}
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Location Details</div>
        <div style={grid3}>
          <Field
            label="City"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            readOnly={!canWrite}
          />
          <SelectField
            label="State"
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            options={INDIAN_STATES}
            placeholder="-- Select State --"
            disabled={!canWrite}
          />
          <Field
            label="PinCode"
            value={form.pincode}
            onChange={(e) => update("pincode", e.target.value)}
            placeholder="560001"
            readOnly={!canWrite}
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Contact Details</div>
        <div style={grid2}>
          <Field
            label="Mobile No"
            value={form.mobile_no}
            onChange={(e) => update("mobile_no", e.target.value)}
            placeholder="10 digit mobile"
            readOnly={!canWrite}
          />
          <Field
            label="Phone No"
            value={form.ph_no}
            onChange={(e) => update("ph_no", e.target.value)}
            placeholder="Optional"
            readOnly={!canWrite}
          />
          <Field
            label="Email ID"
            value={form.email_id}
            onChange={(e) => update("email_id", e.target.value)}
            placeholder="name@email.com"
            type="email"
            readOnly={!canWrite}
          />
          <Field
            label="GST No"
            value={form.gst_no}
            onChange={(e) => update("gst_no", e.target.value)}
            placeholder="Optional"
            readOnly={!canWrite}
          />
        </div>

        {canWrite && (
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={save} style={btnPrimary} disabled={saving}>
              {saving ? "Saving..." : saveLabel}
            </button>

            <button onClick={resetForm} style={btnGhost} disabled={saving}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, color: "#111" }}>Vendors List</h3>
          <button onClick={load} style={btnGhost} disabled={saving}>
            Refresh
          </button>
        </div>

        <div style={{ height: 10 }} />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, name, city, mobile, GST, or email..."
          style={searchInp}
        />

        <div style={{ height: 10 }} />

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f6f7f9" }}>
                <th align="left">Code</th>
                <th align="left">Name</th>
                <th align="left">City</th>
                <th align="left">Mobile</th>
                <th align="left">GST</th>
                <th align="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.vendor_code} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ color: "#111", fontWeight: 900 }}>{r.vendor_code}</td>
                  <td style={{ color: "#111" }}>{r.vendor_name}</td>
                  <td style={{ color: "#111" }}>{r.city || ""}</td>
                  <td style={{ color: "#111" }}>{r.mobile_no || ""}</td>
                  <td style={{ color: "#111" }}>{r.gst_no || ""}</td>
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
                          <button
                            onClick={() => del(r.vendor_code)}
                            style={btnDangerMini}
                            disabled={saving}
                          >
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
                  <td colSpan="6" style={{ color: "#666", padding: 12 }}>
                    No matching vendors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          {canWrite ? (
            <>
              Tip: Tap <b>Edit</b> to load a vendor into the form, then press <b>Update Vendor</b>.
            </>
          ) : (
            <>
              Tip: Tap <b>View</b> to load vendor details in read-only mode.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Styles ---- */

const card = { background: "white", border: "1px solid #e6e6e6", borderRadius: 16, padding: 16 };

const sectionTitle = { fontSize: 13, fontWeight: 900, color: "#111", marginBottom: 8 };

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
  border: "1px solid #ff9a9a",
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