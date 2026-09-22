/**
 * A quarter of feedback for Ledgerly, an invoicing product for freelancers and
 * small teams. Five sources, three plans, the usual mess: praise, bugs,
 * requests for things that already exist, workarounds people built, people
 * on their way out, and messages that say nothing at all.
 */

export type Source = "app_store" | "nps" | "support" | "cancellation" | "twitter";
export type Plan = "free" | "pro" | "team";

export interface Feedback {
  id: number;
  source: Source;
  plan: Plan;
  tenureMonths: number;
  text: string;
}

let n = 0;
const f = (source: Source, plan: Plan, tenureMonths: number, text: string): Feedback => ({
  id: ++n,
  source,
  plan,
  tenureMonths,
  text,
});

export const feedback: Feedback[] = [
  // Reports & Export: people building their own scheduled exports
  f("support", "pro", 14, "I set up a Zapier zap that pulls the CSV export every Monday and emails it to my accountant, because there's no way to schedule an export from inside Ledgerly."),
  f("nps", "team", 22, "8/10. Only gripe: I wrote a cron job against your API to dump monthly reports to S3. Would rather not maintain that."),
  f("support", "pro", 7, "Every Friday I export manually and paste into a Google Sheet for my business partner. Could this just happen automatically?"),
  f("twitter", "pro", 30, "made a macOS Shortcut that opens @ledgerly, clicks export, renames the file by month. this is what my life is now"),
  f("support", "pro", 9, "PDF export produces a blank first page in Safari 17.2 when the invoice has a logo uploaded. Works fine in Chrome. Invoice #2231 reproduces it every time."),
  f("nps", "free", 2, "Reports are decent for a free tool."),

  // Asking for things that already exist
  f("nps", "pro", 4, "7. Wish I could set an invoice to go out automatically on the 1st of every month instead of recreating it."),
  f("support", "free", 1, "Is there any way to nudge clients when an invoice is late? I'm chasing people by hand."),
  f("app_store", "pro", 6, "Great app but I bill clients in EUR and GBP and have to convert manually. Please add other currencies."),
  f("support", "team", 3, "Our clients keep losing the PDF attachments. Could there be some kind of page where they just see their invoices?"),
  f("twitter", "free", 1, "@ledgerly would kill for a dark mode on the iphone app"),

  // Team & permissions: churn concentrating on one area
  f("cancellation", "team", 18, "Our accountant needs read-only access to reports. Without roles everyone is an admin, which our auditor flagged. We're evaluating Xero."),
  f("support", "team", 11, "IT won't approve renewal without SSO. Is SAML on the roadmap? If not we need to know by March."),
  f("nps", "team", 26, "4. Can't restrict who sees revenue numbers. Junior staff see everything. Actively considering alternatives."),
  f("cancellation", "team", 15, "Moving to FreshBooks next quarter unless permissions get an overhaul. Love the invoicing, but this is a blocker for a team of 12."),
  f("support", "team", 5, "How do I add a teammate who can only create invoices but not delete them?"),

  // Mobile: confusion about sync
  f("app_store", "pro", 8, "The mobile app LOST my invoice. Made it on my phone, opened my laptop, not there. Terrifying. (It showed up 10 minutes later but still.)"),
  f("support", "free", 2, "Drafts I make on mobile disappear. Are they saved anywhere?"),
  f("app_store", "pro", 12, "Totals on the phone don't match the web. I think the app just isn't refreshing? Confusing."),
  f("app_store", "free", 3, "Why does it make me log in again every week on iOS? Every other app remembers me."),
  f("app_store", "pro", 20, "Mobile app is genuinely good. Snappy, and I can send an invoice from a client's driveway."),

  // Payments
  f("support", "pro", 10, "Stripe payout took 9 days this time. Usually 2-3. No notice, no explanation in the dashboard."),
  f("support", "free", 4, "Client says their card was declined but neither of us can see why. Just 'payment failed'."),
  f("support", "pro", 16, "Invoice #1877 shows Unpaid but the client sent me the receipt from your payment page. Now I've sent them a reminder for something they paid. Embarrassing."),
  f("twitter", "pro", 5, "wish @ledgerly showed the processing fee BEFORE the client pays, not on my payout statement"),

  // Invoicing
  f("support", "team", 9, "Bug: tax is computed on the discounted subtotal instead of the original. Steps: new invoice, add line $100, add 10% discount, add 20% VAT. Expected $18 tax, got $18 on some and $20 on others depending on order."),
  f("nps", "pro", 13, "9. Invoice templates are the best I've used. My clients comment on how professional they look."),
  f("app_store", "free", 1, "Invoice numbering restarts when I change the prefix. Lost my sequence."),
  f("nps", "pro", 27, "10. Fast, clean, does exactly one thing well."),

  // Onboarding
  f("support", "team", 0, "Tried to import 400 clients from a CSV. Column mapping step failed with no error message. Gave up and typed 30 in by hand."),
  f("nps", "pro", 1, "6. Took me an hour to find where tax rates live. It's under Settings > Business > Regional, which... why."),
  f("twitter", "free", 0, "signed up for @ledgerly at 9:03, sent first invoice at 9:08. that's how it should be"),

  // Integrations
  f("support", "team", 14, "QuickBooks sync creates duplicate entries every time it runs. I now reconcile by hand every month, which is the thing the sync was supposed to remove."),
  f("nps", "pro", 8, "7. Need Xero. Everyone I work with uses Xero."),
  f("support", "pro", 6, "Zapier trigger 'invoice paid' fires twice for one payment."),

  // Pricing (free plan)
  f("app_store", "free", 3, "3 invoices a month on free is stingy. I'm a part-timer, I send 4."),
  f("cancellation", "free", 2, "Paywall hit me the moment I needed a second template. Not worth $19/mo for what I do."),
  f("nps", "free", 5, "5. Fine, but everything useful is behind the Pro plan."),
  f("twitter", "free", 1, "@ledgerly free tier is basically a demo"),
  f("cancellation", "pro", 24, "Downgrading. Business is slow this year, nothing wrong with the product."),

  // Praise
  f("nps", "pro", 19, "10. Your support answered in 4 minutes on a Sunday. Unreal."),
  f("app_store", "pro", 11, "Five stars. Switched from a spreadsheet and I'm never going back."),
  f("nps", "team", 30, "9. Reliable. Never lost a payment, never had downtime we noticed."),
  f("twitter", "pro", 2, "the little confetti when an invoice gets paid is doing more for my mental health than it should"),

  // Competitor mention without churn
  f("nps", "pro", 12, "8. Cheaper than FreshBooks and easier than QuickBooks. Would like a proper client list search though."),

  // Says nothing
  f("nps", "free", 1, "meh"),
  f("app_store", "free", 0, "doesn't work"),
  f("nps", "pro", 3, "it's fine I guess"),
  f("app_store", "free", 1, "👎"),
  f("nps", "team", 6, "ok"),
];
