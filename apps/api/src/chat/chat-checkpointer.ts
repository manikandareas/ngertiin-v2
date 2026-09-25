import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { chat_runs } from "@ngertiin/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { InfrastructureService } from "../infrastructure/infrastructure.service.js";
import { LearningRunError } from "./chat.errors.js";

export function createChatCheckpointer(
  db: InfrastructureService["database"]["db"],
  databaseUrl: string,
): PostgresSaver {
  const checkpointer = PostgresSaver.fromConnString(databaseUrl, {
    schema: "chat_checkpoint",
  });
  const put = checkpointer.put.bind(checkpointer);
  const putWrites = checkpointer.putWrites.bind(checkpointer);
  const fencedWrite = async <T>(
    config: Parameters<typeof put>[0],
    write: () => Promise<T>,
  ): Promise<T> => {
    const runId = config.configurable?.thread_id;
    const executorId = config.configurable?.executor_id;
    const leaseEpoch = config.configurable?.lease_epoch;
    if (
      typeof runId !== "string" ||
      typeof executorId !== "string" ||
      typeof leaseEpoch !== "number"
    )
      throw new LearningRunError("PROCESS_INTERRUPTED");
    return db.transaction(async (tx) => {
      const [lease] = await tx
        .select({ id: chat_runs.id })
        .from(chat_runs)
        .where(
          and(
            eq(chat_runs.id, runId),
            eq(chat_runs.executor_id, executorId),
            eq(chat_runs.lease_epoch, leaseEpoch),
            inArray(chat_runs.status, ["running", "cancelling"]),
            sql`${chat_runs.lease_expires_at} > clock_timestamp()`,
          ),
        )
        .for("update");
      if (!lease) throw new LearningRunError("PROCESS_INTERRUPTED");
      return write();
    });
  };
  checkpointer.put = (...args) => fencedWrite(args[0], () => put(...args));
  checkpointer.putWrites = (...args) => fencedWrite(args[0], () => putWrites(...args));
  return checkpointer;
}
