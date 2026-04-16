function normalizePath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "/";
  return raw.replace(/\/+$/, "") || "/";
}

export function isAdmin(user) {
  return user?.role === "ADMIN";
}

export function isOperator(user) {
  return user?.role === "OPERATOR";
}

export function isViewer(user) {
  return user?.role === "VIEWER";
}

export function canViewReports(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

export function canViewDocuments(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

export function canDoTransactions(user) {
  return isAdmin(user) || isOperator(user);
}

export function canManageUsers(user) {
  return isAdmin(user);
}

export function canViewAudit(user) {
  return isAdmin(user);
}

export function canViewMasters(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

export function canNavigateTo(path, user) {
  const normalizedPath = normalizePath(path);

  if (!user?.role) return false;

  if (
    normalizedPath === "/" ||
    normalizedPath === "/dashboard" ||
    normalizedPath === "/change-password" ||
    normalizedPath === "/ai"
  ) {
    return true;
  }

  if (normalizedPath === "/users") {
    return canManageUsers(user);
  }

  if (normalizedPath === "/audit") {
    return canViewAudit(user);
  }

  if (
    normalizedPath === "/entry" ||
    normalizedPath === "/billing" ||
    normalizedPath === "/receipt/new" ||
    normalizedPath === "/purchase/new" ||
    normalizedPath === "/purchase/pay" ||
    normalizedPath.startsWith("/billing/edit/") ||
    normalizedPath.startsWith("/purchase/edit/")
  ) {
    return canDoTransactions(user);
  }

  if (
    normalizedPath === "/ledger" ||
    normalizedPath === "/aging" ||
    normalizedPath === "/statement"
  ) {
    return canViewReports(user);
  }

  if (
    normalizedPath === "/customers" ||
    normalizedPath === "/vendors" ||
    normalizedPath === "/items"
  ) {
    return canViewMasters(user);
  }

  if (
    normalizedPath === "/sales-invoices" ||
    normalizedPath === "/purchase-bills" ||
    normalizedPath === "/receipts" ||
    normalizedPath === "/vendor-payments" ||
    normalizedPath.startsWith("/sales-invoice-view/") ||
    normalizedPath.startsWith("/purchase/view/") ||
    normalizedPath.startsWith("/receipt/view/") ||
    normalizedPath.startsWith("/vendor-payment/view/")
  ) {
    return canViewDocuments(user);
  }

  return false;
}

export function safeNavigate(path, navigate, user, destinationLabel) {
  const normalizedPath = normalizePath(path);

  if (!user?.role) {
    return {
      blocked: true,
      result: {
        reply:
          "Your session details are not loaded in the AI panel yet. Please wait a moment and try again.",
        cards: [
          {
            type: "summary",
            title: "Session Not Ready",
            rows: [
              { label: "Requested screen", value: destinationLabel || normalizedPath },
              { label: "Route", value: normalizedPath },
              { label: "Role", value: "Not loaded" },
              { label: "Status", value: "Blocked" },
            ],
          },
        ],
      },
    };
  }

  if (!canNavigateTo(normalizedPath, user)) {
    return {
      blocked: true,
      result: {
        reply:
          user?.role === "VIEWER"
            ? `Access denied. ${destinationLabel} is not allowed for VIEWER role.`
            : "Access denied. You are not allowed to open this screen.",
        cards: [
          {
            type: "summary",
            title: "Permission Blocked",
            rows: [
              { label: "Requested screen", value: destinationLabel || normalizedPath },
              { label: "Route", value: normalizedPath },
              { label: "Your role", value: user?.role || "UNKNOWN" },
              { label: "Status", value: "Blocked" },
            ],
          },
        ],
      },
    };
  }

  navigate(normalizedPath);

  return {
    blocked: false,
    result: {
      reply: `Opening ${destinationLabel || normalizedPath}...`,
      cards: [
        {
          type: "summary",
          title: "Navigation",
          rows: [
            { label: "Destination", value: destinationLabel || normalizedPath },
            { label: "Route", value: normalizedPath },
            { label: "Status", value: "Allowed" },
          ],
        },
      ],
    },
  };
}