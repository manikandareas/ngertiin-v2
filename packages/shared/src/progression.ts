import type {
  ModuleProgressStatus,
  NextLearningAction,
  NodeProgress,
} from "@ngertiin/contracts/api";
import {
  adaptive_interventions,
  type DatabaseTransaction,
  module_nodes,
  node_progress,
  user_module_progress,
  user_stats,
  users,
  xp_events,
} from "@ngertiin/database";
import { and, asc, eq, sql } from "drizzle-orm";
import { addLeaderboardXp } from "./leaderboard.js";

type ProgressNode = {
  id: string;
  status: "locked" | "available" | "in_progress" | "completed";
  bestScore: string | null;
  attemptCount: number;
};

export type LearningInterventionState = {
  id: string;
  triggerAttemptId: string;
  status:
    | "offered"
    | "generating"
    | "available"
    | "in_progress"
    | "completed"
    | "failed"
    | "skipped";
  firstNodeId: string | null;
  activeNodeId: string | null;
};

export function selectLearningAction(input: {
  moduleId: string;
  moduleStatus: "generating" | "ready" | "failed" | "archived";
  moduleProgressStatus: ModuleProgressStatus | null;
  currentCoreNodeId: string | null;
  currentCoreNodeStatus?: ProgressNode["status"];
  intervention?: LearningInterventionState | null;
}): NextLearningAction {
  if (input.moduleStatus === "archived") return { type: "none" };
  if (input.moduleStatus === "generating")
    return { type: "wait_for_module", moduleId: input.moduleId };
  if (input.moduleStatus === "failed") return { type: "retry_module", moduleId: input.moduleId };
  const intervention = input.intervention;
  if (intervention?.status === "offered") {
    return {
      type: "offer_optional_review",
      attemptId: intervention.triggerAttemptId,
      interventionId: intervention.id,
    };
  }
  if (intervention?.status === "generating" || intervention?.status === "failed") {
    return { type: "wait_for_adaptive", interventionId: intervention.id };
  }
  if (intervention?.status === "available" && intervention.firstNodeId) {
    return {
      type: "start_adaptive_node",
      moduleId: input.moduleId,
      nodeId: intervention.firstNodeId,
    };
  }
  if (intervention?.status === "in_progress" && intervention.activeNodeId) {
    return {
      type: "resume_adaptive_node",
      moduleId: input.moduleId,
      nodeId: intervention.activeNodeId,
    };
  }
  if (input.moduleProgressStatus === "completed")
    return { type: "module_completed", moduleId: input.moduleId };
  if (!input.currentCoreNodeId) return { type: "none" };
  return {
    type: input.currentCoreNodeStatus === "in_progress" ? "resume_core_node" : "start_core_node",
    moduleId: input.moduleId,
    nodeId: input.currentCoreNodeId,
  };
}

function percentage(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 10_000) / 100;
}

