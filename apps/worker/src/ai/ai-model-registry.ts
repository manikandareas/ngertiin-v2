export interface AiModel {
  readonly provider: string;
  readonly modelId: string;
}

export interface AiModelRegistry {
  readonly analysisModel: AiModel;
  readonly curriculumModel: AiModel;
  readonly activityModel: AiModel;
  readonly evaluationModel: AiModel;
}

export const AI_MODEL_REGISTRY = Symbol("AI_MODEL_REGISTRY");
