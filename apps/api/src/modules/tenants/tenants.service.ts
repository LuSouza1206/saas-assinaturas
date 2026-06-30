import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

export class TenantsService {
  async getById(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new AppError(404, "Tenant not found");
    return tenant;
  }

  async updateName(tenantId: string, name: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { name },
    });
  }
}

export const tenantsService = new TenantsService();
