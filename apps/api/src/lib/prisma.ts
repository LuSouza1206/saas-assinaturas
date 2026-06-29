import { PrismaClient, Prisma } from "@prisma/client";

export const prisma = new PrismaClient();

export function scopedPrisma(tenantId: string) {
  return {
    tenantId,

    plan: {
      findMany: (args: Prisma.PlanFindManyArgs = {}) =>
        prisma.plan.findMany({
          ...args,
          where: { ...args.where, tenantId },
        }),
      findFirst: (args: Prisma.PlanFindFirstArgs = {}) =>
        prisma.plan.findFirst({
          ...args,
          where: { ...args.where, tenantId },
        }),
      findUnique: async (args: Prisma.PlanFindUniqueArgs) => {
        const row = await prisma.plan.findUnique(args);
        if (!row || row.tenantId !== tenantId) return null;
        return row;
      },
      create: (args: {
        data: Omit<Prisma.PlanUncheckedCreateInput, "tenantId">;
        include?: Prisma.PlanInclude;
      }) =>
        prisma.plan.create({
          ...args,
          data: { ...args.data, tenantId },
        }),
      update: async (args: Prisma.PlanUpdateArgs) => {
        const existing = await prisma.plan.findFirst({
          where: { id: String(args.where.id), tenantId },
        });
        if (!existing) return null;
        return prisma.plan.update(args);
      },
      delete: async (args: Prisma.PlanDeleteArgs) => {
        const existing = await prisma.plan.findFirst({
          where: { id: String(args.where.id), tenantId },
        });
        if (!existing) return null;
        return prisma.plan.delete(args);
      },
    },

    subscription: {
      findMany: (args: Prisma.SubscriptionFindManyArgs = {}) =>
        prisma.subscription.findMany({
          ...args,
          where: { ...args.where, tenantId },
        }),
      findFirst: (args: Prisma.SubscriptionFindFirstArgs = {}) =>
        prisma.subscription.findFirst({
          ...args,
          where: { ...args.where, tenantId },
        }),
      findUnique: async (args: Prisma.SubscriptionFindUniqueArgs) => {
        const row = await prisma.subscription.findUnique(args);
        if (!row || row.tenantId !== tenantId) return null;
        return row;
      },
      create: (args: {
        data: Omit<Prisma.SubscriptionUncheckedCreateInput, "tenantId">;
        include?: Prisma.SubscriptionInclude;
      }) =>
        prisma.subscription.create({
          ...args,
          data: { ...args.data, tenantId },
        }),
      update: async (args: Prisma.SubscriptionUpdateArgs) => {
        const existing = await prisma.subscription.findFirst({
          where: { id: String(args.where.id), tenantId },
        });
        if (!existing) return null;
        return prisma.subscription.update(args);
      },
    },

    user: {
      findMany: (args: Prisma.UserFindManyArgs = {}) =>
        prisma.user.findMany({
          ...args,
          where: { ...args.where, tenantId },
        }),
      findFirst: (args: Prisma.UserFindFirstArgs = {}) =>
        prisma.user.findFirst({
          ...args,
          where: { ...args.where, tenantId },
        }),
      findUnique: async (args: Prisma.UserFindUniqueArgs) => {
        const row = await prisma.user.findUnique(args);
        if (!row || row.tenantId !== tenantId) return null;
        return row;
      },
      create: (args: {
        data: Omit<Prisma.UserUncheckedCreateInput, "tenantId">;
      }) =>
        prisma.user.create({
          data: { ...args.data, tenantId },
        }),
    },

    invoice: {
      findMany: (args: Prisma.InvoiceFindManyArgs = {}) =>
        prisma.invoice.findMany({
          ...args,
          where: { ...args.where, tenantId },
        }),
      create: (args: {
        data: Omit<Prisma.InvoiceUncheckedCreateInput, "tenantId">;
      }) =>
        prisma.invoice.create({
          data: { ...args.data, tenantId },
        }),
    },
  };
}
