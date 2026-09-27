import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  createPracticeBodySchema,
  listPracticesQuerySchema,
  patchPracticeAttemptSchema,
  patchPracticeSchema,
  practiceAttemptResponseSchema,
  practiceAttemptsResponseSchema,
  practiceDetailResponseSchema,
  practiceListResponseSchema,
  practiceSummaryResponseSchema,
  uuidSchema,
} from "@ngertiin/contracts/api";
import { z } from "zod";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { PracticeService } from "./practice.service.js";

const moduleParams = z.object({ moduleId: uuidSchema });
const setParams = z.object({ practiceId: uuidSchema });
const attemptParams = z.object({ attemptId: uuidSchema });

@Controller()
@UseGuards(ClerkAuthGuard)
export class PracticeController {
  constructor(@Inject(PracticeService) private readonly practice: PracticeService) {}

  @Post("modules/:moduleId/practices")
  async create(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(moduleParams)) params: z.infer<typeof moduleParams>,
    @Body(new ZodValidationPipe(createPracticeBodySchema)) body: z.infer<
      typeof createPracticeBodySchema
    >,
  ) {
    return practiceSummaryResponseSchema.parse({
      data: await this.practice.createFromForm(getLocalUserId(req), params.moduleId, body),
    });
  }

  @Get("modules/:moduleId/practices")
  async list(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(moduleParams)) params: z.infer<typeof moduleParams>,
    @Query(new ZodValidationPipe(listPracticesQuerySchema)) query: z.infer<
      typeof listPracticesQuerySchema
    >,
  ) {
    return practiceListResponseSchema.parse(
      await this.practice.list(getLocalUserId(req), params.moduleId, query),
    );
  }

  @Get("practices/:practiceId")
  async detail(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(setParams)) params: z.infer<typeof setParams>,
  ) {
    return practiceDetailResponseSchema.parse({
      data: await this.practice.detail(getLocalUserId(req), params.practiceId),
    });
  }

  @Patch("practices/:practiceId")
  async patch(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(setParams)) params: z.infer<typeof setParams>,
    @Body(new ZodValidationPipe(patchPracticeSchema)) body: z.infer<typeof patchPracticeSchema>,
  ) {
    return practiceSummaryResponseSchema.parse({
      data: await this.practice.patch(getLocalUserId(req), params.practiceId, body),
    });
  }

  @Post("practices/:practiceId/retry")
  async retry(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(setParams)) params: z.infer<typeof setParams>,
  ) {
    return practiceDetailResponseSchema.parse({
      data: await this.practice.retry(getLocalUserId(req), params.practiceId),
    });
  }

  @Post("practices/:practiceId/attempts")
  async start(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(setParams)) params: z.infer<typeof setParams>,
  ) {
    return practiceAttemptResponseSchema.parse({
      data: await this.practice.startAttempt(getLocalUserId(req), params.practiceId),
    });
  }

  @Get("practices/:practiceId/attempts")
  async attempts(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(setParams)) params: z.infer<typeof setParams>,
  ) {
    return practiceAttemptsResponseSchema.parse(
      await this.practice.listAttempts(getLocalUserId(req), params.practiceId),
    );
  }

  @Get("practice-attempts/:attemptId")
  async attempt(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(attemptParams)) params: z.infer<typeof attemptParams>,
  ) {
    return practiceAttemptResponseSchema.parse({
      data: await this.practice.getAttempt(getLocalUserId(req), params.attemptId),
    });
  }

  @Patch("practice-attempts/:attemptId")
  async save(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(attemptParams)) params: z.infer<typeof attemptParams>,
    @Body(new ZodValidationPipe(patchPracticeAttemptSchema)) body: z.infer<
      typeof patchPracticeAttemptSchema
    >,
  ) {
    return practiceAttemptResponseSchema.parse({
      data: await this.practice.save(
        getLocalUserId(req),
        params.attemptId,
        body.revision,
        body.answers,
      ),
    });
  }

  @Post("practice-attempts/:attemptId/submit")
  async submit(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(attemptParams)) params: z.infer<typeof attemptParams>,
  ) {
    return practiceAttemptResponseSchema.parse({
      data: await this.practice.submit(getLocalUserId(req), params.attemptId),
    });
  }

  @Post("practice-attempts/:attemptId/retry-evaluation")
  async retryEvaluation(
    @Req() req: ProductRequest,
    @Param(new ZodValidationPipe(attemptParams)) params: z.infer<typeof attemptParams>,
  ) {
    return practiceAttemptResponseSchema.parse({
      data: await this.practice.retryEvaluation(getLocalUserId(req), params.attemptId),
    });
  }
}
