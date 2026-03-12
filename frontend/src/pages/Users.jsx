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

  async function load() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const data = await apiGet("/users/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setFormField(key, value) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function createUser(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    const payload = {
      user_id: form.user_id.trim().toUpperCase(),
      full_name: form.full_name.trim().toUpperCase(),
      password: form.password,
      role: form.role,
    };

    if (!payload.user_id) return setErr("User ID is required.");
    if (!payload.full_name) return setErr("Full name is required.");
    if (!payload.password || payload.password.length < 8) {
      return setErr("Password must be at least 8 characters.");
    }

    try {
      setSaving(true);
      await apiPost("/users/", payload);
      setOk(`User "${payload.user_id}" created successfully.`);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function saveRow(row) {
    setErr("");
    setOk("");

    try {
      setSaving(true);
      await apiPut(`/users/${encodeURIComponent(row.user_id)}`, {
        full_name: String(row.full_name || "").trim().toUpperCase(),
        role: row.role,
        is_active: !!row.is_active,
      });
      setOk(`User "${row.user_id}" updated successfully.`);
      await load();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  function setRowField(userId, key, value) {
    setRows((prev) =>
      prev.map((r) => (r.user_id === userId ? { ...r, [key]: value } : r))
    );
  }

  async function resetPassword(userId) {
    setErr("");
    setOk("");

    const pwd = resetPwdUser === userId ? resetPwdValue : "";
    if (!pwd || pwd.length < 8) {
      return setErr("Reset password must be at least 8 characters.");
    }

    try {
      setSaving(true);
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <h2 style={{ margin: 0, color: "#fff" }}>User Management</h2>
      <p style={{ marginTop: 6, color: "#b8b8b8" }}>
        Admin-only access. Create users, update roles, activate/deactivate accounts,
        and reset passwords.
      </p>

      {err ? <div style={msgErr}>{err}</div> : null}
      {ok ? <div style={msgOk}>{ok}</div> : null}

      <div style={card}>
        <div style={toolbarBetween}>
          <h3 style={{ margin: 0, color: "#111" }}>Create User</h3>
          <button onClick={load} style={btnGhost} disabled={loading || saving}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ height: 14 }} />

        <form onSubmit={createUser}>
          <div style={grid4}>
            <div>
              <label style={lbl}>User ID *</label>
              <input
                value={form.user_id}
                onChange={(e) => setFormField("user_id", e.target.value)}
                placeholder="e.g. OPERATOR1"
                style={inp}
              />
            </div>

            <div>
              <label style={lbl}>Full Name *</label>
              <input
                value={form.full_name}
                onChange={(e) => setFormField("full_name", e.target.value)}
                placeholder="e.g. CASHIER 1"
                style={inp}
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
              />
            </div>

            <div>
              <label style={lbl}>Role *</label>
              <select
                value={form.role}
                onChange={(e) => setFormField("role", e.target.value)}
                style={inp}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
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
        <h3 style={{ marginTop: 0, color: "#111" }}>Existing Users</h3>

        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 1050 }}>
            <thead>
              <tr style={{ background: "#f6f7f9" }}>
                <th align="left">User ID</th>
                <th align="left">Full Name</th>
                <th align="left">Role</th>
                <th align="center">Active</th>
                <th align="left">Reset Password</th>
                <th align="center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ fontWeight: 900, color: "#111" }}>{r.user_id}</td>

                  <td>
                    <input
                      value={r.full_name || ""}
                      onChange={(e) => setRowField(r.user_id, "full_name", e.target.value)}
                      style={inp}
                    />
                  </td>

                  <td>
                    <select
                      value={r.role}
                      onChange={(e) => setRowField(r.user_id, "role", e.target.value)}
                      style={inp}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td align="center">
                    <input
                      type="checkbox"
                      checked={!!r.is_active}
                      onChange={(e) => setRowField(r.user_id, "is_active", e.target.checked)}
                    />
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="password"
                        value={resetPwdUser === r.user_id ? resetPwdValue : ""}
                        onChange={(e) => {
                          setResetPwdUser(r.user_id);
                          setResetPwdValue(e.target.value);
                        }}
                        placeholder="New password"
                        style={{ ...inp, minWidth: 180 }}
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

                  <td align="center">
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
                  <td colSpan="6" style={{ padding: 12, color: "#666" }}>
                    No users found.
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

/* ---- styles ---- */

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 16,
};

const grid4 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const toolbarBetween = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "end",
  justifyContent: "space-between",
};

const lbl = {
  fontSize: 13,
  color: "#111",
  display: "block",
  marginBottom: 6,
  fontWeight: 800,
};

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

const btnRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
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

const btnPrimarySmall = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnWarn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #d97706",
  background: "#f59e0b",
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