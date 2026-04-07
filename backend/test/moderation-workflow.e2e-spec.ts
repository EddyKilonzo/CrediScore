import { BadRequestException } from '@nestjs/common';
import { AdminService } from '../src/admin/admin.service';
import { UserService } from '../src/user/user.service';

describe('Moderation workflow E2E (service flow)', () => {
  const createHarness = () => {
    const reports: any[] = [];
    const users = new Map<string, any>([
      ['reporter-1', { id: 'reporter-1', reputation: 50 }],
    ]);

    const prisma = {
      user: {
        findUnique: jest.fn(async ({ where: { id } }) => users.get(id) || null),
        update: jest.fn(async ({ where: { id }, data }) => {
          const current = users.get(id);
          const next = { ...current, ...data };
          users.set(id, next);
          return next;
        }),
      },
      business: {
        findUnique: jest.fn(async ({ where: { id } }) =>
          id === 'biz-1' ? { id: 'biz-1', name: 'Biz One', isVerified: false } : null,
        ),
      },
      fraudReport: {
        findFirst: jest.fn(async ({ where }) => {
          return (
            reports.find((r) => {
              const statusOk = where.status?.in
                ? where.status.in.includes(r.status)
                : true;
              return (
                (where.reporterId ? r.reporterId === where.reporterId : true) &&
                (where.businessId ? r.businessId === where.businessId : true) &&
                (where.dedupeKey ? r.dedupeKey === where.dedupeKey : true) &&
                statusOk
              );
            }) || null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const report = {
            id: `rep-${reports.length + 1}`,
            status: 'PENDING',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          reports.push(report);
          return { ...report, reporter: { id: data.reporterId }, business: { id: data.businessId, name: 'Biz One', isVerified: false } };
        }),
        findUnique: jest.fn(async ({ where: { id } }) => reports.find((r) => r.id === id) || null),
        update: jest.fn(async ({ where: { id }, data }) => {
          const idx = reports.findIndex((r) => r.id === id);
          reports[idx] = { ...reports[idx], ...data, updatedAt: new Date() };
          return reports[idx];
        }),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    } as any;

    const notificationsService = { create: jest.fn().mockResolvedValue(undefined) } as any;
    const adminService = new AdminService(
      prisma,
      {} as any,
      {} as any,
      { calculateTrustScore: jest.fn().mockResolvedValue(undefined) } as any,
      notificationsService,
    );
    const userService = new UserService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      notificationsService,
      { normalizeCode: (c: string) => c, validateCodeFormat: () => true, queryTransactionStatus: jest.fn() } as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    return { userService, adminService, notificationsService };
  };

  it('create report -> queue/update -> notification', async () => {
    const { userService, adminService, notificationsService } = createHarness();
    const report = await userService.createFraudReport('reporter-1', {
      businessId: 'biz-1',
      reason: 'Fake offers',
      description: 'Evidence attached',
      evidenceLinks: ['https://example.com/evidence.png'],
    });

    await adminService.updateFraudReportStatus(
      report.id,
      'UNDER_REVIEW',
      'triaged',
      'admin-1',
      24,
      'Assigned and triaged',
    );

    expect(notificationsService.create).toHaveBeenCalled();
  });

  it('dedupes same active report payload', async () => {
    const { userService } = createHarness();
    await userService.createFraudReport('reporter-1', {
      businessId: 'biz-1',
      reason: 'Impersonation',
      description: 'same payload',
    });

    await expect(
      userService.createFraudReport('reporter-1', {
        businessId: 'biz-1',
        reason: 'Impersonation',
        description: 'same payload',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
