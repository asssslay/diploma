import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;

type NewsListEndpoint = Client["api"]["news"]["$get"];
type NewsResponse = Extract<
  InferResponseType<NewsListEndpoint>,
  { success: true }
>;

type EventsListEndpoint = Client["api"]["events"]["$get"];
type EventsResponse = Extract<
  InferResponseType<EventsListEndpoint>,
  { success: true }
>;

export type NewsPost = NewsResponse["data"][number];
export type NewsListData = NewsResponse;
export type EventItem = EventsResponse["data"][number];
export type EventsListData = EventsResponse;
export type EventFilter = "all" | "registered" | "available";
