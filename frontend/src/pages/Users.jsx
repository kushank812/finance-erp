// src/pages/Users.jsx
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../api/client";

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

    if (!payload.user_id) {
      setErr("User ID is required.");
      return;
    }

    if (!payload.full_name) {
      setErr("Full name is required.");
      return;
    }

    if (!payload.password || payload.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    if (!ROLES.includes(payload.role)) {
      setErr("Invalid role selected.");
      return;
    }

    setSaving(true);
    try {
      await apiPost("/users/", payload);

      setOk(`User "${payload.user_id}" created successfully.`);
      setForm(emptyForm);

      const refreshed = await load(false);
      if (!refreshed) {
        setErr(
          `User "${payload.user_id}" was created, but the user list could not be refreshed.`
        );
      }
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

    if (!payload.full_name) {
      setErr("Full name cannot be empty.");
      return;
    }

    if (!ROLES.includes(payload.role)) {
      setErr("Invalid role selected.");
      return;
    }

    setSaving(true);
    try {
      await apiPut(`/users/${encodeURIComponent(row.user_id)}`, payload);
      setOk(`User "${row.user_id}" updated successfully.`);

      const refreshed = await load(false);
      if (!refreshed) {
        setErr(
          `User "${row.user_id}" was updated, but the user list could not be refreshed.`
        );
      }
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
    if (!pwd || pwd.length < 8) {
      setErr("Reset password must be at least 8 characters.");
      return;
    }

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
    <div style={pageWrap}>
      <div style={pageHeader}>
        <h2 style={title}>User Management</h2>
        <p style={subTitle}>
          Admin-only access. Create users, update roles, activate or deactivate
          accounts, and reset passwords.
        </p>
      </div>

      {err ? <div style={msgErr}>{err}</div> : null}
      {ok ? <div style={msgOk}>{ok}</div> : null}

      <div style={card}>
        <div style={toolbarBetween}>
          <div>
            <h3 style={sectionTitle}>Create User</h3>
            <p style={sectionSub}>
              Add new login accounts for administrators, operators, and viewers.
            </p>
          </div>

          <button
            onClick={() => {
              setErr("");
              setOk("");
              load();
            }}
            style={btnGhost}
            disabled={loading || saving}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <form onSubmit={createUser}>
          <div style={grid4}>
            <div>
              <label style={lbl}>User ID *</label>
              <input
                value={form.user_id}
                onChange={(e) => setFormField("user_id", e.target.value)}
                placeholder="e.g. OPERATOR1"
                style={inp}
                disabled={saving}
              />
            </div>

            <div>
              <label style={lbl}>Full Name *</label>
              <input
                value={form.full_name}
                onChange={(e) => setFormField("full_name", e.target.value)}
                placeholder="e.g. CASHIER 1"
                style={inp}
                disabled={saving}
              />
            </div>

            <div>
              <label style={lbl}>Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setFormField("password", e.target.value)}
                placeholder="Minimum 8 characters"
                style={inp}
                disabled={saving}
              />
            </div>

            <div>
              <label style={lbl}>Role *</label>
              <select
                value={form.role}
                onChange={(e) => setFormField("role", e.target.value)}
                style={inp}
                disabled={saving}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={btnRow}>
            <button type="submit" style={btnPrimary} disabled={saving}>
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ height: 16 }} />

      <div style={card}>
        <div style={toolbarBetween}>
          <div>
            <h3 style={sectionTitle}>Existing Users</h3>
            <p style={sectionSub}>
              Edit full name, role, active status, and reset passwords.
            </p>
          </div>
          <div style={pillInfo}>
            {loading ? "Loading users..." : `${rows.length} user(s)`}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            width="100%"
            cellPadding="10"
            style={table}
          >
            <thead>
              <tr style={tableHeadRow}>
                <th align="left" style={thCell}>User ID</th>
                <th align="left" style={thCell}>Full Name</th>
                <th align="left" style={thCell}>Role</th>
                <th align="center" style={thCell}>Active</th>
                <th align="left" style={thCell}>Reset Password</th>
                <th align="center" style={thCell}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} style={tableRow}>
                  <td style={userIdCell}>{r.user_id}</td>

                  <td style={tdCell}>
                    <input
                      value={r.full_name || ""}
                      onChange={(e) =>
                        setRowField(r.user_id, "full_name", e.target.value)
                      }
                      style={inp}
                      disabled={saving}
                    />
                  </td>

                  <td style={tdCell}>
                    <select
                      value={r.role}
                      onChange={(e) =>
                        setRowField(r.user_id, "role", e.target.value)
                      }
                      style={inp}
                      disabled={saving}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td align="center" style={tdCell}>
                    <input
                      type="checkbox"
                      checked={!!r.is_active}
                      onChange={(e) =>
                        setRowField(r.user_id, "is_active", e.target.checked)
                      }
                      disabled={saving}
                    />
                  </td>

                  <td style={tdCell}>
                    <div style={resetWrap}>
                      <input
                        type="password"
                        value={resetPwdUser === r.user_id ? resetPwdValue : ""}
                        onChange={(e) => {
                          setResetPwdUser(r.user_id);
                          setResetPwdValue(e.target.value);
                        }}
                        placeholder="New password"
                        style={{ ...inp, minWidth: 180 }}
                        disabled={saving}
                      />
                      <button
                        onClick={() => resetPassword(r.user_id)}
                        style={btnWarn}
                        disabled={saving}
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                  </td>

                  <td align="center" style={tdCell}>
                    <button
                      onClick={() => saveRow(r)}
                      style={btnPrimarySmall}
                      disabled={saving}
                      type="button"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" style={emptyCell}>
                    No users found.
                  </td>
                </tr>
              )}

              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6" style={emptyCell}>
                    Loading users...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const pageWrap = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 18,
};

