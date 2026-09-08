import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  type CreatePdfSourceFields,
  type CreatePdfSourceResponse,
  type CreateTextSourceBody,
  type CreateTextSourceResponse,
  type CreateUrlSourceBody,
  type CreateUrlSourceResponse,
  createPdfSourceFieldsSchema,
  createPdfSourceResponseSchema,
  createTextSourceBodySchema,
  createTextSourceResponseSchema,
  createUrlSourceBodySchema,
  createUrlSourceResponseSchema,
  type GetSourceResponse,
  getSourceResponseSchema,
  type ListSourcesQuery,
  type ListSourcesResponse,
  listSourcesQuerySchema,
  listSourcesResponseSchema,
  MAX_PDF_SIZE_BYTES,
  type PatchSourceBody,
  patchSourceBodySchema,
  type RetrySourceResponse,
  retrySourceResponseSchema,
  type SourceFileResponse,
  type SourceParams,
  type SourcePreviewResponse,
  sourceFileResponseSchema,
  sourceParamsSchema,
  sourcePreviewResponseSchema,
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

  @Post("url")
  @HttpCode(202)
  async createUrlSource(
    @Req() request: ProductRequest,
    @Headers("idempotency-key") keyHeader: unknown,
    @Body(new ZodValidationPipe(createUrlSourceBodySchema)) input: CreateUrlSourceBody,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<CreateUrlSourceResponse> {
    const key = idempotencyKeyPipe.transform(keyHeader);
    const result = await this.sourcesService.createUrlSource(getLocalUserId(request), key, input);
    response.status(result.status);
    return createUrlSourceResponseSchema.parse(result.body);
  }

  @Post("pdf")
  @HttpCode(202)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PDF_SIZE_BYTES, files: 1 } }))
  async createPdfSource(
    @Req() request: ProductRequest,
    @Headers("idempotency-key") keyHeader: unknown,
    @Body(new ZodValidationPipe(createPdfSourceFieldsSchema)) fields: CreatePdfSourceFields,
    @UploadedFile()
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<CreatePdfSourceResponse> {
    const key = idempotencyKeyPipe.transform(keyHeader);
    const result = await this.sourcesService.createPdfSource(
      getLocalUserId(request),
      key,
      fields,
      file,
    );
    response.status(result.status);
    return createPdfSourceResponseSchema.parse(result.body);
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

  @Patch(":sourceId")
  async patchSource(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(sourceParamsSchema)) params: SourceParams,
    @Body(new ZodValidationPipe(patchSourceBodySchema)) input: PatchSourceBody,
  ): Promise<GetSourceResponse> {
    return getSourceResponseSchema.parse({
      data: await this.sourcesService.patchSource(getLocalUserId(request), params.sourceId, input),
    });
  }

  @Get(":sourceId/preview")
  async preview(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(sourceParamsSchema)) params: SourceParams,
  ): Promise<SourcePreviewResponse> {
    return sourcePreviewResponseSchema.parse(
      await this.sourcesService.preview(getLocalUserId(request), params.sourceId),
    );
  }

  @Get(":sourceId/file")
  @Header("Cache-Control", "private, no-store")
  async file(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(sourceParamsSchema)) params: SourceParams,
  ): Promise<SourceFileResponse> {
    return sourceFileResponseSchema.parse(
      await this.sourcesService.file(getLocalUserId(request), params.sourceId),
    );
  }

  @Post(":sourceId/retry")
  @HttpCode(202)
  async retrySource(
    @Req() request: ProductRequest,
    @Param(new ZodValidationPipe(sourceParamsSchema)) params: SourceParams,
    @Headers("idempotency-key") keyHeader: unknown,
    @Res({ passthrough: true }) response: PassthroughResponse,
  ): Promise<RetrySourceResponse> {
    const key = idempotencyKeyPipe.transform(keyHeader);
    const result = await this.sourcesService.retrySource(
      getLocalUserId(request),
      params.sourceId,
      key,
    );
    response.status(result.status);
    return retrySourceResponseSchema.parse(result.body);
  }
}
