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
