import { formatClinicDate } from "@/lib/clinic-date";
import { formatStatus } from "@/lib/status-labels";
import { bdtCurrency as currency } from "@/lib/format";

// Print-only documents. They are hidden on screen and, while mounted, are the only thing the
// browser prints (see the @media print rules in globals.css).


export type PrintableInvoice = {
  invoiceCode: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  issuedAt: string;
  patient: { name: string; patientCode: string; phone: string };
  items: { id: string; description: string; quantity: number; unitPrice: string; amount: string }[];
  payments: { id: string; amount: string; method: string; status: string; receivedAt: string }[];
};

export type PrintablePrescription = {
  code: string;
  createdAt: string;
  patient: { name: string; patientCode: string };
  diagnosis: string;
  instructions: string | null;
  followUpDate: string | null;
  prescribedBy: string | null;
  medications: { name: string; dosage: string; frequency: string; duration: string; instructions: string | null }[];
};

function SheetHeader({ title, reference }: { title: string; reference: string }) {
  return (
    <header className="print-sheet-header">
      <div>
        <strong>Dr Ovi&apos;s Dental Care &amp; Endodontics</strong>
        <span>{title}</span>
      </div>
      <span>{reference}</span>
    </header>
  );
}

export function InvoicePrintSheet({ invoice }: { invoice: PrintableInvoice }) {
  const posted = invoice.payments.filter((payment) => payment.status === "POSTED");
  const paid = posted.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const due = Math.max(0, Number(invoice.total) - paid);

  return (
    <article className="print-sheet" lang="en">
      <SheetHeader title="Invoice" reference={invoice.invoiceCode} />
      <dl className="print-sheet-meta">
        <div><dt>Patient</dt><dd>{invoice.patient.name}</dd></div>
        <div><dt>Patient ID</dt><dd>{invoice.patient.patientCode}</dd></div>
        <div><dt>Phone</dt><dd>{invoice.patient.phone}</dd></div>
        <div><dt>Issued</dt><dd>{formatClinicDate(invoice.issuedAt)}</dd></div>
        <div><dt>Status</dt><dd>{formatStatus(invoice.status)}</dd></div>
      </dl>
      <table className="print-sheet-table">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>{currency.format(Number(item.unitPrice))}</td>
              <td>{currency.format(Number(item.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="print-sheet-totals">
        <div><dt>Subtotal</dt><dd>{currency.format(Number(invoice.subtotal))}</dd></div>
        <div><dt>Discount</dt><dd>{currency.format(Number(invoice.discount))}</dd></div>
        <div><dt>Tax</dt><dd>{currency.format(Number(invoice.tax))}</dd></div>
        <div><dt>Total</dt><dd>{currency.format(Number(invoice.total))}</dd></div>
        <div><dt>Paid</dt><dd>{currency.format(paid)}</dd></div>
        <div className="print-sheet-total-due"><dt>Balance due</dt><dd>{currency.format(due)}</dd></div>
      </dl>
      {posted.length > 0 && (
        <>
          <h2>Payments received</h2>
          <table className="print-sheet-table">
            <thead><tr><th>Date</th><th>Method</th><th>Amount</th></tr></thead>
            <tbody>
              {posted.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatClinicDate(payment.receivedAt)}</td>
                  <td>{formatStatus(payment.method)}</td>
                  <td>{currency.format(Number(payment.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

export function PrescriptionPrintSheet({ prescription }: { prescription: PrintablePrescription }) {
  return (
    <article className="print-sheet" lang="en">
      <SheetHeader title="Prescription" reference={prescription.code} />
      <dl className="print-sheet-meta">
        <div><dt>Patient</dt><dd>{prescription.patient.name}</dd></div>
        <div><dt>Patient ID</dt><dd>{prescription.patient.patientCode}</dd></div>
        <div><dt>Date</dt><dd>{formatClinicDate(prescription.createdAt)}</dd></div>
        <div><dt>Prescribed by</dt><dd>{prescription.prescribedBy ?? "Clinic doctor"}</dd></div>
      </dl>
      <h2>Diagnosis</h2>
      <p>{prescription.diagnosis || "—"}</p>
      <h2>Medications</h2>
      <table className="print-sheet-table">
        <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Notes</th></tr></thead>
        <tbody>
          {prescription.medications.map((medication, index) => (
            <tr key={index}>
              <td>{medication.name}</td>
              <td>{medication.dosage}</td>
              <td>{medication.frequency}</td>
              <td>{medication.duration}</td>
              <td>{medication.instructions}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {prescription.instructions && (
        <>
          <h2>Instructions</h2>
          <p>{prescription.instructions}</p>
        </>
      )}
      {prescription.followUpDate && (
        <p><strong>Follow-up:</strong> {formatClinicDate(prescription.followUpDate)}</p>
      )}
    </article>
  );
}
