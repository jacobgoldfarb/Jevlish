import { configure } from "jevlish";

configure({
  model: "jev-1.13", // default: jev-latest
  policy: { noul: { yesAbove: 0.9, noBelow: 0.1 } },
});
