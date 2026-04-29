import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResults,
  insertResults,
  updateResults,
  deleteResults,
  selectMock,
  insertMock,
  updateMock,
  deleteMock,
  uploadMock,
  getPublicUrlMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const insertResults: unknown[] = [];
  const updateResults: unknown[] = [];
  const deleteResults: unknown[] = [];

  const dequeue = (queue: unknown[]) => {
    if (queue.length === 0) throw new Error("No queued query result");
    return queue.shift();
  };

  const createThenable = (queue: unknown[]) => ({
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(dequeue(queue)).then(resolve, reject),
  });

  const selectLimitQuery = {
    offset: vi.fn(() => Promise.resolve(dequeue(selectResults))),
    then: createThenable(selectResults).then,
  };

  const selectQuery: Record<string, unknown> = {};
  Object.assign(selectQuery, {
    from: vi.fn(() => selectQuery),
    where: vi.fn(() => selectQuery),
    leftJoin: vi.fn(() => selectQuery),
    orderBy: vi.fn(() => selectQuery),
    limit: vi.fn(() => selectLimitQuery),
    then: createThenable(selectResults).then,
  });

  return {
    selectResults,
    insertResults,
    updateResults,
    deleteResults,
    selectMock: vi.fn(() => selectQuery),
    insertMock: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(dequeue(insertResults))),
      })),
    })),
    updateMock: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(dequeue(updateResults))),
        })),
      })),
    })),
    deleteMock: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(dequeue(deleteResults))),
      })),
    })),
    uploadMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
  },
}));

vi.mock("@my-better-t-app/db/supabase-admin", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  },
}));

vi.mock("@/middleware/auth", async () => {
  const { createAppMiddleware } = await import("@/lib/app");
  return {
    auth: createAppMiddleware(async (c, next) => {
      c.set("user", { id: "admin-1", email: "admin@example.com" });
      c.set("profile", {
        id: "admin-1",
        role: "admin",
        status: "approved",
      });
      await next();
    }),
    adminOnly: createAppMiddleware(async (_c, next) => {
      await next();
    }),
  };
});

import app from "./news";

const postId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("admin news routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    insertResults.length = 0;
    updateResults.length = 0;
    deleteResults.length = 0;
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/news.png" },
    });
  });

  it("lists news posts with pagination metadata", async () => {
    selectResults.push([
      { id: postId, title: "Campus update", totalCount: 1 },
    ]);

    const response = await app.request("http://localhost/?page=1&pageSize=10");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      data: [{ id: postId }],
    });
  });

  it("uploads an image and returns the public url", async () => {
    const formData = new FormData();
    formData.append("image", new File(["img"], "news.png", { type: "image/png" }));

    const response = await app.request("http://localhost/upload-image", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { imageUrl: "https://cdn.example.com/news.png" },
    });
  });

  it("rejects invalid upload types", async () => {
    const formData = new FormData();
    formData.append("image", new File(["img"], "bad.txt", { type: "text/plain" }));

    const response = await app.request("http://localhost/upload-image", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Image must be JPEG, PNG, or WebP");
  });

  it("returns 500 when image upload fails", async () => {
    uploadMock.mockResolvedValue({ error: { message: "nope" } });
    const formData = new FormData();
    formData.append("image", new File(["img"], "news.png", { type: "image/png" }));

    const response = await app.request("http://localhost/upload-image", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Failed to upload image");
  });

  it("returns the news post detail", async () => {
    selectResults.push([
      {
        id: postId,
        title: "Campus update",
        content: "Semester starts soon",
        imageUrl: null,
        authorName: "Admin",
        publishedAt: "2030-05-01T12:00:00.000Z",
        viewCount: 5,
        createdAt: "2030-05-01T12:00:00.000Z",
        updatedAt: "2030-05-01T12:00:00.000Z",
      },
    ]);

    const response = await app.request(`http://localhost/${postId}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: postId, title: "Campus update" },
    });
  });

  it("creates a news post with the authenticated admin as author", async () => {
    insertResults.push([{ id: postId, title: "Campus update" }]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Campus update",
        content: "Semester starts soon",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: postId, title: "Campus update" },
    });
  });

  it("patches a post after confirming it exists", async () => {
    selectResults.push([{ id: postId }]);
    updateResults.push([{ id: postId, imageUrl: null }]);

    const response = await app.request(`http://localhost/${postId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrl: null }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: postId, imageUrl: null },
    });
  });

  it("returns 404 when patching a missing post", async () => {
    selectResults.push([]);

    const response = await app.request(`http://localhost/${postId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrl: null }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("News post not found");
  });

  it("deletes an existing post", async () => {
    deleteResults.push([{ id: postId }]);

    const response = await app.request(`http://localhost/${postId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: postId },
    });
  });

  it("returns 404 when deleting a missing post", async () => {
    deleteResults.push([]);

    const response = await app.request(`http://localhost/${postId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("News post not found");
  });
});
