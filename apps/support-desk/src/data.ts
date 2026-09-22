export interface Ticket {
  id: string;
  status: "open" | "closed";
  customer: string;
  plan: "free" | "team" | "enterprise";
  subject: string;
  body: string;
}

export interface Incident {
  id: string;
  title: string;
  summary: string;
}

export interface Engineer {
  name: string;
  expertise: string[];
  recentWork: string;
  onCall: boolean;
}

export const tickets: Ticket[] = [
  {
    id: "T-101",
    status: "open",
    customer: "Northwind Traders",
    plan: "enterprise",
    subject: "Export broken",
    body: "Every PDF export fails with a spinner that never finishes. We cannot send invoices to clients this week.",
  },
  {
    id: "T-102",
    status: "open",
    customer: "Alice Chen",
    plan: "free",
    subject: "Logo blurry",
    body: "The logo in the top-left corner looks slightly blurry on my retina display. Everything works fine otherwise.",
  },
  {
    id: "T-103",
    status: "open",
    customer: "Bramble & Co",
    plan: "team",
    subject: "Search slow",
    body: "Search takes 10+ seconds. I can still find things by browsing folders, but it's painful.",
  },
  {
    id: "T-104",
    status: "open",
    customer: "Dev Patel",
    plan: "free",
    subject: "Password",
    body: "Hi! How do I change the password on my account? Thanks.",
  },
  {
    id: "T-105",
    status: "closed",
    customer: "Globex",
    plan: "enterprise",
    subject: "Login down",
    body: "Nobody on our team can log in since this morning; every attempt returns a 500 error.",
  },
  {
    id: "T-106",
    status: "open",
    customer: "Sunrise Bakery",
    plan: "team",
    subject: "Re: sync issue",
    body: "Following up on the sync failure I reported yesterday. Your fix worked, syncing is back to normal now. Thanks!",
  },
  {
    id: "T-107",
    status: "open",
    customer: "Initech",
    plan: "enterprise",
    subject: "Intermittent login failures",
    body: "About one in three login attempts fails with a server error today. People get in eventually but it's disruptive.",
  },
  {
    id: "T-108",
    status: "open",
    customer: "Marta Ruiz",
    plan: "team",
    subject: "Considering alternatives",
    body: "The dashboard loads fine, but honestly we've been evaluating a competitor and unless pricing changes we'll move next month.",
  },
];

export const incidents: Incident[] = [
  {
    id: "INC-42",
    title: "PDF export worker outage",
    summary: "Background export jobs hang indefinitely since 09:00 UTC; PDF downloads never complete.",
  },
  {
    id: "INC-43",
    title: "Auth service degraded",
    summary: "A subset of login requests return HTTP 500 due to a failing session-store replica.",
  },
  {
    id: "INC-44",
    title: "Search index rebuild",
    summary: "Search latency is elevated while the index rebuilds; results are correct but slow.",
  },
];

export const engineers: Engineer[] = [
  {
    name: "Ada",
    expertise: ["billing", "payments", "Stripe"],
    recentWork: "Migrated invoicing to the new billing API.",
    onCall: true,
  },
  {
    name: "Grace",
    expertise: ["exports", "PDF rendering", "background jobs"],
    recentWork: "Rewrote the PDF export worker queue.",
    onCall: true,
  },
  {
    name: "Linus",
    expertise: ["auth", "SSO", "sessions"],
    recentWork: "Shipped SAML single sign-on.",
    onCall: false,
  },
  {
    name: "Maya",
    expertise: ["search", "indexing", "performance"],
    recentWork: "Cut p95 search latency in half.",
    onCall: true,
  },
];
