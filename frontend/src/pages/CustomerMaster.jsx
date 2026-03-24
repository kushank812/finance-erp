// src/pages/CustomerMaster.jsx
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

function upper(value) {
  return String(value || "").toUpperCase();
}

function digitsOnly(value, maxLength = null) {
  const cleaned = String(value || "").replace(/\D/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function lettersSpacesOnly(value, maxLength = null) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .trimStart();
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function alphaNumericBasic(value, maxLength = null) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s&/.,()-]/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function emailClean(value, maxLength = null) {
  const cleaned = String(value || "").trim().toLowerCase().replace(/\s/g, "");
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function gstClean(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15);
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidGST(value) {
  if (!value) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(value);
}

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

  function handleCustomerNameChange(value) {
    update("customer_name", alphaNumericBasic(value, 200));
  }

  function handleAddressChange(key, value) {
    update(key, alphaNumericBasic(value, 200));
  }

  function handleCityChange(value) {
    update("city", lettersSpacesOnly(value, 100));
  }

  function handlePinCodeChange(value) {
    update("pincode", digitsOnly(value, 6));
  }

  function handleMobileChange(value) {
    update("mobile_no", digitsOnly(value, 10));
  }

  function handlePhoneChange(value) {
    update("ph_no", digitsOnly(value, 15));
  }

  function handleEmailChange(value) {
    update("email_id", emailClean(value, 200));
  }

  function handleGSTChange(value) {
    update("gst_no", gstClean(value));
  }

  function resetForm() {
    setForm({ ...empty });
    setMode(isViewer ? "view" : "create");
    setEditingCode("");
    setErr("");
    setOk("");
  }

  function normalizePayloadValues(source) {
    return {
      customer_name: upper(source.customer_name).trim(),
      customer_address_line1: upper(source.customer_address_line1).trim(),
      customer_address_line2: upper(source.customer_address_line2).trim(),
      customer_address_line3: upper(source.customer_address_line3).trim(),
      city: upper(source.city).trim(),
      state: upper(source.state).trim(),
      pincode: digitsOnly(source.pincode, 6),
      mobile_no: digitsOnly(source.mobile_no, 10),
      ph_no: digitsOnly(source.ph_no, 15),
      email_id: String(source.email_id || "").trim().toLowerCase(),
      gst_no: gstClean(source.gst_no),
    };
  }

  function buildCreatePayload() {
    return normalizePayloadValues(form);
  }

  function buildUpdatePayload() {
    return normalizePayloadValues(form);
  }

  function validateForm() {
    const cleaned = normalizePayloadValues(form);

    if (!cleaned.customer_name) {
      return "Customer Name is required.";
    }

    if (!cleaned.city) {
      return "City is required.";
    }

    if (!cleaned.state) {
      return "State is required.";
    }

    if (cleaned.pincode && cleaned.pincode.length !== 6) {
      return "Pin Code must be exactly 6 digits.";
    }

    if (cleaned.mobile_no && cleaned.mobile_no.length !== 10) {
      return "Mobile No must be exactly 10 digits.";
    }

    if (cleaned.ph_no && cleaned.ph_no.length < 6) {
      return "Phone No must contain at least 6 digits.";
    }

    if (cleaned.email_id && !isValidEmail(cleaned.email_id)) {
      return "Enter a valid Email ID.";
    }

    if (cleaned.gst_no && cleaned.gst_no.length !== 15) {
      return "GST No must be exactly 15 characters.";
    }

    if (cleaned.gst_no && !isValidGST(cleaned.gst_no)) {
      return "Enter a valid GST No.";
    }

    return "";
  }

  async function save() {
    if (!canWrite) {
      setErr("Viewer access is read-only.");
      return;
    }

    setErr("");
    setOk("");

    const validationError = validateForm();
    if (validationError) {
      setErr(validationError);
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
      customer_name: upper(row.customer_name ?? ""),
      customer_address_line1: upper(row.customer_address_line1 ?? ""),
      customer_address_line2: upper(row.customer_address_line2 ?? ""),
      customer_address_line3: upper(row.customer_address_line3 ?? ""),
      city: upper(row.city ?? ""),
      state: upper(row.state ?? ""),
      pincode: digitsOnly(row.pincode ?? "", 6),
      mobile_no: digitsOnly(row.mobile_no ?? "", 10),
      ph_no: digitsOnly(row.ph_no ?? "", 15),
      email_id: String(row.email_id ?? "").toLowerCase(),
      gst_no: gstClean(row.gst_no ?? ""),
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
              <FormField
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

            <FormField
              label="Customer Name *"
              value={form.customer_name}
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              placeholder="Customer Name"
              readOnly={!canWrite}
              hint="Letters and numbers allowed."
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Address Details</div>
          <div style={formGrid3}>
            <FormField
              label="Address Line 1"
              value={form.customer_address_line1}
              onChange={(e) =>
                handleAddressChange("customer_address_line1", e.target.value)
              }
              readOnly={!canWrite}
            />
            <FormField
              label="Address Line 2"
              value={form.customer_address_line2}
              onChange={(e) =>
                handleAddressChange("customer_address_line2", e.target.value)
              }
              readOnly={!canWrite}
            />
            <FormField
              label="Address Line 3"
              value={form.customer_address_line3}
              onChange={(e) =>
                handleAddressChange("customer_address_line3", e.target.value)
              }
              readOnly={!canWrite}
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Location Details</div>
          <div style={formGrid3}>
            <FormField
              label="City *"
              value={form.city}
              onChange={(e) => handleCityChange(e.target.value)}
              readOnly={!canWrite}
              hint="Only letters and spaces allowed."
            />
            <FormSelect
              label="State *"
              value={form.state}
              onChange={(e) => update("state", upper(e.target.value))}
              options={INDIAN_STATES}
              placeholder="-- Select State --"
              disabled={!canWrite}
            />
            <FormField
              label="Pin Code"
              value={form.pincode}
              onChange={(e) => handlePinCodeChange(e.target.value)}
              placeholder="560001"
              readOnly={!canWrite}
              hint="Only 6 digits allowed."
            />
          </div>
        </div>

        <div style={sectionBlock}>
          <div style={sectionTitle}>Contact Details</div>
          <div style={formGrid2}>
            <FormField
              label="Mobile No"
              value={form.mobile_no}
              onChange={(e) => handleMobileChange(e.target.value)}
              placeholder="9999999999"
              readOnly={!canWrite}
              hint="Only 10 digits allowed."
            />
            <FormField
              label="Phone No"
              value={form.ph_no}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="0801234567"
              readOnly={!canWrite}
              hint="Digits only."
            />
            <FormField
              label="Email ID"
              value={form.email_id}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="name@email.com"
              type="email"
              readOnly={!canWrite}
            />
            <FormField
              label="GST No"
              value={form.gst_no}
              onChange={(e) => handleGSTChange(e.target.value)}
              placeholder="29ABCDE1234F1Z5"
              readOnly={!canWrite}
              hint="Must be 15 characters."
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