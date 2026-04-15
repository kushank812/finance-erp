import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { apiGet, apiPost } from "./api/client";

import EntryScreen from "./pages/EntryScreen";
import CustomerMaster from "./pages/CustomerMaster";
import ItemMaster from "./pages/ItemMaster";
import VendorMaster from "./pages/VendorMaster";
import Users from "./pages/Users";

import BillingNew from "./pages/BillingNew";
import PurchaseBillNew from "./pages/PurchaseBillNew";

import ReceiptNew from "./pages/ReceiptNew";
import ReceiptList from "./pages/ReceiptList";
import VendorPaymentNew from "./pages/VendorPaymentNew";
import VendorPaymentList from "./pages/VendorPaymentList";

import Ledger from "./pages/Ledger";
import Aging from "./pages/Aging";
import Statement from "./pages/Statement";

import PurchaseBillView from "./pages/PurchaseBillView";
import PurchaseBillPrintView from "./pages/PurchaseBillPrintView";
import SalesInvoiceDirectView from "./pages/SalesInvoiceDirectView";
import SalesInvoicePrintView from "./pages/SalesInvoicePrintView";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import AIWorkspacePage from "./pages/AIWorkspacePage";

import ReceiptView from "./pages/ReceiptView";
import VendorPaymentView from "./pages/VendorPaymentView";
import AuditLogs from "./pages/AuditLogs";

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

function canViewAudit(user) {
  return isAdmin(user);
}

function canDoTransactions(user) {
  return isAdmin(user) || isOperator(user);
}

function canViewReports(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

function canViewMasters(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

function canViewDocuments(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
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

  if (!authReady) return <FullPageLoader />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function AdminRoute({ children, authReady, authenticated, currentUser }) {
  const location = useLocation();

  if (!authReady) return <FullPageLoader />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin(currentUser)) {
    return <Navigate to="/entry" replace />;
  }

  return children;
}

function MastersRoute({ children, authReady, authenticated, currentUser }) {
  const location = useLocation();

  if (!authReady) return <FullPageLoader />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canViewMasters(currentUser)) {
    return <Navigate to="/entry" replace />;
  }

  return children;
}

function TransactionRoute({ children, authReady, authenticated, currentUser }) {
  const location = useLocation();

  if (!authReady) return <FullPageLoader />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canDoTransactions(currentUser)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ReportsRoute({ children, authReady, authenticated, currentUser }) {
  const location = useLocation();

  if (!authReady) return <FullPageLoader />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canViewReports(currentUser)) {
    return <Navigate to="/entry" replace />;
  }

  return children;
}

function DocumentViewRoute({ children, authReady, authenticated, currentUser }) {
  const location = useLocation();

  if (!authReady) return <FullPageLoader />;

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canViewDocuments(currentUser)) {
    return <Navigate to="/entry" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children, authReady, authenticated }) {
  if (!authReady) return <FullPageLoader />;

  if (authenticated) {
    return <Navigate to="/entry" replace />;
  }

  return children;
}

function topLinkStyle(isActive) {
  return {
    color: isActive ? "#ffffff" : "#c7d2fe",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.2,
    padding: "10px 14px",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    border: "1px solid rgba(255,255,255,0.08)",
    background: isActive ? "rgba(37,99,235,0.28)" : "rgba(255,255,255,0.04)",
    transition: "all 0.18s ease",
  };
}

function topButtonStyle(active = false) {
  return {
    color: active ? "#ffffff" : "#c7d2fe",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.2,
    padding: "10px 14px",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    border: "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.04)",
    transition: "all 0.18s ease",
    cursor: "pointer",
    userSelect: "none",
  };
}

function navChipStyle() {
  return {
    color: "#dbe5ff",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.2,
    padding: "10px 14px",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
  };
}

