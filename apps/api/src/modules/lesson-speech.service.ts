import { Inject, Injectable } from "@nestjs/common";
import type { SpeechAsset } from "@ngertiin/contracts/api";
import { lessonSpeechBlocks } from "@ngertiin/shared";
import { ProductError } from "../http/product-error.js";
import { SpeechAssetsService } from "../speech/speech-assets.service.js";
import { ModulesService } from "./modules.service.js";

@Injectable()
export class LessonSpeechService {
  constructor(
    @Inject(ModulesService) private readonly modules: ModulesService,
    @Inject(SpeechAssetsService) private readonly speechAssets: SpeechAssetsService,
  ) {}

  async get(
    userId: string,
    moduleId: string,
    nodeId: string,
    activityId: string,
    create: boolean,
  ): Promise<SpeechAsset> {
    const node = await this.modules.getNode(userId, moduleId, nodeId);
    const activity = node.activities.find((item) => item.id === activityId);
    if (activity?.type !== "lesson")
      throw new ProductError(404, "NOT_FOUND", "Lesson not found", "This lesson is unavailable.");
    const blocks = lessonSpeechBlocks(activity.content);
    if (!blocks.length)
      throw new ProductError(
        422,
        "VALIDATION_ERROR",
        "Empty lesson",
        "This lesson has no readable text.",
      );
    return this.speechAssets.get(blocks, create);
  }
}
