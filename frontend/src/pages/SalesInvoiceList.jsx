import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "../api/client";

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function SalesInvoiceList() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  async function load() {
    try {
      const data = await apiGet("/sales-invoices/");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelInvoice(invoice_no) {
    if (!confirm(`Cancel invoice ${invoice_no}?`)) return;

    try {
      await apiPatch(`/sales-invoices/${invoice_no}/cancel`);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 14 }}>
      <h2 style={{ color: "#fff" }}>Sales Invoices</h2>

      {err && <div style={{ color: "red" }}>{err}</div>}

      <div style={{ overflowX: "auto" }}>
        <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#f6f7f9" }}>
              <th align="left">Invoice No</th>
              <th align="left">Date</th>
              <th align="left">Customer</th>
              <th align="right">Total</th>
              <th align="right">Balance</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice_no} style={{ borderTop: "1px solid #eee" }}>
                <td>{r.invoice_no}</td>
                <td>{r.invoice_date}</td>
                <td>{r.customer_code}</td>
                <td align="right">{money(r.grand_total)}</td>
                <td align="right">{money(r.balance)}</td>
                <td>{r.status}</td>

                <td>
                  <button onClick={() => nav(`/sales-invoice-view/${r.invoice_no}`)}>View</button>
                  <button onClick={() => nav(`/billing/edit/${r.invoice_no}`)}>Edit</button>
                  <button onClick={() => cancelInvoice(r.invoice_no)}>Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}