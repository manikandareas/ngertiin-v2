import { z } from "zod";
import { successEnvelopeSchema } from "../common/identifiers.js";
import { moduleSummarySchema } from "../modules/module.js";
import { userStatsSchema } from "../users/current-user.js";

export const dashboardSchema = z.object({
  continueLearning: z.object({ module: moduleSummarySchema }).nullable(),
  modules: z.array(moduleSummarySchema),
  stats: userStatsSchema,
});

export const getDashboardResponseSchema = successEnvelopeSchema(dashboardSchema);

export type Dashboard = z.infer<typeof dashboardSchema>;
export type GetDashboardResponse = z.infer<typeof getDashboardResponseSchema>;
