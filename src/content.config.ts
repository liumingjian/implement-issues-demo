import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const contentBase = process.env.PRACTICES_ROOT ?? "./src/content/practices";

const practices = defineCollection({
  loader: glob({ pattern: "**/*.md", base: contentBase }),
  schema: z.object({
    title: z.string().trim().min(1).max(100),
    date: z.coerce.date(),
    tags: z.array(z.string()).max(5).default([]),
    draft: z.boolean().default(false),
    summary: z.string().trim().min(1).max(200).optional(),
  }).strict(),
});

export const collections = { practices };
