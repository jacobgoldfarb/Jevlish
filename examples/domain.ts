import { means, scale } from "../src/index.js";

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

// A domain vocabulary. These are meanings, not prompts: named, composable,
// inspectable, and measured against fixtures like any other function.

export const blocked = means<Ticket>("the customer is currently unable to complete their task")
  .including("a product failure prevents them from completing the task")
  .excluding("they can complete the task despite inconvenience, or they are only asking a question")
  .named("blocked");

export const saysResolved = means<Ticket>("the customer says the problem has been resolved").named("saysResolved");

export const needsAttention = blocked.and((ticket) => ticket.status === "open").unless(saysResolved);

export const reportsProblem = means<Ticket>("the message reports a problem with the product")
  .including("something in the product is broken, failing, or behaving wrongly")
  .excluding("a how-to question, a feature request, or praise")
  .named("reportsProblem");

export const disruption = scale<Ticket>("how much the reported problem disrupts the customer's work")
  .from("Work continues normally; the problem affects appearance only")
  .through("The task remains possible through a workaround")
  .to("The task cannot be completed")
  .named("disruption");

export const tickets: Ticket[] = [
  {
    id: "T-1",
    status: "open",
    subject: "Export broken",
    body: "Every PDF export fails with a spinner that never finishes. We cannot send invoices to clients this week.",
  },
  {
    id: "T-2",
    status: "open",
    subject: "Logo blurry",
    body: "The logo in the top-left corner looks slightly blurry on my retina display. Everything works fine otherwise.",
  },
  {
    id: "T-3",
    status: "open",
    subject: "Search slow",
    body: "Search takes 10+ seconds. I can still find things by browsing folders, but it's painful.",
  },
  {
    id: "T-4",
    status: "open",
    subject: "Password",
    body: "Hi! How do I change the password on my account? Thanks.",
  },
  {
    id: "T-5",
    status: "closed",
    subject: "Login down",
    body: "Nobody on our team can log in since this morning; every attempt returns a 500 error.",
  },
  {
    id: "T-6",
    status: "open",
    subject: "Re: sync issue",
    body: "Following up on the sync failure I reported yesterday. Your fix worked, syncing is back to normal now. Thanks!",
  },
];

export const engineers: Engineer[] = [
  { name: "Ada", expertise: ["billing", "payments", "Stripe"], recentWork: "Migrated invoicing to the new billing API." },
  { name: "Grace", expertise: ["exports", "PDF rendering", "background jobs"], recentWork: "Rewrote the PDF export worker queue." },
  { name: "Linus", expertise: ["auth", "SSO", "sessions"], recentWork: "Shipped SAML single sign-on." },
];
