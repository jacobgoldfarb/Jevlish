import { chooseFrom, given, means, scale } from "jevlish";

interface Feedback {
  text: string;
  plan: "free" | "pro" | "team";
}

const AREAS = ["invoicing", "reports", "exports", "permissions"] as const;

const severity = scale<Feedback>("how badly the problem affects the user")
  .from("An annoyance; work continues")
  .through("Work continues through a workaround")
  .to("The user cannot do their job");

const profile = (item: Feedback) =>
  given(item)
    .seenAs((f) => ({ message: f.text }))
    .ask({
      problem: means<Feedback>("the message describes something not working"), // Noul
      request: "the user asks for a change or a new capability", // Noul, from a string
      severity, // Score over three described levels
      area: chooseFrom(AREAS).by("which part of the product the message is mainly about").orNone("no single area"), // Choice
      paying: (f) => f.plan !== "free", // code; adds nothing to the request
    });

const answers = await profile({ text: "Exports hang every Friday. We copy the data by hand.", plan: "team" });

answers.problem; // Judgment<boolean>
answers.severity; // Judgment<Measurement>
answers.area; // Judgment<"invoicing" | "reports" | "exports" | "permissions" | null>
answers.paying; // Judgment<boolean>, decided by code
answers.problem.evidence === answers.area.evidence; // every answer shares one request
