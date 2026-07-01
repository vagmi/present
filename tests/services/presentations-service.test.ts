import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  PlanLimitError,
} from "../../workers/api/services/errors";
import { createPresentationsService } from "../../workers/api/services/presentations-service";
import {
  fakePresentation,
  mockPresentationsRepo,
  mockUsageRepo,
} from "../helpers/mocks";

const ORG = "org_test_1";
const USER = "user_test_1";

function makeService() {
  const presentationsRepo = mockPresentationsRepo();
  const usageRepo = mockUsageRepo();
  const service = createPresentationsService({ presentationsRepo, usageRepo });
  return { service, presentationsRepo, usageRepo };
}

describe("presentations service", () => {
  describe("create", () => {
    it("creates and bumps the usage counter when under the plan limit", async () => {
      const { service, presentationsRepo, usageRepo } = makeService();
      presentationsRepo.countByOrg.mockResolvedValue(2);
      presentationsRepo.create.mockResolvedValue(fakePresentation());

      await service.create(ORG, "free", USER, { title: "Kickoff" });

      expect(presentationsRepo.create).toHaveBeenCalledWith({
        orgId: ORG,
        title: "Kickoff",
        createdBy: USER,
      });
      expect(usageRepo.increment).toHaveBeenCalledWith(ORG, expect.any(String));
    });

    it("rejects with PlanLimitError at the free-tier cap", async () => {
      const { service, presentationsRepo, usageRepo } = makeService();
      presentationsRepo.countByOrg.mockResolvedValue(3); // free cap

      await expect(
        service.create(ORG, "free", USER, { title: "One too many" }),
      ).rejects.toBeInstanceOf(PlanLimitError);
      expect(presentationsRepo.create).not.toHaveBeenCalled();
      expect(usageRepo.increment).not.toHaveBeenCalled();
    });

    it("allows more presentations on pro", async () => {
      const { service, presentationsRepo } = makeService();
      presentationsRepo.countByOrg.mockResolvedValue(10);
      presentationsRepo.create.mockResolvedValue(fakePresentation());

      await expect(
        service.create(ORG, "pro", USER, { title: "Eleventh" }),
      ).resolves.toBeTruthy();
    });
  });

  it("get throws NotFoundError for missing presentations", async () => {
    const { service, presentationsRepo } = makeService();
    presentationsRepo.getById.mockResolvedValue(null);

    await expect(service.get(ORG, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("update throws NotFoundError when the repo misses", async () => {
    const { service, presentationsRepo } = makeService();
    presentationsRepo.update.mockResolvedValue(null);

    await expect(
      service.update(ORG, "nope", { title: "X" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("delete throws NotFoundError when nothing was deleted", async () => {
    const { service, presentationsRepo } = makeService();
    presentationsRepo.delete.mockResolvedValue(false);

    await expect(service.delete(ORG, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
