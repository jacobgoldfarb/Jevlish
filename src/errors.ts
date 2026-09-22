/**
 * Errors raised by the library itself: malformed expressions, exceeded budgets,
 * missing handlers. Transport failures from the underlying SDK propagate as-is;
 * a timeout is never evidence about a proposition.
 */
export class SenseError extends Error {
  /** `options.cause` carries the underlying error when one exists. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SenseError";
  }
}
