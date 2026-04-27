import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;

type NotesListEndpoint = Client["api"]["notes"]["$get"];
type NotesListResponse = Extract<
  InferResponseType<NotesListEndpoint>,
  { success: true }
>;

type DeadlinesListEndpoint = Client["api"]["deadlines"]["$get"];
type DeadlinesListResponse = Extract<
  InferResponseType<DeadlinesListEndpoint>,
  { success: true }
>;

export type DialogMode = "view" | "edit" | "create";
export type Note = NotesListResponse["data"][number];
export type Deadline = DeadlinesListResponse["data"][number];
export type NotesListData = NotesListResponse;
export type DeadlinesListData = DeadlinesListResponse;
