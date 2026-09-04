import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  type AttemptParams,
  attemptParamsSchema,
  type GetAttemptResponse,
  getAttemptResponseSchema,
  type ModuleNodeParams,
  moduleNodeParamsSchema,
  type SubmitAttemptBody,
  submitAttemptBodySchema,
  type SubmitAttemptResponse,
  submitAttemptResponseSchema,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { AttemptsService } from "./attempts.service.js";

@Controller()
@UseGuards(ClerkAuthGuard)
export class AttemptsController {
  constructor(@Inject(AttemptsService) private readonly attemptsService: AttemptsService) {}

  @Post("modules/:moduleId/nodes/:nodeId/attempts")
  async submitAttempt(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleNodeParamsSchema)) params: ModuleNodeParams,
    @Body(new ZodValidationPipe(submitAttemptBodySchema)) body: SubmitAttemptBody,
  ): Promise<SubmitAttemptResponse> {
    const result = await this.attemptsService.submitAttempt(
      getLocalUserId(request),
      params.moduleId,
      params.nodeId,
      body,
    );
    return submitAttemptResponseSchema.parse({ data: result });
  }

  @Get("attempts/:attemptId")
  async getAttempt(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(attemptParamsSchema)) params: AttemptParams,
  ): Promise<GetAttemptResponse> {
    const result = await this.attemptsService.getAttempt(getLocalUserId(request), params.attemptId);
    return getAttemptResponseSchema.parse({ data: result });
  }
}
