import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  type CompleteNodeResponse,
  type CreateModuleBody,
  type CreateModuleResponse,
  completeNodeResponseSchema,
  createModuleBodySchema,
  createModuleResponseSchema,
  type GenerationState,
  type GetGenerationResponse,
  type GetJourneyResponse,
  type GetModuleResponse,
  type GetNodeResponse,
  getGenerationResponseSchema,
  getJourneyResponseSchema,
  getModuleResponseSchema,
  getNodeResponseSchema,
  type ListModulesQuery,
  type ListModulesResponse,
  listModulesQuerySchema,
  listModulesResponseSchema,
  type ModuleNodeParams,
  type ModuleParams,
  moduleNodeParamsSchema,
  moduleParamsSchema,
  type RetryGenerationResponse,
  retryGenerationResponseSchema,
  type StartNodeResponse,
  startNodeResponseSchema,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { IdempotencyKeyPipe } from "../http/idempotency-key.pipe.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { ModulesService } from "./modules.service.js";

type PassthroughResponse = { status(status: number): unknown };
type StreamRequest = ProductRequest & { on(event: "close", listener: () => void): void };
type StreamResponse = {
  status(status: number): StreamResponse;
  setHeader(name: string, value: string): void;
  flushHeaders?(): void;
  write(chunk: string): boolean;
  end(): void;
};

const idempotencyKeyPipe = new IdempotencyKeyPipe();

function generationEventName(
  state: GenerationState,
): "generation.completed" | "generation.failed" | "generation.progress" {
  if (state === "completed") return "generation.completed";
  if (state === "failed") return "generation.failed";
  return "generation.progress";
}

@Controller("modules")
@UseGuards(ClerkAuthGuard)
export class ModulesController {
  constructor(@Inject(ModulesService) private readonly modulesService: ModulesService) {}

  @Post()
  @HttpCode(202)
  async createModule(
    @Req() request: ProductRequest,
    @Headers("idempotency-key") keyHeader: unknown,
    @Body(new ZodValidationPipe(createModuleBodySchema)) input: CreateModuleBody,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<CreateModuleResponse> {
    const key = idempotencyKeyPipe.transform(keyHeader);
    const result = await this.modulesService.createModule(getLocalUserId(request), key, input);
    response.status(result.status);
    return createModuleResponseSchema.parse(result.body);
  }

  @Get()
  async listModules(
    @Req() request: ProductRequest,
    @Query(new ZodValidationPipe(listModulesQuerySchema)) query: ListModulesQuery,
  ): Promise<ListModulesResponse> {
    const result = await this.modulesService.listModules(getLocalUserId(request), query);
    return listModulesResponseSchema.parse(result);
  }

  @Get(":moduleId/generation/events")
  async streamGeneration(
    @Req() request: StreamRequest,
    @Res() response: StreamResponse,
    @Param(new ZodValidationPipe(moduleParamsSchema)) params: ModuleParams,
  ): Promise<void> {
    const userId = getLocalUserId(request);
    const initial = await this.modulesService.getGeneration(userId, params.moduleId);
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();
    response.write(`event: generation.snapshot\ndata: ${JSON.stringify(initial)}\n\n`);

    if (initial.state === "completed" || initial.state === "failed") {
      response.end();
      return;
    }

    let closed = false;
    let polling = false;
    let previous = JSON.stringify(initial);
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    const close = (): void => {
      if (closed) return;
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      response.end();
    };
    request.on("close", close);

    pollTimer = setInterval(() => {
      if (closed || polling) return;
      polling = true;
      void this.modulesService
        .getGeneration(userId, params.moduleId)
        .then((status) => {
          const serialized = JSON.stringify(status);
          if (serialized === previous || closed) return;
          previous = serialized;
          const event = generationEventName(status.state);
          response.write(`event: ${event}\ndata: ${serialized}\n\n`);
          if (status.state === "completed" || status.state === "failed") close();
        })
        .catch(close)
        .finally(() => {
          polling = false;
        });
    }, 1_000);
    pollTimer.unref();
    heartbeatTimer = setInterval(() => {
      if (!closed) response.write(": heartbeat\n\n");
    }, 15_000);
    heartbeatTimer.unref();
  }

  @Get(":moduleId/generation")
  async getGeneration(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) params: ModuleParams,
  ): Promise<GetGenerationResponse> {
    const generation = await this.modulesService.getGeneration(
      getLocalUserId(request),
      params.moduleId,
    );
    return getGenerationResponseSchema.parse({ data: generation });
  }

  @Get(":moduleId/journey")
  async getJourney(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) params: ModuleParams,
  ): Promise<GetJourneyResponse> {
    const journey = await this.modulesService.getJourney(getLocalUserId(request), params.moduleId);
    return getJourneyResponseSchema.parse({ data: journey });
  }

  @Get(":moduleId/nodes/:nodeId")
  async getNode(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleNodeParamsSchema)) params: ModuleNodeParams,
  ): Promise<GetNodeResponse> {
    const node = await this.modulesService.getNode(
      getLocalUserId(request),
      params.moduleId,
      params.nodeId,
    );
    return getNodeResponseSchema.parse({ data: node });
  }

  @Post(":moduleId/nodes/:nodeId/start")
  async startNode(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleNodeParamsSchema)) params: ModuleNodeParams,
  ): Promise<StartNodeResponse> {
    const result = await this.modulesService.startNode(
      getLocalUserId(request),
      params.moduleId,
      params.nodeId,
    );
    return startNodeResponseSchema.parse({ data: result });
  }

  @Post(":moduleId/nodes/:nodeId/complete")
  async completeNode(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleNodeParamsSchema)) params: ModuleNodeParams,
  ): Promise<CompleteNodeResponse> {
    const result = await this.modulesService.completeNode(
      getLocalUserId(request),
      params.moduleId,
      params.nodeId,
    );
    return completeNodeResponseSchema.parse({ data: result });
  }

  @Post(":moduleId/generation/retry")
  @HttpCode(202)
  async retryGeneration(
    @Req() request: ProductRequest,
    @Headers("idempotency-key") keyHeader: unknown,
    @Param(new ZodValidationPipe(moduleParamsSchema)) params: ModuleParams,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<RetryGenerationResponse> {
    const key = idempotencyKeyPipe.transform(keyHeader);
    const result = await this.modulesService.retryGeneration(
      getLocalUserId(request),
      params.moduleId,
      key,
    );
    response.status(result.status);
    return retryGenerationResponseSchema.parse(result.body);
  }

  @Get(":moduleId")
  async getModule(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(moduleParamsSchema)) params: ModuleParams,
  ): Promise<GetModuleResponse> {
    const module = await this.modulesService.getModule(getLocalUserId(request), params.moduleId);
    return getModuleResponseSchema.parse({ data: module });
  }
}
