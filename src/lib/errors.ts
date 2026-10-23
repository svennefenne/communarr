import { makeT, type T, type Vars } from "./i18n";

/**
 * An error whose message is meant for the person (a rule, not a bug): server actions show it as is.
 * The message is English text (the key, with {placeholders} filled from vars); whoever catches it
 * shows it in the person's language with translated(): new UserError("Too long.").
 */
export class UserError extends Error {
  readonly key: string;
  readonly vars?: Vars;
  constructor(message: string, vars?: Vars) {
    super(makeT("en")(message, vars));
    this.key = message;
    this.vars = vars;
  }

  translated(t: T): string {
    return t(this.key, this.vars);
  }
}