export async function finalizeAdaptiveNodeProgress(
  transaction: DatabaseTransaction,
  input: { userId: string; moduleId: string; nodeId: string; normalizedScore?: number },
): Promise<{
  nodeProgress: NodeProgress;
  moduleProgress: {
    status: ModuleProgressStatus;
    percentage: number;
    completedCoreNodes: number;
    totalCoreNodes: number;
  };
  xpAwarded: number;
  nextAction: NextLearningAction;
}> {
  const [current] = await transaction
    .select({
      progressId: node_progress.id,
      status: node_progress.status,
      bestScore: node_progress.best_score,
      attemptCount: node_progress.attempt_count,
      completedAt: node_progress.completed_at,
      interventionId: module_nodes.adaptive_intervention_id,
      position: module_nodes.adaptive_position,
    })
    .from(node_progress)
    .innerJoin(module_nodes, eq(module_nodes.id, node_progress.node_id))
    .where(
      and(
        eq(node_progress.user_id, input.userId),
        eq(node_progress.node_id, input.nodeId),
        eq(module_nodes.module_id, input.moduleId),
        eq(module_nodes.origin, "adaptive"),
      ),
    )
    .for("update", { of: node_progress })
    .limit(1);
  if (!current?.interventionId || current.position === null)
    throw new Error("Adaptive Node progress is missing.");
  const [intervention] = await transaction
    .select({
      id: adaptive_interventions.id,
      triggerAttemptId: adaptive_interventions.trigger_attempt_id,
      status: adaptive_interventions.status,
    })
    .from(adaptive_interventions)
    .where(
      and(
        eq(adaptive_interventions.id, current.interventionId),
        eq(adaptive_interventions.user_id, input.userId),
      ),
    )
    .for("update")
    .limit(1);
  if (!intervention || !["available", "in_progress", "completed"].includes(intervention.status))
    throw new Error("Adaptive Intervention is not learnable.");

  const now = new Date();
  const wasCompleted = current.status === "completed";
  const bestScore =
    input.normalizedScore === undefined
      ? current.bestScore === null
        ? null
        : Number(current.bestScore)
      : Math.max(current.bestScore === null ? 0 : Number(current.bestScore), input.normalizedScore);
  await transaction
    .update(node_progress)
    .set({
      status: "completed",
      best_score: bestScore === null ? null : String(bestScore),
      started_at: sql`coalesce(${node_progress.started_at}, current_timestamp)`,
      completed_at: current.completedAt ?? now,
      updated_at: now,
    })
    .where(eq(node_progress.id, current.progressId));

  const adaptiveNodes = await transaction
    .select({
      id: module_nodes.id,
      status: node_progress.status,
      bestScore: node_progress.best_score,
      attemptCount: node_progress.attempt_count,
    })
    .from(module_nodes)
    .innerJoin(
      node_progress,
      and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, input.userId)),
    )
    .where(eq(module_nodes.adaptive_intervention_id, intervention.id))
    .orderBy(asc(module_nodes.adaptive_position));
  const currentIndex = adaptiveNodes.findIndex((node) => node.id === input.nodeId);
  const next = adaptiveNodes[currentIndex + 1];
  let xpAwarded = 0;
  if (!wasCompleted && next) {
    await transaction
      .update(node_progress)
      .set({ status: "available", updated_at: now })
      .where(
        and(
          eq(node_progress.user_id, input.userId),
          eq(node_progress.node_id, next.id),
          eq(node_progress.status, "locked"),
        ),
      );
    await transaction
      .update(adaptive_interventions)
      .set({ status: "available" })
      .where(eq(adaptive_interventions.id, intervention.id));
    if (next.status === "locked") next.status = "available";
  } else if (!wasCompleted && !next) {
    await transaction
      .update(adaptive_interventions)
      .set({ status: "completed", completed_at: now })
      .where(eq(adaptive_interventions.id, intervention.id));
    const [stats] = await transaction
      .select({
        totalXp: user_stats.total_xp,
        currentStreak: user_stats.current_streak,
        longestStreak: user_stats.longest_streak,
        lastLearningDate: user_stats.last_learning_date,
        learningDate: sql<string>`(current_timestamp at time zone ${users.timezone})::date`,
      })
      .from(user_stats)
      .innerJoin(users, eq(users.id, user_stats.user_id))
      .where(eq(user_stats.user_id, input.userId))
      .for("update", { of: user_stats })
      .limit(1);
    if (!stats) throw new Error("User is missing learning statistics.");
    const [event] = await transaction
      .insert(xp_events)
      .values({
        user_id: input.userId,
        module_id: input.moduleId,
        amount: 20,
        reason: "adaptive_completed",
        reference_id: intervention.id,
        created_at: now,
      })
      .onConflictDoNothing({
        target: [xp_events.user_id, xp_events.reason, xp_events.reference_id],
      })
      .returning({ id: xp_events.id });
    if (event) {
      await addLeaderboardXp(transaction, input.userId, 20);
      xpAwarded = 20;
      const sameDay = stats.lastLearningDate === stats.learningDate;
      const consecutive =
        stats.lastLearningDate !== null &&
        nextCalendarDate(stats.lastLearningDate) === stats.learningDate;
      const currentStreak = sameDay
        ? stats.currentStreak
        : consecutive
          ? stats.currentStreak + 1
          : 1;
      await transaction
        .update(user_stats)
        .set({
          total_xp: stats.totalXp + 20,
          current_streak: currentStreak,
          longest_streak: Math.max(stats.longestStreak, currentStreak),
          last_learning_date: stats.learningDate,
          updated_at: now,
        })
        .where(eq(user_stats.user_id, input.userId));
    }
  }

  const coreNodes = await transaction
    .select({ id: module_nodes.id, status: node_progress.status })
    .from(module_nodes)
    .innerJoin(
      node_progress,
      and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, input.userId)),
    )
    .where(and(eq(module_nodes.module_id, input.moduleId), eq(module_nodes.origin, "core")))
    .orderBy(asc(module_nodes.core_position));
  const [moduleProgress] = await transaction
    .select({
      status: user_module_progress.status,
      percentage: user_module_progress.progress_percentage,
      currentNodeId: user_module_progress.current_node_id,
    })
    .from(user_module_progress)
    .where(
      and(
        eq(user_module_progress.user_id, input.userId),
        eq(user_module_progress.module_id, input.moduleId),
      ),
    )
    .limit(1);
  if (!moduleProgress) throw new Error("Module progress is missing.");
  const completed = coreNodes.filter((node) => node.status === "completed").length;
  const finalNode = adaptiveNodes.find((node) => node.id === input.nodeId);
  if (!finalNode) throw new Error("Adaptive Node progress is missing.");
  const nextLearningNode = adaptiveNodes.find(
    (node) =>
      node.id !== input.nodeId && (node.status === "available" || node.status === "in_progress"),
  );
  const nextAction = selectLearningAction({
    moduleId: input.moduleId,
    moduleStatus: "ready",
    moduleProgressStatus: moduleProgress.status,
    currentCoreNodeId: moduleProgress.currentNodeId,
    currentCoreNodeStatus: coreNodes.find((node) => node.id === moduleProgress.currentNodeId)
      ?.status,
    intervention: nextLearningNode
      ? {
          id: intervention.id,
          triggerAttemptId: intervention.triggerAttemptId,
          status: nextLearningNode.status === "in_progress" ? "in_progress" : "available",
          firstNodeId: nextLearningNode.id,
          activeNodeId: nextLearningNode.id,
        }
      : null,
  });
  return {
    nodeProgress: mapNode({
      ...finalNode,
      status: "completed",
      bestScore: bestScore === null ? null : String(bestScore),
    }),
    moduleProgress: {
      status: moduleProgress.status,
      percentage: Number(moduleProgress.percentage),
      completedCoreNodes: completed,
      totalCoreNodes: coreNodes.length,
    },
    xpAwarded,
    nextAction,
  };
}

function nextCalendarDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function mapNode(row: ProgressNode): NodeProgress {
  return {
    status: row.status,
    bestScore: row.bestScore === null ? null : Number(row.bestScore),
    attemptCount: row.attemptCount,
  };
}

export async function finalizeCoreNodeProgress(
  transaction: DatabaseTransaction,
  input: {
    userId: string;
    moduleId: string;
    nodeId: string;
    normalizedScore?: number;
    xp: { amount: number; reason: "node_completed" | "quiz_completed" };
  },
): Promise<{
  nodeProgress: NodeProgress;
  moduleProgress: {
    status: ModuleProgressStatus;
    percentage: number;
    completedCoreNodes: number;
    totalCoreNodes: number;
  };
  xpAwarded: number;
  nextAction: NextLearningAction;
}> {
  const [moduleProgress] = await transaction
    .select({ id: user_module_progress.id, completedAt: user_module_progress.completed_at })
    .from(user_module_progress)
    .where(
      and(
        eq(user_module_progress.user_id, input.userId),
        eq(user_module_progress.module_id, input.moduleId),
      ),
    )
    .for("update")
    .limit(1);
  if (!moduleProgress) throw new Error("Ready Module is missing Module progress.");

  const [current] = await transaction
    .select({
      id: node_progress.id,
      status: node_progress.status,
      bestScore: node_progress.best_score,
      position: module_nodes.core_position,
      completedAt: node_progress.completed_at,
    })
    .from(node_progress)
    .innerJoin(module_nodes, eq(module_nodes.id, node_progress.node_id))
    .where(
      and(
        eq(node_progress.user_id, input.userId),
        eq(node_progress.node_id, input.nodeId),
        eq(module_nodes.module_id, input.moduleId),
        eq(module_nodes.origin, "core"),
      ),
    )
    .for("update", { of: node_progress })
    .limit(1);
  if (!current || current.position === null) throw new Error("Core Node progress is missing.");

  const now = new Date();
  const wasCompleted = current.status === "completed";
  const storedBestScore = current.bestScore === null ? null : Number(current.bestScore);
  const nextBestScore =
    input.normalizedScore === undefined
      ? storedBestScore
      : Math.max(storedBestScore ?? 0, input.normalizedScore);

  await transaction
    .update(node_progress)
    .set({
      status: "completed",
      ...(nextBestScore === null ? {} : { best_score: String(nextBestScore) }),
      started_at: sql`coalesce(${node_progress.started_at}, current_timestamp)`,
      completed_at: current.completedAt ?? now,
      updated_at: now,
    })
    .where(eq(node_progress.id, current.id));

  if (!wasCompleted) {
    const [nextNode] = await transaction
      .select({ id: module_nodes.id })
      .from(module_nodes)
      .where(
        and(
          eq(module_nodes.module_id, input.moduleId),
          eq(module_nodes.origin, "core"),
          sql`${module_nodes.core_position} > ${current.position}`,
        ),
      )
      .orderBy(asc(module_nodes.core_position))
      .limit(1);
    if (nextNode) {
      await transaction
        .update(node_progress)
        .set({ status: "available", updated_at: now })
        .where(
          and(
            eq(node_progress.user_id, input.userId),
            eq(node_progress.node_id, nextNode.id),
            eq(node_progress.status, "locked"),
          ),
        );
    }
  }

  const nodes = await transaction
    .select({
      id: module_nodes.id,
      status: node_progress.status,
      bestScore: node_progress.best_score,
      attemptCount: node_progress.attempt_count,
    })
    .from(module_nodes)
    .innerJoin(
      node_progress,
      and(eq(node_progress.node_id, module_nodes.id), eq(node_progress.user_id, input.userId)),
    )
    .where(and(eq(module_nodes.module_id, input.moduleId), eq(module_nodes.origin, "core")))
    .orderBy(asc(module_nodes.core_position));
  const completed = nodes.filter((node) => node.status === "completed").length;
  const total = nodes.length;
  const isCompleted = total > 0 && completed === total;
  const nextCurrent = isCompleted
    ? null
    : (nodes.find((node) => node.status === "in_progress" || node.status === "available")?.id ??
      null);
  const progressStatus: ModuleProgressStatus = isCompleted ? "completed" : "in_progress";
  const progressPercentage = percentage(completed, total);
  await transaction
    .update(user_module_progress)
    .set({
      status: progressStatus,
      current_node_id: nextCurrent,
      progress_percentage: String(progressPercentage),
      started_at: sql`coalesce(${user_module_progress.started_at}, current_timestamp)`,
      completed_at: isCompleted ? (moduleProgress.completedAt ?? now) : null,
      updated_at: now,
    })
    .where(eq(user_module_progress.id, moduleProgress.id));

  let xpAwarded = 0;
  if (!wasCompleted) {
    const [stats] = await transaction
      .select({
        totalXp: user_stats.total_xp,
        currentStreak: user_stats.current_streak,
        longestStreak: user_stats.longest_streak,
        lastLearningDate: user_stats.last_learning_date,
        learningDate: sql<string>`(current_timestamp at time zone ${users.timezone})::date`,
      })
      .from(user_stats)
      .innerJoin(users, eq(users.id, user_stats.user_id))
      .where(eq(user_stats.user_id, input.userId))
      .for("update", { of: user_stats })
      .limit(1);
    if (!stats) throw new Error("User is missing learning statistics.");

    const [event] = await transaction
      .insert(xp_events)
      .values({
        user_id: input.userId,
        module_id: input.moduleId,
        amount: input.xp.amount,
        reason: input.xp.reason,
        reference_id: input.nodeId,
        created_at: now,
      })
      .onConflictDoNothing({
        target: [xp_events.user_id, xp_events.reason, xp_events.reference_id],
      })
      .returning({ id: xp_events.id });
    if (event) {
      await addLeaderboardXp(transaction, input.userId, input.xp.amount);
      xpAwarded = input.xp.amount;
      const sameDay = stats.lastLearningDate === stats.learningDate;
      const consecutive =
        stats.lastLearningDate !== null &&
        nextCalendarDate(stats.lastLearningDate) === stats.learningDate;
      const currentStreak = sameDay
        ? stats.currentStreak
        : consecutive
          ? stats.currentStreak + 1
          : 1;
      await transaction
        .update(user_stats)
        .set({
          total_xp: stats.totalXp + input.xp.amount,
          current_streak: currentStreak,
          longest_streak: Math.max(stats.longestStreak, currentStreak),
          last_learning_date: stats.learningDate,
          updated_at: now,
        })
        .where(eq(user_stats.user_id, input.userId));
    }
  }

  const node = nodes.find((candidate) => candidate.id === input.nodeId);
  if (!node) throw new Error("Completed Node progress is missing.");
  const nextNode = nodes.find((candidate) => candidate.id === nextCurrent);
  const nextAction = selectLearningAction({
    moduleId: input.moduleId,
    moduleStatus: "ready",
    moduleProgressStatus: progressStatus,
    currentCoreNodeId: nextCurrent,
    currentCoreNodeStatus: nextNode?.status,
  });

  return {
    nodeProgress: mapNode({
      ...node,
      status: "completed",
      bestScore: nextBestScore === null ? null : String(nextBestScore),
    }),
    moduleProgress: {
      status: progressStatus,
      percentage: progressPercentage,
      completedCoreNodes: completed,
      totalCoreNodes: total,
    },
    xpAwarded,
    nextAction,
  };
}
