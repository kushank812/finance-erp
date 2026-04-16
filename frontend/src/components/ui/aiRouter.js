import { safeNavigate } from "./aiPermissions";
import { fetchFinanceSnapshot } from "./aiSnapshotService";
import {
  buildBillSearch,
  buildCustomerDues,
  buildDailyFinanceSummary,
  buildDashboard,
  buildMasterSummary,
  buildOverdue,
  buildRecentReceipts,
  buildRecentVendorPayments,
  buildUnknown,
  buildVendorDues,
  buildInvoiceSearch,
} from "./aiResponseBuilders";

export async function routeAI(intent, entities, navigate, currentUser) {
  if (intent === "navigate" && entities?.navigationTarget) {
    return safeNavigate(
      entities.navigationTarget.path,
      navigate,
      currentUser,
      entities.navigationTarget.label
    ).result;
  }

  const snapshot = await fetchFinanceSnapshot();

  switch (intent) {
    case "dashboard":
      return buildDashboard(snapshot);

    case "daily_summary":
      return buildDailyFinanceSummary(snapshot);

    case "overdue":
      return buildOverdue(snapshot, entities);

    case "vendor_dues":
      return buildVendorDues(snapshot, entities);

    case "customer_dues":
      return buildCustomerDues(snapshot, entities);

    case "invoice_search":
      return buildInvoiceSearch(snapshot, entities);

    case "bill_search":
      return buildBillSearch(snapshot, entities);

    case "receipt_search":
      return buildRecentReceipts(snapshot, entities);

    case "vendor_payment_search":
      return buildRecentVendorPayments(snapshot, entities);

    case "masters_summary":
      return buildMasterSummary(snapshot);

    default:
      return buildUnknown();
  }
}