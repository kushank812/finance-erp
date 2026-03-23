// src/pages/Users.jsx
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../api/client";
import AlertBox from "../components/ui/AlertBox";
import PageHeaderBlock from "../components/ui/PageHeaderBlock";
import { FormField, FormSelect } from "../components/ui/FormField";
import {
  page,
  stack,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle,
  formGrid4,
  actionBar,
  saveActions,
  tableWrap,
  table,
  th,
  thCenter,
  tr,
  td,
  tdCode,
  tdCenter,
  emptyTd,
  btnPrimary,
  btnSecondary,
  btnGhost,
  btnMini,
  btnWarn,
  badgeBlue,
  badgeGreen,
  input,
} from "../components/ui/uiStyles";

const ROLES = ["ADMIN", "OPERATOR", "VIEWER"];

const emptyForm = {
  user_id: "",
  full_name: "",
  password: "",
  role: "OPERATOR",
};

export default function Users() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [form, setForm] = useState(emptyForm);

  const [resetPwdUser, setResetPwdUser] = useState("");
  const [resetPwdValue, setResetPwdValue] = useState("");

  async function load(showLoader = true) {
    if (showLoader) setLoading(true);
    try {
      const data = await apiGet("/users/");
      setRows(Array.isArray(data) ? data : []);
      return true;
    } catch (e) {
      setErr(String(e.message || e));
      return false;
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    setErr("");
    setOk("");
    load();
  }, []);

  function setFormField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setRowField(userId, key, value) {
    setRows((prev) =>
      prev.map((row) =>
        row.user_id === userId ? { ...row, [key]: value } : row
      )
    );
  }

  function clearCreateForm() {
    setForm(emptyForm);
    setErr("");
    setOk("");
  }

  async function createUser(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    const payload = {
      user_id: String(form.user_id || "").trim().toUpperCase(),
      full_name: String(form.full_name || "").trim().toUpperCase(),
      password: form.password,
      role: String(form.role || "").trim().toUpperCase(),
    };

    if (!payload.user_id) return setErr("User ID is required.");
    if (!payload.full_name) return setErr("Full name is required.");
    if (!payload.password || payload.password.length < 8)
      return setErr("Password must be at least 8 characters.");
    if (!ROLES.includes(payload.role))
      return setErr("Invalid role selected.");

    setSaving(true);
    try {
      await apiPost("/users/", payload);
      setOk(`User "${payload.user_id}" created successfully.`);
      setForm(emptyForm);
      await load(false);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function saveRow(row) {
    setErr("");
    setOk("");

    const payload = {
      full_name: String(row.full_name || "").trim().toUpperCase(),
      role: String(row.role || "").trim().toUpperCase(),
      is_active: !!row.is_active,
    };

    if (!payload.full_name) return setErr("Full name cannot be empty.");
    if (!ROLES.includes(payload.role))
      return setErr("Invalid role selected.");

    setSaving(true);
    try {
      await apiPut(`/users/${encodeURIComponent(row.user_id)}`, payload);
      setOk(`User "${row.user_id}" updated successfully.`);
      await load(false);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(userId) {
    setErr("");
    setOk("");

    const pwd = resetPwdUser === userId ? resetPwdValue : "";
    if (!pwd || pwd.length < 8)
      return setErr("Reset password must be at least 8 characters.");

    setSaving(true);
    try {
      await apiPost(`/users/${encodeURIComponent(userId)}/reset-password`, {
        new_password: pwd,
      });
      setOk(`Password reset successfully for "${userId}".`);
      setResetPwdUser("");
      setResetPwdValue("");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={page}>
      <PageHeaderBlock
        eyebrowText="ADMINISTRATION"
        title="User Management"
        subtitle="Admin-only access. Create users, update roles, activate or deactivate accounts, and reset passwords."
      />

      <div style={stack}>
        {err && <AlertBox kind="error" message={err} />}
        {ok && <AlertBox kind="success" message={ok} />}
        {loading && <AlertBox kind="info" message="Loading users..." />}
      </div>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Create User</h2>
            <p style={cardSubtitle}>
              Add new login accounts for administrators, operators, and viewers.
            </p>
          </div>
          <div style={badgeGreen}>CREATE</div>
        </div>

        <form onSubmit={createUser}>
          {/* ✅ ADDED BIG GAP BELOW FIELDS */}
          <div style={{ ...formGrid4, marginBottom: 32 }}>
            <FormField
              label="User ID *"
              value={form.user_id}
              onChange={(e) => setFormField("user_id", e.target.value)}
              placeholder="e.g. OPERATOR1"
              disabled={saving}
            />

            <FormField
              label="Full Name *"
              value={form.full_name}
              onChange={(e) => setFormField("full_name", e.target.value)}
              placeholder="e.g. CASHIER 1"
              disabled={saving}
            />

            <FormField
              label="Password *"
              type="password"
              value={form.password}
              onChange={(e) => setFormField("password", e.target.value)}
              placeholder="Minimum 8 characters"
              disabled={saving}
            />

            <FormSelect
              label="Role *"
              value={form.role}
              onChange={(e) => setFormField("role", e.target.value)}
              options={ROLES}
              disabled={saving}
            />
          </div>

          {/* ✅ EXTRA GAP ABOVE BUTTONS */}
          <div style={{ ...actionBar, marginTop: 20 }}>
            <div style={{ ...saveActions, gap: 16 }}>
              <button type="submit" style={btnPrimary} disabled={saving}>
                {saving ? "Creating..." : "Create User"}
              </button>

              <button
                type="button"
                onClick={clearCreateForm}
                style={btnSecondary}
                disabled={saving}
              >
                Clear
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* -------- Existing Users Section unchanged -------- */}
      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={cardTitle}>Existing Users</h2>
            <p style={cardSubtitle}>
              Edit full name, role, active status, and reset passwords.
            </p>
          </div>
          <div style={badgeBlue}>
            {loading ? "Loading..." : `${rows.length} USER(S)`}
          </div>
        </div>

        <div style={tableWrap}>
          <table style={{ ...table, minWidth: 1050 }}>
            <thead>
              <tr>
                <th style={th}>User ID</th>
                <th style={th}>Full Name</th>
                <th style={th}>Role</th>
                <th style={thCenter}>Active</th>
                <th style={th}>Reset Password</th>
                <th style={thCenter}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} style={tr}>
                  <td style={{ ...tdCode }}>{r.user_id}</td>

                  <td style={td}>
                    <input
                      value={r.full_name || ""}
                      onChange={(e) =>
                        setRowField(r.user_id, "full_name", e.target.value)
                      }
                      style={input}
                      disabled={saving}
                    />
                  </td>

                  <td style={td}>
                    <select
                      value={r.role}
                      onChange={(e) =>
                        setRowField(r.user_id, "role", e.target.value)
                      }
                      style={input}
                      disabled={saving}
                    >
                      {ROLES.map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>

                  <td style={tdCenter}>
                    <input
                      type="checkbox"
                      checked={!!r.is_active}
                      onChange={(e) =>
                        setRowField(r.user_id, "is_active", e.target.checked)
                      }
                    />
                  </td>

                  <td style={td}>
                    <div style={resetWrap}>
                      <input
                        type="password"
                        value={resetPwdUser === r.user_id ? resetPwdValue : ""}
                        onChange={(e) => {
                          setResetPwdUser(r.user_id);
                          setResetPwdValue(e.target.value);
                        }}
                        placeholder="New password"
                        style={{ ...input, minWidth: 180 }}
                      />
                      <button
                        onClick={() => resetPassword(r.user_id)}
                        style={btnWarn}
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                  </td>

                  <td style={tdCenter}>
                    <button
                      onClick={() => saveRow(r)}
                      style={btnMini}
                      type="button"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan="6" style={emptyTd}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const resetWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};