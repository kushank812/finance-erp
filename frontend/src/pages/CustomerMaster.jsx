// src/pages/CustomerMaster.jsx
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
  customer_code: "",
  customer_name: "",
  customer_address_line1: "",
  customer_address_line2: "",
  customer_address_line3: "",
  city: "",
  state: "",
  pincode: "",
  mobile_no: "",
  ph_no: "",
  email_id: "",
  gst_no: "",
};

export default function CustomerMaster() {
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [mode, setMode] = useState("create"); // create | edit | view
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
    () => (isEditing ? "Update Customer" : "Save Customer"),
    [isEditing]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        String(r.customer_code || "").toLowerCase().includes(q) ||
        String(r.customer_name || "").toLowerCase().includes(q) ||
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
      const data = await apiGet("/customers/");
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
      customer_name: form.customer_name,
      customer_address_line1: form.customer_address_line1,
      customer_address_line2: form.customer_address_line2,
      customer_address_line3: form.customer_address_line3,
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
      customer_name: form.customer_name,
      customer_address_line1: form.customer_address_line1,
      customer_address_line2: form.customer_address_line2,
      customer_address_line3: form.customer_address_line3,
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

    if (!form.customer_name?.trim()) {
      setErr("Customer Name is required.");
      return;
    }

    try {
      setSaving(true);

      if (!isEditing) {
        const created = await apiPost("/customers/", buildCreatePayload());
        const code = created?.customer_code || "";
        setOk(`✅ Customer created successfully. Generated Code: ${code}`);
      } else {
        await apiPut(
          `/customers/${encodeURIComponent(editingCode)}`,
          buildUpdatePayload()
        );
        setOk(`✅ Customer "${editingCode}" updated.`);
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
    setEditingCode(row.customer_code);

    setForm({
      ...empty,
      ...row,
      customer_code: row.customer_code ?? "",
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

    const yes = window.confirm(`Delete customer "${code}"?`);
    if (!yes) return;

    try {
      setSaving(true);
      await apiDelete(`/customers/${encodeURIComponent(code)}`);
      setOk(`✅ Customer "${code}" deleted.`);
      await load();

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
    if (isViewer) return "Customer Master";
    if (isEditing) return "Customer Master";
    if (isViewing) return "Customer Master";
    return "Customer Master";
  }

  function getPageSubtitle() {
    if (isViewer) {
      return "View customer records and details in read-only mode.";
    }
    if (isEditing) {
      return `Edit customer ${editingCode} and update the saved master record.`;
    }
    if (isViewing) {
      return `Review customer ${editingCode} details.`;
    }
    return "Create, view, edit, and manage customer master records.";
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
          <h1 style={pageTitle}>{getPageTitle()}</h1>
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
              onClick={resetForm}
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
        {loading ? <AlertBox kind="info" message="Loading customers..." /> : null}
        {isViewer ? (
          <AlertBox
            kind="info"
            message="Viewer mode is active. You can view customer details, but you cannot create, edit, or delete customers."
          />
        ) : null}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>
              {isViewer
                ? editingCode
                  ? `Customer Details (${editingCode})`
                  : "Customer Details"
                : isEditing
                ? `Edit Customer (${editingCode})`
                : isViewing
                ? `Customer Details (${editingCode})`
                : "Create Customer"}
            </h2>
            <p style={cardSubtitle}>
              Manage customer identity, address, location, and contact details.
            </p>
          </div>
          <div>{getModeBadge()}</div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Basic Details</div>
          <div style={formGrid2}>
            {isEditing || isViewing ? (
              <Field
                label="Customer Code"
                value={form.customer_code}
                onChange={() => {}}
                hint="Customer code is system-generated and cannot be changed."
                disabled
              />
            ) : (
              <AutoField
                label="Customer Code"
                text={
                  isViewer
                    ? "Visible after selecting a customer"
                    : "Auto-generated on save"
                }
                hint={
                  isViewer
                    ? "Select a customer from the list to view the customer code."
                    : "The system will generate the next customer code automatically."
                }
              />
            )}

            <Field
              label="Customer Name *"
              value={form.customer_name}
              onChange={(e) => update("customer_name", e.target.value)}
              placeholder="Customer Name"
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Address Details</div>
          <div style={formGrid3}>
            <Field
              label="Address Line 1"
              value={form.customer_address_line1}
              onChange={(e) => update("customer_address_line1", e.target.value)}
              readOnly={!canWrite}
            />
            <Field
              label="Address Line 2"
              value={form.customer_address_line2}
              onChange={(e) => update("customer_address_line2", e.target.value)}
              readOnly={!canWrite}
            />
            <Field
              label="Address Line 3"
              value={form.customer_address_line3}
              onChange={(e) => update("customer_address_line3", e.target.value)}
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Location Details</div>
          <div style={formGrid3}>
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
            <Field
              label="Mobile No"
              value={form.mobile_no}
              onChange={(e) => update("mobile_no", e.target.value)}
              placeholder="9999999999"
              readOnly={!canWrite}
            />
            <Field
              label="Phone No"
              value={form.ph_no}
              onChange={(e) => update("ph_no", e.target.value)}
              placeholder="080-xxxxxxx"
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
              placeholder="29ABCDE1234F1Z5"
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
            <h2 style={cardTitle}>Customers List</h2>
            <p style={cardSubtitle}>
              Search, view, and manage saved customer records.
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
                <tr key={r.customer_code} style={tr}>
                  <td style={tdCode}>{r.customer_code}</td>
                  <td style={td}>{r.customer_name}</td>
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
                            onClick={() => del(r.customer_code)}
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
                    No matching customers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={footerNote}>
          {canWrite ? (
            <>
              Tip: Use <b>Edit</b> to load a customer into the form, then click{" "}
              <b>Update Customer</b>.
            </>
          ) : (
            <>
              Tip: Use <b>View</b> to load customer details in read-only mode.
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
  placeholder,
  type = "text",
  hint,
  disabled = false,
  readOnly = false,
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <input
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        readOnly={readOnly}
        style={disabled || readOnly ? disabledInput : input}
      />
      {hint ? <div style={hintText}>{hint}</div> : null}
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
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        style={disabled ? disabledInput : input}
      >
        <option value="">{placeholder || "-- Select --"}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
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
  minWidth: 900,
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