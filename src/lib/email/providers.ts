import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly permanent: boolean,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  async send(m: EmailMessage) {
    // Development only (rejected in production by env validation).
    console.log(
      `\n--- email (console provider) ---\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n--- end email ---\n`,
    );
    return { messageId: `console-${Date.now()}` };
  }
}

class DisabledProvider implements EmailProvider {
  readonly name = "disabled";
  async send(): Promise<{ messageId: string }> {
    throw new EmailDeliveryError("Email delivery is disabled (EMAIL_PROVIDER=disabled).", true);
  }
}

class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter;
  constructor() {
    const e = env();
    this.transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      requireTLS: !e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  async send(m: EmailMessage) {
    try {
      const info = await this.transporter.sendMail({
        from: env().EMAIL_FROM,
        to: m.to,
        subject: m.subject,
        text: m.text,
        html: m.html,
      });
      return { messageId: String(info.messageId) };
    } catch (error) {
      const err = error as { responseCode?: number; code?: string; message?: string };
      // 5xx SMTP replies (e.g. unknown recipient) will not succeed on retry.
      const permanent =
        typeof err.responseCode === "number" &&
        err.responseCode >= 500 &&
        err.responseCode < 600 &&
        err.responseCode !== 554;
      throw new EmailDeliveryError(
        `SMTP ${err.responseCode ?? err.code ?? "error"}: ${(err.message ?? "").slice(0, 200)}`,
        permanent,
      );
    }
  }
}

let provider: EmailProvider | null = null;
let override: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (override) return override;
  if (provider) return provider;
  const name = env().EMAIL_PROVIDER;
  provider =
    name === "smtp"
      ? new SmtpProvider()
      : name === "disabled"
        ? new DisabledProvider()
        : new ConsoleProvider();
  return provider;
}

/** Test hook for failure injection (NFR-15). */
export function setEmailProviderOverride(p: EmailProvider | null) {
  override = p;
}
