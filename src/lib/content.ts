import { getCollection } from 'astro:content';
export const posts = async () => (await getCollection('posts', ({ data }) => !data.draft)).sort((a,b) => b.data.date.getTime()-a.data.date.getTime());
export const projects = async () => (await getCollection('projects', ({ data }) => !data.draft)).sort((a,b) => b.data.date.getTime()-a.data.date.getTime());
export const albums = async () => (await getCollection('albums')).sort((a,b) => b.data.date.getTime()-a.data.date.getTime());