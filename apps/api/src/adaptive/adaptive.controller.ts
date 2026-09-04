import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  adaptiveDecisionBodySchema,
  adaptiveInterventionParamsSchema,
  decideAdaptiveInterventionResponseSchema,
  getAdaptiveInterventionResponseSchema,
  type AdaptiveDecisionBody,
  type AdaptiveInterventionParams,
  type DecideAdaptiveInterventionResponse,
  type GetAdaptiveInterventionResponse,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import {
  streamGeneration,
  type StreamRequest,
  type StreamResponse,
} from "../http/generation-sse.js";
import { IdempotencyKeyPipe } from "../http/idempotency-key.pipe.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { AdaptiveService } from "./adaptive.service.js";

const idempotencyKeyPipe = new IdempotencyKeyPipe();
type PassthroughResponse = { status(status: number): unknown };

@Controller("adaptive-interventions")
@UseGuards(ClerkAuthGuard)
export class AdaptiveController {
  constructor(@Inject(AdaptiveService) private readonly adaptive: AdaptiveService) {}

  @Post(":interventionId/decision")
  async decide(
    @Req() request: ProductRequest,
    @Headers("idempotency-key") keyHeader: unknown,
    @Param(new ZodValidationPipe(adaptiveInterventionParamsSchema))
    params: AdaptiveInterventionParams,
    @Body(new ZodValidationPipe(adaptiveDecisionBodySchema)) body: AdaptiveDecisionBody,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<DecideAdaptiveInterventionResponse> {
    const result = await this.adaptive.decide(
      getLocalUserId(request),
      params.interventionId,
      idempotencyKeyPipe.transform(keyHeader),
      body,
    );
    response.status(result.status);
    return decideAdaptiveInterventionResponseSchema.parse(result.body);
  }

  @Get(":interventionId/generation/events")
  async events(
    @Req() request: ProductRequest & StreamRequest,
    @Res() response: StreamResponse,
    @Param(new ZodValidationPipe(adaptiveInterventionParamsSchema))
    params: AdaptiveInterventionParams,
  ): Promise<void> {
    const userId = getLocalUserId(request);
    const initial = await this.adaptive.generationEventData(userId, params.interventionId);
    streamGeneration({
      request,
      response,
      initial,
      state: (value) => value.generation.state,
      read: () => this.adaptive.generationEventData(userId, params.interventionId),
    });
  }

  @Get(":interventionId")
  async get(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(adaptiveInterventionParamsSchema))
    params: AdaptiveInterventionParams,
  ): Promise<GetAdaptiveInterventionResponse> {
    return getAdaptiveInterventionResponseSchema.parse({
      data: await this.adaptive.get(getLocalUserId(request), params.interventionId),
    });
  }
}