const pageHeader = {
  marginBottom: 14,
};

const title = {
  margin: 0,
  color: "#fff",
  fontSize: 30,
  fontWeight: 900,
};

const subTitle = {
  marginTop: 8,
  color: "#c8cfdb",
  fontSize: 15,
  lineHeight: 1.5,
};

const card = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
};

const toolbarBetween = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const sectionTitle = {
  margin: 0,
  color: "#111827",
  fontSize: 20,
  fontWeight: 900,
};

const sectionSub = {
  margin: "6px 0 0 0",
  color: "#6b7280",
  fontSize: 14,
};

const grid4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const lbl = {
  fontSize: 13,
  color: "#111827",
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
};

const inp = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  outline: "none",
  background: "#fff",
  color: "#111827",
  boxSizing: "border-box",
  fontSize: 14,
};

const btnRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const btnPrimary = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
};

const btnPrimarySmall = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btnWarn = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid #d97706",
  background: "#f59e0b",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btnGhost = {
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

const msgErr = {
  background: "#ffe9e9",
  border: "1px solid #f4b4b4",
  padding: 12,
  borderRadius: 14,
  color: "#b42318",
  marginBottom: 14,
  fontWeight: 600,
};

const msgOk = {
  background: "#e9fff0",
  border: "1px solid #b7ebc6",
  padding: 12,
  borderRadius: 14,
  color: "#067647",
  marginBottom: 14,
  fontWeight: 600,
};

const table = {
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 1050,
};

const tableHeadRow = {
  background: "#f8fafc",
};

const thCell = {
  color: "#111827",
  fontWeight: 900,
  fontSize: 14,
  borderBottom: "1px solid #e5e7eb",
};

const tableRow = {
  borderTop: "1px solid #eef2f7",
};

const tdCell = {
  borderTop: "1px solid #eef2f7",
  verticalAlign: "middle",
};

const userIdCell = {
  fontWeight: 900,
  color: "#111827",
  borderTop: "1px solid #eef2f7",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const emptyCell = {
  padding: 18,
  color: "#6b7280",
  textAlign: "center",
};

const resetWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const pillInfo = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
  color: "#3730a3",
  fontWeight: 800,
  fontSize: 13,
};