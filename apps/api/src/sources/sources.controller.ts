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
  type CreateTextSourceBody,
  type CreateTextSourceResponse,
  createTextSourceBodySchema,
  createTextSourceResponseSchema,
  type GetSourceResponse,
  getSourceResponseSchema,
  type ListSourcesQuery,
  type ListSourcesResponse,
  listSourcesQuerySchema,
  listSourcesResponseSchema,
  type SourceParams,
  sourceParamsSchema,
} from "@ngertiin/contracts/api";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard.js";
import { IdempotencyKeyPipe } from "../http/idempotency-key.pipe.js";
import { getLocalUserId, type ProductRequest } from "../http/request-context.js";
import { ZodValidationPipe } from "../http/zod-validation.pipe.js";
import { SourcesService } from "./sources.service.js";

type PassthroughResponse = {
  status(status: number): unknown;
};

const idempotencyKeyPipe = new IdempotencyKeyPipe();

@Controller("sources")
@UseGuards(ClerkAuthGuard)
export class SourcesController {
  constructor(@Inject(SourcesService) private readonly sourcesService: SourcesService) {}

  @Post("text")
  @HttpCode(201)
  async createTextSource(
    @Req() request: ProductRequest,
    @Headers("idempotency-key") keyHeader: unknown,
    @Body(new ZodValidationPipe(createTextSourceBodySchema)) input: CreateTextSourceBody,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<CreateTextSourceResponse> {
    const key = idempotencyKeyPipe.transform(keyHeader);
    const result = await this.sourcesService.createTextSource(getLocalUserId(request), key, input);
    response.status(result.status);
    return createTextSourceResponseSchema.parse(result.body);
  }

  @Get()
  async listSources(
    @Req() request: ProductRequest,
    @Query(new ZodValidationPipe(listSourcesQuerySchema)) query: ListSourcesQuery,
  ): Promise<ListSourcesResponse> {
    const result = await this.sourcesService.listSources(getLocalUserId(request), query);
    return listSourcesResponseSchema.parse(result);
  }

  @Get(":sourceId")
  async getSource(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(sourceParamsSchema)) params: SourceParams,
  ): Promise<GetSourceResponse> {
    const source = await this.sourcesService.getSource(getLocalUserId(request), params.sourceId);
    return getSourceResponseSchema.parse({ data: source });
  }
}
