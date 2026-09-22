/**
 * What a product manager actually asks of each piece of feedback, as
 * meanings. Each is one Noul; all of them ride in one request per message.
 */
import { chooseFrom, means, scale } from "jevlish";
import type { Feedback } from "./feedback.js";
import { AREAS, FEATURES } from "./product.js";

export const describesProblem = means<Feedback>("the message reports something in the product that is broken, wrong, slow, or failing")
  .including("bugs, errors, wrong numbers, lost or missing data, unexpected behaviour, unexplained delays")
  .excluding("asking for a new capability, complaining about price, or expressing an opinion without a concrete failure")
  .named("problem");

export const requestsChange = means<Feedback>("the user asks for a capability or change the product does not give them today")
  .including("wishes, feature requests, 'is there a way to', 'please add'")
  .excluding("reporting that an existing feature is broken")
  .named("request");

export const describesWorkaround = means<Feedback>(
  "the user describes something they do outside the product, or a manual routine, to make up for something the product does not do",
)
  .including("scripts, spreadsheets, third-party automations, or repeated manual steps they perform to compensate")
  .excluding("simply asking for a feature, or describing how they use the product as intended")
  .named("workaround");

export const confused = means<Feedback>("the user is confused about how the product works or where to find something")
  .including("thinking data is lost when it is delayed, not knowing whether something is saved, asking where a setting is, misreading what a screen shows")
  .excluding("clear bug reports, and feature requests where the user understands what exists")
  .named("confused");

export const churnRisk = means<Feedback>("the user indicates they may stop paying for, or switch away from, the product")
  .including("evaluating or moving to a named alternative, cancelling, not renewing, downgrading, or making continued use conditional")
  .excluding("complaints and comparisons with no sign of leaving")
  .named("churnRisk");

export const praise = means<Feedback>("the user expresses satisfaction with the product or the company")
  .including("compliments, high scores with positive comments, recommending it")
  .excluding("neutral remarks, or positives that are only a preamble to a complaint")
  .named("praise");

export const reproducible = means<Feedback>(
  "the message includes concrete reproduction details: steps to follow, an identifier, a browser or device version, or exact values",
)
  .including("numbered or sequential steps, invoice numbers, 'Safari 17.2', 'expected X got Y'")
  .excluding("reports with no specifics, like 'doesn't work' or 'sometimes it's slow'")
  .named("reproducible");

export const severity = scale<Feedback>("how much the reported issue affects the user's ability to get value from the product")
  .from("A minor annoyance; everything still works")
  .through("Slows them down or forces a workaround")
  .to("Prevents them from completing something important, or damages trust")
  .named("severity");

export const area = chooseFrom(AREAS)
  .describedBy((a) => a.description)
  .by("which part of the product the message is mainly about")
  .orNone("not about any specific part of the product");

export const existingFeature = chooseFrom(FEATURES)
  .describedBy((feature) => feature.description)
  .by("which of these existing features does what the user is asking for")
  .orNone("none of these features does what the user is asking for");
