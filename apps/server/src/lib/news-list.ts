import { count, sql } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { newsPosts } from "@my-better-t-app/db/schema";

export const NEWS_EXCERPT_LENGTH = 120;

export const newsListTotalCount = sql<number>`count(*) over ()`
  .mapWith(Number)
  .as("totalCount");

export async function countNewsPostsTotal(): Promise<number> {
  const [total] = await db.select({ value: count() }).from(newsPosts);
  return total?.value ?? 0;
}

export function createNewsExcerpt(
  content: string,
  maxLength = NEWS_EXCERPT_LENGTH,
): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength).trimEnd()}...`;
}
