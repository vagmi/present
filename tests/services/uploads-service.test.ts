import { describe, expect, it, vi } from "vitest";
import { createUploadsService } from "../../workers/api/services/uploads-service";
import { ValidationError } from "../../workers/api/services/errors";

function makeService() {
  const bucket = { put: vi.fn(), get: vi.fn(), delete: vi.fn(), list: vi.fn() };
  const service = createUploadsService({
    bucket: bucket as unknown as R2Bucket,
  });
  return { service, bucket };
}

const png = {
  filename: "Photo.PNG",
  contentType: "image/png",
  size: 1024,
  body: new ArrayBuffer(8),
};

describe("uploads service", () => {
  describe("put", () => {
    it("stores under an org + presentation prefixed key from the file extension", async () => {
      const { service, bucket } = makeService();
      const { key } = await service.put("org_test_1", "pres_1", png);

      expect(key.startsWith("org_test_1/pres_1/")).toBe(true);
      expect(key.endsWith(".png")).toBe(true);
      expect(bucket.put).toHaveBeenCalledWith(key, png.body, {
        httpMetadata: { contentType: "image/png" },
      });
    });

    it("rejects an unsupported content type", async () => {
      const { service, bucket } = makeService();
      await expect(
        service.put("org_test_1", "pres_1", {
          ...png,
          contentType: "text/plain",
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(bucket.put).not.toHaveBeenCalled();
    });

    it("rejects a file over the size limit", async () => {
      const { service, bucket } = makeService();
      await expect(
        service.put("org_test_1", "pres_1", { ...png, size: 6 * 1024 * 1024 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(bucket.put).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("lists a presentation's objects by org+presentation prefix", async () => {
      const { service, bucket } = makeService();
      bucket.list.mockResolvedValue({
        objects: [{ key: "org_a/pres_1/a.png" }, { key: "org_a/pres_1/b.png" }],
      });

      const result = await service.list("org_a", "pres_1");

      expect(bucket.list).toHaveBeenCalledWith({
        prefix: "org_a/pres_1/",
        limit: 1000,
      });
      expect(result.map((u) => u.key)).toEqual([
        "org_a/pres_1/b.png",
        "org_a/pres_1/a.png",
      ]);
    });
  });

  describe("get", () => {
    it("refuses a key outside the caller's org prefix", async () => {
      const { service, bucket } = makeService();
      await expect(
        service.get("org_a", "org_b/secret.png"),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(bucket.get).not.toHaveBeenCalled();
    });

    it("reads a key within the org prefix", async () => {
      const { service, bucket } = makeService();
      bucket.get.mockResolvedValue({ body: "bytes" });
      const obj = await service.get("org_a", "org_a/pic.png");
      expect(obj).toEqual({ body: "bytes" });
      expect(bucket.get).toHaveBeenCalledWith("org_a/pic.png");
    });
  });

  describe("delete", () => {
    it("refuses a key outside the caller's org prefix", async () => {
      const { service, bucket } = makeService();
      await expect(
        service.delete("org_a", "org_b/pic.png"),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(bucket.delete).not.toHaveBeenCalled();
    });

    it("deletes a key within the org prefix", async () => {
      const { service, bucket } = makeService();
      await service.delete("org_a", "org_a/pic.png");
      expect(bucket.delete).toHaveBeenCalledWith("org_a/pic.png");
    });
  });
});
