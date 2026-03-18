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

function Label({ text }) {
  return <div style={{ fontSize: 13, color: "#111", fontWeight: 800, marginBottom: 6 }}>{text}</div>;
}

function Hint({ text }) {
  return <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{text}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text", hint, disabled }) {
  return (
    <div>
      <Label text={label} />
      <input
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        style={{
          ...inp,
          background: disabled ? "#f4f4f4" : "#fff",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {hint ? <Hint text={hint} /> : null}
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, hint }) {
  return (
    <div>
      <Label text={label} />
      <select value={value ?? ""} onChange={onChange} style={inp}>
        <option value="">{placeholder || "-- Select --"}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {hint ? <Hint text={hint} /> : null}
    </div>
  );
}

export default function CustomerMaster() {
  const [form, setForm] = useState({ ...empty });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [mode, setMode] = useState("create"); // "create" | "edit"
  const [editingCode, setEditingCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const isEditing = mode === "edit";
  const saveLabel = useMemo(() => (isEditing ? "Update Customer" : "Save Customer"), [isEditing]);

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
    try {
      const data = await apiGet("/customers/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function resetForm() {
    setForm({ ...empty });
    setMode("create");
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
    setErr("");
    setOk("");

    if (!form.customer_name?.trim()) return setErr("Customer Name is required.");

    try {
      setSaving(true);

      if (!isEditing) {
        const created = await apiPost("/customers/", buildCreatePayload());
        const code = created?.customer_code || "";
        setOk(`✅ Customer created successfully. Generated Code: ${code}`);
      } else {
        await apiPut(`/customers/${encodeURIComponent(editingCode)}`, buildUpdatePayload());
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

  function startEdit(row) {
    setErr("");
    setOk("");
    setMode("edit");
    setEditingCode(row.customer_code);

    setForm({
      ...empty,
      ...row,
      customer_code: row.customer_code ?? "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(code) {
    setErr("");
    setOk("");
    const yes = window.confirm(`Delete customer "${code}"?`);
    if (!yes) return;

    try {
      setSaving(true);
      await apiDelete(`/customers/${encodeURIComponent(code)}`);
      setOk(`✅ Customer "${code}" deleted.`);
      await load();

      if (isEditing && editingCode === code) resetForm();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>Customer Master</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Create, edit, delete and view customers.
      </p>

      {err && <div style={msgErr}>{err}</div>}
      {ok && <div style={msgOk}>{ok}</div>}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#111" }}>
            {isEditing ? `Edit Customer (${editingCode})` : "Create Customer"}
          </h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={load} style={btnGhost} disabled={saving}>
              Refresh
            </button>

            {isEditing && (
              <button onClick={resetForm} style={btnGhost} disabled={saving}>
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Customer Details</div>
        <div style={grid2}>
          {isEditing ? (
            <Field
              label="Customer Code"
              value={form.customer_code}
              onChange={() => {}}
              placeholder=""
              hint="Customer code is system-generated and cannot be changed."
              disabled
            />
          ) : (
            <div>
              <Label text="Customer Code" />
              <div style={autoCodeBox}>Auto-generated on save</div>
              <Hint text="The system will generate the next customer code automatically." />
            </div>
          )}

          <Field
            label="Customer Name *"
            value={form.customer_name}
            onChange={(e) => update("customer_name", e.target.value)}
            placeholder="Customer Name"
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Address Details</div>
        <div style={grid1}>
          <Field
            label="Address Line 1"
            value={form.customer_address_line1}
            onChange={(e) => update("customer_address_line1", e.target.value)}
          />
          <Field
            label="Address Line 2"
            value={form.customer_address_line2}
            onChange={(e) => update("customer_address_line2", e.target.value)}
          />
          <Field
            label="Address Line 3"
            value={form.customer_address_line3}
            onChange={(e) => update("customer_address_line3", e.target.value)}
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Location Details</div>
        <div style={grid3}>
          <Field label="City" value={form.city} onChange={(e) => update("city", e.target.value)} />
          <SelectField
            label="State"
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            options={INDIAN_STATES}
            placeholder="-- Select State --"
          />
          <Field
            label="PinCode"
            value={form.pincode}
            onChange={(e) => update("pincode", e.target.value)}
            placeholder="560001"
          />
        </div>

        <div style={{ height: 12 }} />

        <div style={sectionTitle}>Contact Details</div>
        <div style={grid2}>
          <Field
            label="Mobile No"
            value={form.mobile_no}
            onChange={(e) => update("mobile_no", e.target.value)}
            placeholder="9999999999"
          />
          <Field
            label="Phone No"
            value={form.ph_no}
            onChange={(e) => update("ph_no", e.target.value)}
            placeholder="080-xxxxxxx"
          />
          <Field
            label="Email ID"
            value={form.email_id}
            onChange={(e) => update("email_id", e.target.value)}
            placeholder="name@email.com"
            type="email"
          />
          <Field
            label="GST No"
            value={form.gst_no}
            onChange={(e) => update("gst_no", e.target.value)}
            placeholder="29ABCDE1234F1Z5"
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={save} style={btnPrimary} disabled={saving}>
            {saving ? "Saving..." : saveLabel}
          </button>

          <button onClick={resetForm} style={btnGhost} disabled={saving}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#111" }}>Customers List</h3>
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

        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 820 }}>
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
                <tr key={r.customer_code} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ color: "#111", fontWeight: 900 }}>{r.customer_code}</td>
                  <td style={{ color: "#111" }}>{r.customer_name}</td>
                  <td style={{ color: "#111" }}>{r.city || ""}</td>
                  <td style={{ color: "#111" }}>{r.mobile_no || ""}</td>
                  <td style={{ color: "#111" }}>{r.gst_no || ""}</td>
                  <td align="center">
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(r)} style={btnMini} disabled={saving}>
                        Edit
                      </button>
                      <button onClick={() => del(r.customer_code)} style={btnDangerMini} disabled={saving}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ color: "#666", padding: 12 }}>
                    No matching customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          Tip: Tap <b>Edit</b> to load a customer into the form, then press <b>Update Customer</b>.
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

const inp = {
  width: "100%",
  padding: 10,
  border: "1px solid #d0d0d0",
  borderRadius: 10,
  outline: "none",
  background: "#fff",
  color: "#111",
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