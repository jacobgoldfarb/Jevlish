/**
 * What the product team already knows: the parts of the product, and the
 * features that exist. The model selects among these; it never invents them.
 */

export interface Area {
  name: string;
  description: string;
}

export const AREAS: Area[] = [
  { name: "Invoicing", description: "creating, editing, sending invoices; templates, numbering, taxes, discounts" },
  { name: "Payments", description: "clients paying invoices; card processing, payouts, fees, payment status" },
  { name: "Reports & Export", description: "revenue reports, PDFs, CSV export, getting data out of the product" },
  { name: "Integrations", description: "QuickBooks, Xero, Zapier, API, connecting to other tools" },
  { name: "Mobile app", description: "the iOS and Android apps; sync between phone and web" },
  { name: "Onboarding & setup", description: "signing up, importing clients, finding settings, learning the product" },
  { name: "Pricing & plans", description: "cost, plan limits, what is free versus paid" },
  { name: "Team & permissions", description: "multiple users, roles, access control, single sign-on" },
];

export interface Feature {
  name: string;
  description: string;
}

/** Features that ship today. A request for one of these is a discoverability problem, not a roadmap item. */
export const FEATURES: Feature[] = [
  { name: "Recurring invoices", description: "schedule an invoice to be created and sent automatically on a cadence" },
  { name: "Late-payment reminders", description: "automatic reminder emails to clients when an invoice is overdue" },
  { name: "Client portal", description: "a link where clients view and pay their invoices without PDFs being emailed" },
  { name: "Multi-currency", description: "invoice in any currency with automatic exchange rates" },
  { name: "CSV export", description: "download invoices, payments, and clients as CSV, on demand" },
  { name: "Expense tracking", description: "log expenses and attach receipts" },
  { name: "QuickBooks sync", description: "two-way sync of invoices and payments with QuickBooks Online" },
  { name: "Invoice templates", description: "custom branded layouts for invoices" },
  { name: "Dark mode (mobile)", description: "a dark colour scheme in the mobile apps" },
];