function DropdownMenu({ label, items }) {
  const [open, setOpen] = useState(false);

  if (!items?.length) return null;

  return (
    <div
      style={{ position: "relative", flex: "0 0 auto" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        style={topButtonStyle(open)}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.9 }}>▼</span>
      </button>

      {open && (
        <div style={dropdownMenuStyle}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...dropdownItemStyle,
                background: isActive ? "rgba(37,99,235,0.18)" : "transparent",
                color: isActive ? "#ffffff" : "#dbe5ff",
              })}
              onClick={() => setOpen(false)}
            >
              <div style={{ fontWeight: 700 }}>{item.label}</div>
              {item.hint ? (
                <div style={{ fontSize: 12, color: "#93a4c3", marginTop: 2 }}>
                  {item.hint}
                </div>
              ) : null}
            </NavLink>
          ))}
        </div>
      )}
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
    <button
      type="button"
      onClick={handleLogout}
      style={{
        ...navChipStyle(),
        cursor: loading ? "not-allowed" : "pointer",
      }}
      disabled={loading}
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
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

  const homeItems = [
    { to: "/dashboard", label: "Dashboard", hint: "Overview and KPIs" },
    { to: "/ai", label: "AI Workspace", hint: "Insights and assistant" },
    ...(canDoTransactions(currentUser)
      ? [{ to: "/entry", label: "Entry", hint: "Quick transaction entry" }]
      : []),
  ];

  const arItems = [
    ...(canDoTransactions(currentUser)
      ? [{ to: "/billing", label: "Create Invoice", hint: "Create sales invoice" }]
      : []),
    ...(canViewDocuments(currentUser)
      ? [{ to: "/sales-invoices", label: "Invoices", hint: "View all invoices" }]
      : []),
    ...(canDoTransactions(currentUser)
      ? [{ to: "/receipt/new", label: "Receipt", hint: "Record customer receipt" }]
      : []),
    ...(canViewDocuments(currentUser)
      ? [{ to: "/receipts", label: "Receipts", hint: "View receipt history" }]
      : []),
  ];

  const apItems = [
    ...(canDoTransactions(currentUser)
      ? [{ to: "/purchase/new", label: "Purchase Bill", hint: "Create vendor bill" }]
      : []),
    ...(canViewDocuments(currentUser)
      ? [{ to: "/purchase-bills", label: "Bills", hint: "View purchase bills" }]
      : []),
    ...(canDoTransactions(currentUser)
      ? [{ to: "/purchase/pay", label: "Vendor Payment", hint: "Record payment" }]
      : []),
    ...(canViewDocuments(currentUser)
      ? [{ to: "/vendor-payments", label: "Payments", hint: "View payment history" }]
      : []),
  ];

  const reportItems = canViewReports(currentUser)
    ? [
        { to: "/ledger", label: "Ledger", hint: "AR and AP movement" },
        { to: "/aging", label: "Aging", hint: "Outstanding buckets" },
        { to: "/statement", label: "Statement", hint: "Customer or vendor statement" },
      ]
    : [];

  const masterItems = canViewMasters(currentUser)
    ? [
        { to: "/customers", label: "Customers", hint: "Customer master" },
        { to: "/items", label: "Items", hint: "Item master" },
        { to: "/vendors", label: "Vendors", hint: "Vendor master" },
        ...(canManageUsers(currentUser)
          ? [{ to: "/users", label: "Users", hint: "User administration" }]
          : []),
      ]
    : [];

  const adminItems = canViewAudit(currentUser)
    ? [{ to: "/audit", label: "Audit Logs", hint: "Activity history" }]
    : [];

  return (
    <div style={shell}>
      <nav style={navStyle}>
        <div style={navInner}>
          <div style={brandBlock}>
            <NavLink to="/entry" style={{ textDecoration: "none" }}>
              <div style={brand}>Finance AP/AR</div>
            </NavLink>
            <div style={brandSub}>Accounts Receivable & Payable</div>
          </div>

          <div style={navCenter}>
            <DropdownMenu label="Home" items={homeItems} />
            {arItems.length > 0 && <DropdownMenu label="AR" items={arItems} />}
            {apItems.length > 0 && <DropdownMenu label="AP" items={apItems} />}
            {reportItems.length > 0 && (
              <DropdownMenu label="Reports" items={reportItems} />
            )}
            {masterItems.length > 0 && (
              <DropdownMenu label="Masters" items={masterItems} />
            )}
            {adminItems.length > 0 && (
              <DropdownMenu label="Admin" items={adminItems} />
            )}
          </div>

          <div style={navRight}>
            <NavLink
              to="/change-password"
              style={({ isActive }) => topLinkStyle(isActive)}
            >
              Change Password
            </NavLink>

            <div style={navChipStyle()}>
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

function AppRoutes({ authReady, authenticated, currentUser, logout, refreshAuth }) {
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
              <Login refreshAuth={refreshAuth} />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <Navigate to="/entry" replace />
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
          path="/ai"
          element={
            <ProtectedRoute authReady={authReady} authenticated={authenticated}>
              <AIWorkspacePage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/entry"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <EntryScreen />
            </TransactionRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <MastersRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <CustomerMaster />
            </MastersRoute>
          }
        />

        <Route
          path="/items"
          element={
            <MastersRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <ItemMaster />
            </MastersRoute>
          }
        />

        <Route
          path="/vendors"
          element={
            <MastersRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <VendorMaster />
            </MastersRoute>
          }
        />

        <Route
          path="/users"
          element={
            <AdminRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <Users />
            </AdminRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <AdminRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <AuditLogs />
            </AdminRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <BillingNew />
            </TransactionRoute>
          }
        />

        <Route
          path="/billing/edit/:invoiceNo"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <BillingNew />
            </TransactionRoute>
          }
        />

        <Route
          path="/sales-invoices"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <SalesInvoiceDirectView currentUser={currentUser} />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/sales-invoice-view/:invoiceNo"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <SalesInvoicePrintView />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/receipt/new"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <ReceiptNew />
            </TransactionRoute>
          }
        />

        <Route
          path="/receipts"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <ReceiptList currentUser={currentUser} />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/receipt/view/:receiptNo"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <ReceiptView />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/purchase/new"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <PurchaseBillNew />
            </TransactionRoute>
          }
        />

        <Route
          path="/purchase/edit/:billNo"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <PurchaseBillNew />
            </TransactionRoute>
          }
        />

        <Route
          path="/purchase-bills"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <PurchaseBillView currentUser={currentUser} />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/purchase/view/:billNo"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <PurchaseBillPrintView />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/purchase/pay"
          element={
            <TransactionRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <VendorPaymentNew />
            </TransactionRoute>
          }
        />

        <Route
          path="/vendor-payments"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <VendorPaymentList currentUser={currentUser} />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/vendor-payment/view/:paymentNo"
          element={
            <DocumentViewRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <VendorPaymentView />
            </DocumentViewRoute>
          }
        />

        <Route
          path="/ledger"
          element={
            <ReportsRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <Ledger />
            </ReportsRoute>
          }
        />

        <Route
          path="/aging"
          element={
            <ReportsRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <Aging />
            </ReportsRoute>
          }
        />

        <Route
          path="/statement"
          element={
            <ReportsRoute
              authReady={authReady}
              authenticated={authenticated}
              currentUser={currentUser}
            >
              <Statement />
            </ReportsRoute>
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

function AppShell() {
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const bootstrapped = useRef(false);

  async function refreshAuth(options = {}) {
    const { silent = false } = options;

    if (!silent) {
      setAuthReady(false);
    }

    try {
      const me = await apiGet("/auth/me");
      setAuthenticated(true);
      setCurrentUser(me);
      return true;
    } catch {
      setAuthenticated(false);
      setCurrentUser(null);
      return false;
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
      setAuthReady(true);
      navigate("/login", { replace: true });
    }
  }

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    refreshAuth();
  }, []);

  return (
    <AppRoutes
      authReady={authReady}
      authenticated={authenticated}
      currentUser={currentUser}
      logout={logout}
      refreshAuth={refreshAuth}
    />
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
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

const shell = {
  minHeight: "100vh",
  background: "#0b1220",
};

const navStyle = {
  position: "sticky",
  top: 0,
  zIndex: 60,
  background:
    "linear-gradient(180deg, rgba(6,13,27,0.96) 0%, rgba(11,18,32,0.94) 100%)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
};

const navInner = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const brandBlock = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 180,
};

const brand = {
  color: "#ffffff",
  fontWeight: 950,
  fontSize: 24,
  letterSpacing: 0.2,
  lineHeight: 1.05,
};

const brandSub = {
  color: "#8ea3c7",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.3,
};

const navCenter = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  flex: 1,
  minWidth: 320,
  flexWrap: "wrap",
};

const navRight = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const dropdownMenuStyle = {
  position: "absolute",
  top: "calc(100% + 10px)",
  left: 0,
  minWidth: 250,
  background: "rgba(10,18,34,0.98)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 10,
  boxShadow: "0 18px 48px rgba(0,0,0,0.34)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const dropdownItemStyle = {
  textDecoration: "none",
  padding: "12px 12px",
  borderRadius: 12,
  transition: "all 0.16s ease",
  border: "1px solid transparent",
};

const pagePad = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: 18,
};

const responsiveCss = `
@media (max-width: 1100px) {
  .nav-hide-mobile {
    display: none !important;
  }
}

@media (max-width: 820px) {
  body {
    overflow-x: hidden;
  }
}
`;