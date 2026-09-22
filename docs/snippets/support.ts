// Shared domain for the samples. The site imports these files as text, so
// each sample shows exactly the code that typechecks against the library.
export interface Ticket {
  id: string;
  status: "open" | "closed";
  subject: string;
  body: string;
}

export interface Engineer {
  name: string;
  expertise: string[];
  recentWork: string;
}

export const ticket: Ticket = {
  id: "T-1",
  status: "open",
  subject: "Export broken",
  body: "Every PDF export fails with a spinner that never finishes. We cannot send invoices to clients this week.",
};

export const tickets: Ticket[] = [
  ticket,
  {
    id: "T-2",
    status: "open",
    subject: "Logo blurry",
    body: "The logo looks slightly blurry on my retina display. Everything works fine otherwise.",
  },
  {
    id: "T-3",
    status: "closed",
    subject: "Login down",
    body: "Nobody on our team can log in since this morning; every attempt returns a 500 error.",
  },
];

export const engineers: Engineer[] = [
  { name: "Ada", expertise: ["billing", "payments"], recentWork: "Migrated invoicing to the new billing API." },
  { name: "Grace", expertise: ["exports", "PDF rendering"], recentWork: "Rewrote the PDF export worker queue." },
  { name: "Linus", expertise: ["auth", "SSO", "sessions"], recentWork: "Shipped SAML single sign-on." },
];

export const escalate = (t: Ticket) => `escalated ${t.id}`;
export const leave = (t: Ticket) => `left ${t.id}`;
export const review = (t: Ticket) => `queued ${t.id} for review`;
