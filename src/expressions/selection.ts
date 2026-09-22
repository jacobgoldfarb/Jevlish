import type { ChoiceCriteria, EntryType } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";
import { toState } from "../state.js";

const MAX_CHOICE_OPTIONS = 255;
const NONE_OPTION = "none_of_these";

/** A Jev Choice over application-owned candidates. */
export class Choice<C, None = never> {
  constructor(
    readonly candidates: readonly C[],
    readonly projection: ((candidate: C) => unknown) | undefined,
    readonly criterion: string,
    readonly noneDescription: EntryType | undefined,
  ) {}

  /** Make "none of them" a legitimate, distinct outcome. */
  orNone(description: EntryType): Choice<C, null> {
    return new Choice(this.candidates, this.projection, this.criterion, description);
  }
}

/** `chooseFrom(candidates)` before the criterion is stated. */
export class ChoiceBuilder<C> {
  constructor(
    private readonly candidates: readonly C[],
    private readonly projection: ((candidate: C) => unknown) | undefined,
  ) {}

  /** What the model sees of each candidate. The chosen candidate comes back whole. */
  seenAs(projection: (candidate: C) => unknown): ChoiceBuilder<C> {
    return new ChoiceBuilder(this.candidates, projection);
  }

  /** The Choice criterion, in prose. */
  by(criterion: string): Choice<C, never> {
    const trimmed = criterion.trim();
    if (!trimmed) throw new SenseError("chooseFrom(...).by() needs a non-empty criterion.");
    return new Choice(this.candidates, this.projection, trimmed, undefined);
  }
}

/** Define a Choice to use inside `given(x).ask({...})`, or bind it with `given(x).chooseFrom`. */
export function chooseFrom<C>(candidates: readonly C[]): ChoiceBuilder<C> {
  return new ChoiceBuilder(candidates, undefined);
}

export function toChoiceCriteria<C>(selection: Choice<C, unknown>): {
  criteria: ChoiceCriteria;
  byOption: Map<string, C>;
} {
  if (selection.candidates.length === 0) throw new SenseError("A Choice needs at least one candidate.");
  const limit = selection.noneDescription === undefined ? MAX_CHOICE_OPTIONS : MAX_CHOICE_OPTIONS - 1;
  if (selection.candidates.length > limit) {
    throw new SenseError(
      `A Choice supports at most ${limit} candidates here (got ${selection.candidates.length}). Narrow them in code first.`,
    );
  }
  const byOption = new Map<string, C>();
  const criteria: ChoiceCriteria = {};
  selection.candidates.forEach((candidate, index) => {
    const option = `option_${index + 1}`;
    byOption.set(option, candidate);
    criteria[option] = toState(selection.projection ? selection.projection(candidate) : candidate);
  });
  if (selection.noneDescription !== undefined) criteria[NONE_OPTION] = selection.noneDescription;
  return { criteria, byOption };
}

export function resolveSelection<C, None>(
  selection: Choice<C, None>,
  option: string,
  byOption: Map<string, C>,
): C | None {
  if (option === NONE_OPTION) return null as None;
  const selected = byOption.get(option);
  if (selected === undefined) throw new SenseError(`Model selected unknown option "${option}".`);
  return selected;
}
