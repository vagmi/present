import { z } from "zod";

// Request body schemas, validated at the controller edge with @hono/zod-validator.
// Keep validation here so controllers stay thin and services trust their inputs.

export const presentationCreateSchema = z.object({
  title: z.string().min(1, "title is required").max(200),
});

export const presentationUpdateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "no fields to update");

export type PresentationCreateInput = z.infer<typeof presentationCreateSchema>;
export type PresentationUpdateInput = z.infer<typeof presentationUpdateSchema>;

// Slides. The `scene` is the Konva stage JSON — an object whose inner shape is
// owned by the editor, so we validate it as a generic JSON object here.
export const slideSceneSchema = z.object({
  scene: z.record(z.string(), z.unknown()),
});

export const slideReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export type SlideSceneInput = z.infer<typeof slideSceneSchema>;
export type SlideReorderInput = z.infer<typeof slideReorderSchema>;
