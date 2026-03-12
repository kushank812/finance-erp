// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";

import { apiGet, apiPost } from "./api/client";

import EntryScreen from "./pages/EntryScreen";
import CustomerMaster from "./pages/CustomerMaster";
import ItemMaster from "./pages/ItemMaster";
import VendorMaster from "./pages/VendorMaster";
import Users from "./pages/Users";

import BillingNew from "./pages/BillingNew";
import PurchaseBillNew from "./pages/PurchaseBillNew";

import ReceiptNew from "./pages/ReceiptNew";
import VendorPaymentNew from "./pages/VendorPaymentNew";

import Ledger from "./pages/Ledger";
import Aging from "./pages/Aging";
import Statement from "./pages/Statement";

import PurchaseBillView from "./pages/PurchaseBillView";
import SalesInvoiceDirectView from "./pages/SalesInvoiceDirectView";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";

function linkStyle(isActive) {
  return {
    color: isActive ? "#ffffff" : "#9bb7ff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
    padding: "8px 10px",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    border: "1px solid rgba(255,255,255,0.10)",
    background: isActive ? "rgba(11,92,255,0.22)" : "rgba(255,255,255,0.04)",
  };
}

function groupLabelStyle() {
  return {
    color: "#7f8ba3",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    whiteSpace: "nowrap",
    padding: "0 2px",
  };
}

function isAdmin(user) {
  return user?.role === "ADMIN";
}

function isOperator(user) {
  return user?.role === "OPERATOR";
}

function isViewer(user) {
  return user?.role === "VIEWER";
}

function canManageUsers(user) {
  return isAdmin(user);
}

function canDoTransactions(user) {
  return isAdmin(user) || isOperator(user);
}

function canViewReports(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

function canViewMasters(user) {
  return isAdmin(user) || isOperator(user);
}

function FullPageLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1220",
        color: "#fff",
        fontWeight: 800,
        fontSize: 16,
      }}
    >
      Checking session...
    </div>
  );
}

