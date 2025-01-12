/**
 * @jest-environment jsdom
 */

// import { LangfuseWeb } from '../'
import { generateUUID } from "langfuse-core/src/utils";
import { LangfuseWeb } from "../index";

describe("langfuseWeb", () => {
  let fetch: jest.Mock;
  jest.useRealTimers();

  beforeEach(() => {
    (global as any).fetch = fetch = jest.fn(async (url) => {
      let res: any = { status: "ok" };

      // Can add more mocks here
      if (url.includes("traces")) {
        res = {
          ...res,
        };
      }

      if (url.startsWith("https://cloud-fail.langfuse.com")) {
        return {
          status: 404,
          json: () => Promise.resolve(res),
        };
      }

      return {
        status: 200,
        json: () => Promise.resolve(res),
      };
    });
  });

  describe("init", () => {
    it("should initialise", async () => {
      const langfuse = new LangfuseWeb({
        publicKey: "pk",
        flushAt: 10,
      });
      expect(langfuse.baseUrl).toEqual("https://cloud.langfuse.com");

      const id = generateUUID();
      const score = langfuse.score({
        id,
        name: "test",
        traceId: "test-trace-1",
        value: 200,
        comment: "test comment",
        observationId: "test-observation-id",
      });

      expect(score).toBeInstanceOf(Promise);

      await score;

      expect(fetch).toHaveBeenCalledTimes(1);

      expect(fetch).toHaveBeenCalledWith(
        "https://cloud.langfuse.com/api/public/scores",
        expect.objectContaining({
          body: JSON.stringify({
            id,
            name: "test",
            traceId: "test-trace-1",
            value: 200,
            comment: "test comment",
            observationId: "test-observation-id",
          }),
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Langfuse-Public-Key": "pk",
            Authorization: "Bearer pk",
            "X-Langfuse-Sdk-Name": "langfuse-js",
            "X-Langfuse-Sdk-Version": langfuse.getLibraryVersion(),
            "X-Langfuse-Sdk-Variant": langfuse.getLibraryId(),
          }),
          signal: expect.anything(),
        })
      );
    });

    it("should throw error if score was not created", async () => {
      const langfuse = new LangfuseWeb({
        publicKey: "pk",
        baseUrl: "https://cloud-fail.langfuse.com", // this will fail with 404
        flushAt: 10,
        fetchRetryCount: 2,
        fetchRetryDelay: 2,
      });
      expect(langfuse.baseUrl).toEqual("https://cloud-fail.langfuse.com");

      const id = generateUUID();
      const score = langfuse.score({
        id,
        name: "test",
        traceId: "test-trace-1",
        value: 200,
        comment: "test comment",
        observationId: "test-observation-id",
      });

      // expect score promise to throw error and check error message
      await expect(score).rejects.toThrow("HTTP error while fetching Langfuse: 404");

      // 1 call + 2 retries
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("score is the only available object", async () => {
      const langfuse = new LangfuseWeb({ publicKey: "pk" });

      expect(langfuse).toHaveProperty("score");

      expect(langfuse).not.toHaveProperty("trace");
      expect(langfuse).not.toHaveProperty("observation");
      expect(langfuse).not.toHaveProperty("span");
      expect(langfuse).not.toHaveProperty("event");
      expect(langfuse).not.toHaveProperty("generation");
    });
  });
});
