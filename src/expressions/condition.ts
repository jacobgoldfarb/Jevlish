import type { EntryType } from "@typesafe-ai/sdk";
import { SenseError } from "../errors.js";

/**
 * A condition is an expression tree, not a sentence. Semantic leaves become
 * Noul questions; code leaves run locally; and/or/not combine the results with
 * three-valued logic. Composition never concatenates prose.
 */
export interface SemanticCondition {
  readonly type: "semantic";
  readonly proposition: string;
  readonly including?: EntryType;
  readonly excluding?: EntryType;
  readonly name?: string;
}

/** A leaf that runs locally. Never sent; folded before any request is built. */
export interface CodeCondition<T> {
  readonly type: "code";
  readonly predicate: (subject: T) => boolean;
  readonly name?: string;
}

export interface AndCondition<T> {
  readonly type: "and";
  readonly left: Condition<T>;
  readonly right: Condition<T>;
}

export interface OrCondition<T> {
  readonly type: "or";
  readonly left: Condition<T>;
  readonly right: Condition<T>;
}

export interface NotCondition<T> {
  readonly type: "not";
  readonly inner: Condition<T>;
}

/** The expression tree behind every predicate. */
export type Condition<T> =
  | SemanticCondition
  | CodeCondition<T>
  | AndCondition<T>
  | OrCondition<T>
  | NotCondition<T>;

/**
 * Every condition position accepts the same three things:
 * a natural-language proposition, an exact predicate, or a reusable meaning.
 */
export type ConditionLike<T> = string | ((subject: T) => boolean) | Meaning<T>;

export function conjoin<T>(left: Condition<T>, right: ConditionLike<T>): Condition<T> {
  return { type: "and", left, right: toCondition(right) };
}

export function disjoin<T>(left: Condition<T>, right: ConditionLike<T>): Condition<T> {
  return { type: "or", left, right: toCondition(right) };
}

export function without<T>(base: Condition<T>, exception: ConditionLike<T>): Condition<T> {
  return { type: "and", left: base, right: { type: "not", inner: toCondition(exception) } };
}

export function toCondition<T>(input: ConditionLike<T>): Condition<T> {
  if (typeof input === "string") {
    const proposition = input.trim();
    if (!proposition) throw new SenseError("A semantic condition needs a non-empty proposition.");
    return { type: "semantic", proposition };
  }
  if (typeof input === "function") return { type: "code", predicate: input };
  if (input instanceof Meaning) return input.node;
  throw new SenseError("A condition must be a string, a predicate function, or a Meaning.");
}

/** Human-readable rendering of the expression tree, for inspection and errors. */
export function describeCondition<T>(node: Condition<T>): string {
  switch (node.type) {
    case "semantic":
      return node.name ? `${node.name}: "${node.proposition}"` : `"${node.proposition}"`;
    case "code":
      return node.name ?? (node.predicate.name ? `${node.predicate.name}()` : "code predicate");
    case "and":
      return `(${describeCondition(node.left)} and ${describeCondition(node.right)})`;
    case "or":
      return `(${describeCondition(node.left)} or ${describeCondition(node.right)})`;
    case "not":
      return `not ${describeCondition(node.inner)}`;
  }
}

/**
 * A named, composable, inspectable semantic predicate. `blocked.and(x)` keeps
 * two expression nodes; it does not rewrite the proposition.
 */
export class Meaning<T = unknown> {
  constructor(
    readonly node: Condition<T>,
    readonly name?: string,
  ) {}

  /**
   * Draw the boundary from the inside: what the proposition covers.
   * Only valid on a single proposition. Becomes Noul `criteria.true`.
   */
  including(description: EntryType): Meaning<T> {
    return new Meaning({ ...this.semanticNode("including"), including: description }, this.name);
  }

  /**
   * Draw the boundary from the outside: what the proposition does not cover,
   * even if it looks close. Only valid on a single proposition. Becomes Noul `criteria.false`.
   */
  excluding(description: EntryType): Meaning<T> {
    return new Meaning({ ...this.semanticNode("excluding"), excluding: description }, this.name);
  }

  /** Give the meaning a name for traces, fixtures, and error messages. */
  named(name: string): Meaning<T> {
    const node = this.node.type === "semantic" || this.node.type === "code" ? { ...this.node, name } : this.node;
    return new Meaning(node, name);
  }

  /** Both must hold. */
  and(other: ConditionLike<T>): Meaning<T> {
    return new Meaning(conjoin(this.node, other));
  }

  /** Either may hold. */
  or(other: ConditionLike<T>): Meaning<T> {
    return new Meaning(disjoin(this.node, other));
  }

  /** Holds only if the exception does not: `a.unless(b)` is `a and not b`. */
  unless(other: ConditionLike<T>): Meaning<T> {
    return new Meaning(without(this.node, other));
  }

  /** The negation. Uncertain stays uncertain. */
  not(): Meaning<T> {
    return new Meaning({ type: "not", inner: this.node });
  }

  /** Human-readable rendering of the expression tree. */
  describe(): string {
    return describeCondition(this.node);
  }

  /** Serializable form: the name and the expression tree, with code predicates reduced to their names. */
  toJSON(): unknown {
    return { name: this.name, expression: serialize(this.node) };
  }

  private semanticNode(method: string): SemanticCondition {
    if (this.node.type !== "semantic") {
      throw new SenseError(
        `.${method}() applies to a single proposition; ${this.describe()} is a composite. ` +
          "Draw the boundary on each means() before composing.",
      );
    }
    return this.node;
  }
}

function serialize<T>(node: Condition<T>): unknown {
  switch (node.type) {
    case "semantic":
      return { proposition: node.proposition, including: node.including, excluding: node.excluding, name: node.name };
    case "code":
      return { code: node.name ?? node.predicate.name ?? "predicate" };
    case "and":
      return { and: [serialize(node.left), serialize(node.right)] };
    case "or":
      return { or: [serialize(node.left), serialize(node.right)] };
    case "not":
      return { not: serialize(node.inner) };
  }
}

/** Define a reusable meaning: a proposition the model judges about a subject. */
export function means<T = unknown>(proposition: string): Meaning<T> {
  return new Meaning(toCondition<T>(proposition));
}

/** Negate any condition. */
export function not<T = unknown>(condition: ConditionLike<T>): Meaning<T> {
  return new Meaning({ type: "not", inner: toCondition(condition) });
}

/** Combine several conditions; all must hold. */
export function all<T = unknown>(first: ConditionLike<T>, ...rest: ConditionLike<T>[]): Meaning<T> {
  return rest.reduce<Meaning<T>>((acc, next) => acc.and(next), new Meaning(toCondition(first)));
}

/** Combine several conditions; any may hold. */
export function any<T = unknown>(first: ConditionLike<T>, ...rest: ConditionLike<T>[]): Meaning<T> {
  return rest.reduce<Meaning<T>>((acc, next) => acc.or(next), new Meaning(toCondition(first)));
}
