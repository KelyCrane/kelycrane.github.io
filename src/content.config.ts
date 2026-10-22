import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';
const common = { title: z.string(), description: z.string(), date: z.coerce.date(), draft: z.boolean().default(false), demo: z.boolean().default(false), featured: z.boolean().default(false), tags: z.array(z.string()).default([]) };
const posts = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/posts' }), schema: z.object({ ...common, category: z.string().default('随笔') }) });
const projects = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/projects' }), schema: z.object({ ...common, url: z.url().optional(), cover: z.string().optional(), coverAlt: z.string().optional() }) });
const albums = defineCollection({ loader: file('src/content/albums.json'), schema: z.object({ title: z.string(), description: z.string(), date: z.coerce.date(), demo: z.boolean().default(false), featured: z.boolean().default(false), article: z.string().optional(), images: z.array(z.object({ src: z.string(), full: z.string().optional(), sources: z.array(z.object({src:z.string(),width:z.number()})).optional(), section: z.string().optional(), alt: z.string(), caption: z.string().optional(), width: z.number(), height: z.number() })) }) });
export const collections = { posts, projects, albums };
