import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "./db";
import { logger } from "./logger";

export interface AuditActor {
  id: string;
  email: string;
}

export interface AuditInput {
  actor?: AuditActor | null;
  action: string;
  entityType?: string;
  entityId?: string;
  requestId?: string;
  /** Safe metadata only: never secrets, passwords or enquiry free text. */
  metadata?: Prisma.InputJsonValue;
}

/** Append-only audit trail (NFR-26). Pass a transaction client to make the event atomic with the change. */
export async function recordAudit(input: AuditInput, db: Db = prisma) {
  try {
    await db.auditEvent.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.requestId,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    // Inside a transaction the error must propagate so the change rolls back.
    if (db !== prisma) throw error;
    logger.error("audit.write_failed", { action: input.action, error });
  }
}
