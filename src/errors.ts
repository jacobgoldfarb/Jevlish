/**
 * Errors raised by the library itself: malformed expressions, exceeded budgets,
 * missing handlers. Transport failures from the underlying SDK propagate as-is;
 * a timeout is never evidence about a proposition.
 */
export class SenseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SenseError";
  }
}
