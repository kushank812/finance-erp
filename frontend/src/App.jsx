import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

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
import GlobalAIAssistant from "./components/ui/GlobalAIAssistant";

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
    return <Navigate to="/dashboard" replace />;
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
    return <Navigate to="/dashboard" replace />;
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
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function DocumentViewRoute({
  children,
  authReady,
  authenticated,
  currentUser,
}) {
  const location = useLocation();

  if (!authReady) return <FullPageLoader />;
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!canViewDocuments(currentUser)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children, authReady, authenticated }) {
  if (!authReady) return <FullPageLoader />;
  if (authenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function Layout({ authenticated, currentUser, logout, children }) {
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState("Home");

  const navGroups = useMemo(() => {
    const groups = [
      {
        title: "Home",
        items: [
          { label: "Dashboard", to: "/dashboard" },
          ...(canDoTransactions(currentUser)
            ? [
                { label: "Entry", to: "/entry" },
                { label: "Open AI", to: "/ai" },
              ]
            : [{ label: "Open AI", to: "/ai" }]),
        ],
      },

      ...(canDoTransactions(currentUser)
        ? [
            {
              title: "AR",
              items: [
                { label: "Create Invoice", to: "/billing" },
                { label: "Create Receipt", to: "/receipt/new" },
              ],
            },
            {
              title: "AP",
              items: [
                { label: "Create Bill", to: "/purchase/new" },
                { label: "Create Payment", to: "/purchase/pay" },
                { label: "Payments", to: "/vendor-payments" },
              ],
            },
          ]
        : []),

      ...(canViewReports(currentUser)
        ? [
            {
              title: "Reports",
              items: [
                { label: "Ledger", to: "/ledger" },
                { label: "Aging", to: "/aging" },
                { label: "Statement", to: "/statement" },
              ],
            },
          ]
        : []),

      ...(canViewMasters(currentUser)
        ? [
            {
              title: "Masters",
              items: [
                { label: "Customers", to: "/customers" },
                { label: "Items", to: "/items" },
                { label: "Vendors", to: "/vendors" },
              ],
            },
          ]
        : []),

      ...(canManageUsers(currentUser) || canViewAudit(currentUser)
        ? [
            {
              title: "Admin",
              items: [
                ...(canManageUsers(currentUser)
                  ? [{ label: "Users", to: "/users" }]
                  : []),
                ...(canViewAudit(currentUser)
                  ? [{ label: "Audit Logs", to: "/audit" }]
                  : []),
              ],
            },
          ]
        : []),

      {
        title: "Account",
        items: [{ label: "Change Password", to: "/change-password" }],
      },
    ];

    return groups;
  }, [currentUser]);

  useEffect(() => {
    const activeGroup =
      navGroups.find((group) =>
        group.items.some((item) => location.pathname.startsWith(item.to))
      )?.title || "Home";

    setOpenGroup(activeGroup);
  }, [location.pathname, navGroups]);

  if (!authenticated) return children;

  return (
    <div style={shell}>
      <nav style={navStyle}>
        <div style={navInner}>
          <div style={topRow}>
            <div style={brandBlock}>
              <div style={brandIcon}>F</div>
              <div>
                <div style={brandTitle}>Finance AP/AR</div>
                <div style={brandSub}>
                  Accounts Receivable / Accounts Payable
                </div>
              </div>
            </div>

            <div style={userBlock}>
              <div style={userChip}>
                {currentUser?.full_name || currentUser?.user_id || "User"}
                {currentUser?.role ? ` • ${currentUser.role}` : ""}
              </div>

              <button type="button" onClick={logout} style={logoutBtn}>
                Logout
              </button>
            </div>
          </div>

          <div style={groupTabsWrap}>
            {navGroups.map((group) => {
              const isOpen = openGroup === group.title;

              return (
                <button
                  key={group.title}
                  type="button"
                  onClick={() =>
                    setOpenGroup((prev) =>
                      prev === group.title ? "" : group.title
                    )
                  }
                  style={{
                    ...groupTabBtn,
                    ...(isOpen ? groupTabBtnActive : {}),
                  }}
                >
                  {group.title}
                </button>
              );
            })}
          </div>

          {openGroup ? (
            <div style={submenuWrap}>
              {navGroups
                .find((group) => group.title === openGroup)
                ?.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={({ isActive }) => ({
                      ...subLink,
                      ...(isActive ? subLinkActive : {}),
                    })}
                  >
                    {item.label}
                  </NavLink>
                ))}
            </div>
          ) : null}
        </div>
      </nav>

      <div style={pagePad}>{children}</div>

      <GlobalAIAssistant />

      <style>{responsiveCss}</style>
    </div>
  );
}

function AppRoutes({
  authReady,
  authenticated,
  currentUser,
  logout,
  refreshAuth,
}) {
  return (
    <Layout
      authenticated={authenticated}
      currentUser={currentUser}
      logout={logout}
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
              <EntryScreen currentUser={currentUser} />
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
        refreshAuth={refreshAuth}
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

const shell = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,0.16), transparent 24%), #0b1220",
};

const navStyle = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "rgba(11,18,32,0.94)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
};

const navInner = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: "14px 18px 16px",
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const brandBlock = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const brandIcon = {
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 22,
  boxShadow: "0 12px 24px rgba(37,99,235,0.28)",
};

const brandTitle = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 22,
  lineHeight: 1.1,
};

const brandSub = {
  color: "#94a3b8",
  fontSize: 12,
  marginTop: 4,
};

const userBlock = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const userChip = {
  color: "#dbeafe",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 999,
  padding: "9px 14px",
  fontSize: 13,
  fontWeight: 700,
};

const logoutBtn = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  borderRadius: 999,
  padding: "9px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const groupTabsWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const groupTabBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  borderRadius: 14,
  padding: "10px 16px",
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 0.2,
  cursor: "pointer",
};

const groupTabBtnActive = {
  color: "#ffffff",
  background: "rgba(37,99,235,0.18)",
  border: "1px solid rgba(96,165,250,0.38)",
  boxShadow: "0 8px 20px rgba(37,99,235,0.16)",
};

const submenuWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const subLink = {
  textDecoration: "none",
  color: "#cbd5e1",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  padding: "10px 14px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 800,
};

const subLinkActive = {
  color: "#fff",
  background:
    "linear-gradient(135deg, rgba(37,99,235,0.30), rgba(29,78,216,0.24))",
  border: "1px solid rgba(96,165,250,0.40)",
};

const pagePad = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: 18,
};

const responsiveCss = `
@media (max-width: 700px) {
  body { overflow-x: hidden; }
}
`;