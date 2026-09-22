import type { EntryType, ScoreCriteria, ScoreQuestion } from "@typesafe-ai/sdk";
import { score } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";

const MAX_LEVELS = 10;

/**
 * A degree, not a probability. A scale describes ordered situations and the
 * model returns a position along them. Kept distinct from predicates on purpose:
 * "how much does this disrupt work" is not "is this disruptive".
 */
export class Scale<T = unknown> {
  // Phantom type so a Scale<Ticket> is not silently used with Engineers.
  declare private readonly __subject?: T;

  constructor(
    readonly question: string,
    readonly levels: readonly EntryType[],
    readonly name?: string,
  ) {
    if (levels.length < 2) throw new SenseError("A scale needs at least two levels.");
    if (levels.length > MAX_LEVELS) {
      throw new SenseError(`A scale supports at most ${MAX_LEVELS} levels (got ${levels.length}).`);
    }
  }

  /** Highest level index; scores run from 0 to this. */
  get top(): number {
    return this.levels.length - 1;
  }

  named(name: string): Scale<T> {
    return new Scale(this.question, this.levels, name);
  }

  toQuestion(): ScoreQuestion {
    return score(this.question, this.levels as unknown as ScoreCriteria);
  }

  toJSON(): unknown {
    return { name: this.name, question: this.question, levels: this.levels };
  }
}

class ScaleLevels<T> {
  constructor(
    private readonly question: string,
    private readonly levels: readonly EntryType[],
  ) {}

  /** Add an intermediate level. Repeatable. */
  through(description: EntryType): ScaleLevels<T> {
    return new ScaleLevels(this.question, [...this.levels, description]);
  }

  /** Add the highest level and finish the scale. */
  to(description: EntryType): Scale<T> {
    return new Scale(this.question, [...this.levels, description]);
  }
}

/** Define a scale: `scale("how severe...").from(low).through(mid).to(high)`. */
export function scale<T = unknown>(question: string): { from(description: EntryType): ScaleLevels<T> } {
  const trimmed = question.trim();
  if (!trimmed) throw new SenseError("A scale needs a non-empty question.");
  return {
    from: (description) => new ScaleLevels<T>(trimmed, [description]),
  };
}
