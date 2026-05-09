import { Schema } from "effect";

export const Stage = Schema.String.pipe(Schema.brand("Stage"));
export type Stage = Schema.Schema.Type<typeof Stage>;

export const StageVocabularyId = Schema.String.pipe(
  Schema.brand("StageVocabularyId")
);
export type StageVocabularyId = Schema.Schema.Type<typeof StageVocabularyId>;
