import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseTransaction } from "@ngertiin/database";
import { idempotency_records } from "@ngertiin/database";
import { and, eq, lte } from "drizzle-orm";
import { ProductError } from "../http/product-error.js";
import { InfrastructureService } from "../infrastructure/infrastructure.service.js";

const RETENTION_MILLISECONDS = 24 * 60 * 60 * 1000;

type IdempotencyScope = {
  userId: string;
  method: string;
  route: string;
  key: string;
  payloadHash: string;
  payloadConflictError?: ProductError;
  replayStatus?: number;
  retentionMilliseconds?: number;
};

export type IdempotentResponse<Value> = {
  status: number;
  body: Value;
};

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  async execute<Value>(
    scope: IdempotencyScope,
    command: (transaction: DatabaseTransaction) => Promise<IdempotentResponse<Value>>,
  ): Promise<IdempotentResponse<Value>> {
    return this.infrastructure.database.db.transaction(async (transaction) => {
      const now = new Date();
      const recordScope = and(
        eq(idempotency_records.user_id, scope.userId),
        eq(idempotency_records.method, scope.method),
        eq(idempotency_records.route, scope.route),
        eq(idempotency_records.key, scope.key),
      );

      await transaction.delete(idempotency_records).where(lte(idempotency_records.expires_at, now));

      const [claim] = await transaction
        .insert(idempotency_records)
        .values({
          user_id: scope.userId,
          method: scope.method,
          route: scope.route,
          key: scope.key,
          payload_hash: scope.payloadHash,
          expires_at: new Date(
            now.getTime() + (scope.retentionMilliseconds ?? RETENTION_MILLISECONDS),
          ),
        })
        .onConflictDoNothing({
          target: [
            idempotency_records.user_id,
            idempotency_records.method,
            idempotency_records.route,
            idempotency_records.key,
          ],
        })
        .returning({ id: idempotency_records.id });

      if (claim) {
        const response = await command(transaction);
        await transaction
          .update(idempotency_records)
          .set({
            response_status: response.status,
            response_body: response.body,
          })
          .where(eq(idempotency_records.id, claim.id));
        return response;
      }

      const [existing] = await transaction
        .select({
          payloadHash: idempotency_records.payload_hash,
          responseStatus: idempotency_records.response_status,
          responseBody: idempotency_records.response_body,
        })
        .from(idempotency_records)
        .where(recordScope)
        .limit(1);

      if (!existing) {
        throw new Error("Idempotency record disappeared after a unique-key conflict");
      }
      if (existing.payloadHash !== scope.payloadHash) {
        throw (
          scope.payloadConflictError ??
          new ProductError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency conflict",
            "This Idempotency-Key was already used with a different request payload.",
          )
        );
      }
      if (existing.responseStatus === null || existing.responseBody === null) {
        throw new Error("Completed idempotency record has no stored response");
      }

      return {
        status: scope.replayStatus ?? existing.responseStatus,
        body: existing.responseBody as Value,
      };
    });
  }
}
