import {
  type PracticeAnswer,
  practiceAttemptResponseSchema,
  practiceAttemptsResponseSchema,
  practiceDetailResponseSchema,
  practiceListResponseSchema,
  practiceSummaryResponseSchema,
} from "@ngertiin/contracts/api";
import { requestApi, type TokenResolver } from "../../lib/api";

export const practiceApi = (token: TokenResolver) => ({
  list: async (moduleId: string, cursor?: string) =>
    requestApi(
      `/modules/${moduleId}/practices${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      token,
      practiceListResponseSchema,
    ),
  detail: async (id: string) =>
    (await requestApi(`/practices/${id}`, token, practiceDetailResponseSchema)).data,
  attempts: async (id: string) =>
    (await requestApi(`/practices/${id}/attempts`, token, practiceAttemptsResponseSchema)).data,
  patch: async (id: string, body: { title?: string; archived?: boolean }) =>
    (
      await requestApi(`/practices/${id}`, token, practiceSummaryResponseSchema, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
    ).data,
  retry: async (id: string) =>
    (
      await requestApi(`/practices/${id}/retry`, token, practiceDetailResponseSchema, {
        method: "POST",
        body: "{}",
      })
    ).data,
  start: async (id: string) =>
    (
      await requestApi(`/practices/${id}/attempts`, token, practiceAttemptResponseSchema, {
        method: "POST",
        body: "{}",
      })
    ).data,
  attempt: async (id: string) =>
    (await requestApi(`/practice-attempts/${id}`, token, practiceAttemptResponseSchema)).data,
  save: async (id: string, revision: number, answers: Record<string, PracticeAnswer>) =>
    (
      await requestApi(`/practice-attempts/${id}`, token, practiceAttemptResponseSchema, {
        method: "PATCH",
        body: JSON.stringify({ revision, answers }),
      })
    ).data,
  submit: async (id: string) =>
    (
      await requestApi(`/practice-attempts/${id}/submit`, token, practiceAttemptResponseSchema, {
        method: "POST",
        body: "{}",
      })
    ).data,
  retryEvaluation: async (id: string) =>
    (
      await requestApi(
        `/practice-attempts/${id}/retry-evaluation`,
        token,
        practiceAttemptResponseSchema,
        { method: "POST", body: "{}" },
      )
    ).data,
});