function ProtectedRoute({ children, authReady, authenticated }) {
  const location = useLocation();

  if (!authReady) {
    return <FullPageLoader />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function PublicOnlyRoute({ children, authReady, authenticated }) {
  if (!authReady) {
    return <FullPageLoader />;
  }

  if (authenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Layout({ children, authenticated, authReady, currentUser, onLogout }) {
  const location = useLocation();
  const onLoginPage = location.pathname === "/login";

  if (onLoginPage) {
    return <div style={shell}>{children}</div>;
  }

  if (!authReady) {
    return <FullPageLoader />;
  }

  if (!authenticated) {
    return <div style={shell}>{children}</div>;
  }

  return (
    <div style={shell}>
      <nav style={navStyle}>
        <div style={navInner}>
          <NavLink to="/dashboard" style={{ textDecoration: "none" }}>
            <div style={brand}>Finance AP/AR</div>
          </NavLink>

          <div style={linksRow} className="linksRow">
            <div style={groupLabelStyle()}>Home</div>

            <NavLink to="/dashboard" style={({ isActive }) => linkStyle(isActive)}>
              Dashboard
            </NavLink>

            {canDoTransactions(currentUser) && (
              <NavLink to="/entry" style={({ isActive }) => linkStyle(isActive)}>
                Entry
              </NavLink>
            )}

            <div style={divider} />

            {canDoTransactions(currentUser) && (
              <>
                <div style={groupLabelStyle()}>AR</div>

                <NavLink to="/billing/new" style={({ isActive }) => linkStyle(isActive)}>
                  Create Bill
                </NavLink>

                <NavLink to="/receipt/new" style={({ isActive }) => linkStyle(isActive)}>
                  Receipt
                </NavLink>

                <div style={divider} />

                <div style={groupLabelStyle()}>AP</div>

                <NavLink to="/purchase/new" style={({ isActive }) => linkStyle(isActive)}>
                  Purchase Bill
                </NavLink>

                <NavLink to="/purchase/pay" style={({ isActive }) => linkStyle(isActive)}>
                  Vendor Payment
                </NavLink>

                <div style={divider} />
              </>
            )}

            {canViewReports(currentUser) && (
              <>
                <div style={groupLabelStyle()}>Reports</div>

                <NavLink to="/ledger" style={({ isActive }) => linkStyle(isActive)}>
                  Ledger
                </NavLink>

                <NavLink to="/aging" style={({ isActive }) => linkStyle(isActive)}>
                  Aging
                </NavLink>

                <NavLink to="/statement" style={({ isActive }) => linkStyle(isActive)}>
                  Statement
                </NavLink>

                <div style={divider} />
              </>
            )}

            {canViewMasters(currentUser) && (
              <>
                <div style={groupLabelStyle()}>Masters</div>

                {canManageUsers(currentUser) && (
                  <NavLink to="/users" style={({ isActive }) => linkStyle(isActive)}>
                    Users
                  </NavLink>
                )}

                <NavLink to="/customers" style={({ isActive }) => linkStyle(isActive)}>
                  Customers
                </NavLink>

                <NavLink to="/items" style={({ isActive }) => linkStyle(isActive)}>
                  Items
                </NavLink>

                <NavLink to="/vendors" style={({ isActive }) => linkStyle(isActive)}>
                  Vendors
                </NavLink>

                <div style={divider} />
              </>
            )}

            <NavLink to="/change-password" style={({ isActive }) => linkStyle(isActive)}>
              Change Password
            </NavLink>

            <div style={userPill}>
              {currentUser?.full_name || currentUser?.user_id || "User"}
              {currentUser?.role ? ` • ${currentUser.role}` : ""}
            </div>

            <LogoutButton onLogout={onLogout} />
          </div>
        </div>
      </nav>

      <div style={pagePad}>{children}</div>

      <style>{responsiveCss}</style>
    </div>
  );
}

function LogoutButton({ onLogout }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    try {
      setLoading(true);
      await onLogout();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleLogout} style={logoutBtn} disabled={loading}>
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}

function AppRoutes({ authReady, authenticated, currentUser, logout }) {
  return (
    <Layout
      authenticated={authenticated}
      authReady={authReady}
      currentUser={currentUser}
      onLogout={logout}
    >
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute authReady={authReady} authenticated={authenticated}>
              <Login />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/entry"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <EntryScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <CustomerMaster />
            </ProtectedRoute>
          }
        />

        <Route
          path="/items"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <ItemMaster />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendors"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <VendorMaster />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing/new"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <BillingNew />
            </ProtectedRoute>
          }
        />

        <Route
          path="/receipt/new"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <ReceiptNew />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing/view/:invoiceNo"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <SalesInvoiceDirectView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase/new"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <PurchaseBillNew />
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase/pay"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <VendorPaymentNew />
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchase/view/:billNo"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <PurchaseBillView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ledger"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Ledger />
            </ProtectedRoute>
          }
        />

        <Route
          path="/aging"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Aging />
            </ProtectedRoute>
          }
        />

        <Route
          path="/statement"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Statement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  async function refreshAuth() {
    try {
      const me = await apiGet("/auth/me");
      setAuthenticated(true);
      setCurrentUser(me);
    } catch {
      setAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setAuthReady(true);
    }
  }

  async function logout() {
    try {
      await apiPost("/auth/logout", {});
    } catch {
      // ignore logout failure
    } finally {
      setAuthenticated(false);
      setCurrentUser(null);
      window.location.href = "/login";
    }
  }

  useEffect(() => {
    refreshAuth();
  }, []);

  return (
    <Router>
      <AppRoutes
        authReady={authReady}
        authenticated={authenticated}
        currentUser={currentUser}
        logout={logout}
      />
    </Router>
  );
}

function NotFound() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 18, color: "#fff" }}>
      <h2 style={{ margin: 0 }}>404</h2>
      <p style={{ color: "#b8b8b8" }}>Page not found.</p>
    </div>
  );
}

/* ---- styles ---- */

const shell = {
  minHeight: "100vh",
  background: "#0b1220",
};

const navStyle = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "rgba(11,18,32,0.92)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const navInner = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "10px 12px",
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const brand = {
  color: "#fff",
  fontWeight: 950,
  letterSpacing: 0.2,
  marginRight: 6,
};

const linksRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "nowrap",
  overflowX: "auto",
  paddingBottom: 4,
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "thin",
  scrollbarColor: "#a5b8ff transparent",
};

const divider = {
  width: 1,
  height: 22,
  background: "rgba(255,255,255,0.10)",
  flex: "0 0 auto",
};

const pagePad = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 18,
};

const userPill = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#dbeafe",
  fontWeight: 800,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const logoutBtn = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const responsiveCss = `
.linksRow::-webkit-scrollbar {
  height: 6px;
}

.linksRow::-webkit-scrollbar-track {
  background: transparent;
}

.linksRow::-webkit-scrollbar-thumb {
  background: rgba(160,180,255,0.55);
  border-radius: 10px;
}

.linksRow::-webkit-scrollbar-thumb:hover {
  background: rgba(190,205,255,0.85);
}

@media (max-width: 520px) {
  body { overflow-x: hidden; }
}
`;