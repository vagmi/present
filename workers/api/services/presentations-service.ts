import { currentPeriod, getPlan } from "~/lib/plans";
import type {
  Presentation,
  PresentationsRepo,
} from "../repositories/presentations-repo";
import type { UsageRepo } from "../repositories/usage-repo";
import { NotFoundError, PlanLimitError } from "./errors";

// Services hold the business rules: plan gating, usage metering, "not found"
// semantics. They depend on repositories (never on Drizzle directly) and are
// unit-tested with mocked repos. Copy this file when you add your own resource.

export interface PresentationsServiceDeps {
  presentationsRepo: PresentationsRepo;
  usageRepo: UsageRepo;
}

export function createPresentationsService({
  presentationsRepo,
  usageRepo,
}: PresentationsServiceDeps) {
  async function get(orgId: string, id: string): Promise<Presentation> {
    const presentation = await presentationsRepo.getById(orgId, id);
    if (!presentation)
      throw new NotFoundError(`presentation ${id} not found`);
    return presentation;
  }

  return {
    list(orgId: string): Promise<Presentation[]> {
      return presentationsRepo.listByOrg(orgId);
    },

    get,

    /** Gated on the org's plan: each tier caps the number of presentations.
     * Also bumps the monthly usage counter so the billing meter is live. */
    async create(
      orgId: string,
      plan: string,
      createdBy: string,
      input: { title: string },
    ): Promise<Presentation> {
      const limits = getPlan(plan);
      const count = await presentationsRepo.countByOrg(orgId);
      if (count >= limits.maxPresentations) {
        throw new PlanLimitError(
          `the ${plan} plan allows ${limits.maxPresentations} presentations — upgrade to add more`,
        );
      }
      const presentation = await presentationsRepo.create({
        orgId,
        title: input.title,
        createdBy,
      });
      await usageRepo.increment(orgId, currentPeriod());
      return presentation;
    },

    async update(
      orgId: string,
      id: string,
      patch: { title?: string },
    ): Promise<Presentation> {
      const updated = await presentationsRepo.update(orgId, id, patch);
      if (!updated) throw new NotFoundError(`presentation ${id} not found`);
      return updated;
    },

    async delete(orgId: string, id: string): Promise<void> {
      const deleted = await presentationsRepo.delete(orgId, id);
      if (!deleted) throw new NotFoundError(`presentation ${id} not found`);
    },
  };
}

export type PresentationsService = ReturnType<
  typeof createPresentationsService
>;
