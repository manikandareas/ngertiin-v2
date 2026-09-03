import { z } from "zod";

export const dependencyStateSchema = z.enum(["up", "down"]);

export type DependencyState = z.infer<typeof dependencyStateSchema>;
