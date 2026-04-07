import { BusinessService } from './business.service';

describe('BusinessService trust transparency', () => {
  const makeService = () => {
    const tx = {
      trustScore: {
        upsert: jest.fn().mockResolvedValue({
          id: 'ts-1',
          businessId: 'biz-1',
          score: 74,
          grade: 'B',
        }),
      },
      trustScoreHistory: {
        create: jest.fn().mockResolvedValue({ id: 'hist-1' }),
      },
    };

    const prisma: any = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'biz-1',
          isVerified: true,
          reviews: [
            { rating: 5, isVerified: true, credibility: 90 },
            { rating: 4, isVerified: false, credibility: 55 },
          ],
          documents: [{ id: 'd1' }, { id: 'd2' }],
          payments: [{ id: 'p1' }],
          fraudReports: [{ status: 'UPHELD' }],
        }),
      },
      trustScore: {
        findUnique: jest.fn().mockResolvedValue({ score: 70 }),
      },
      trustScoreHistory: {
        findMany: jest.fn().mockResolvedValue([{ score: 68 }, { score: 70 }]),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const service = new BusinessService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, prisma, tx };
  };

  it('matches explanation payload snapshot', async () => {
    const { service, tx } = makeService();
    await service.calculateTrustScore('biz-1', {
      eventType: 'REVIEW_APPROVED',
      reason: 'A pending review was approved.',
    });

    const updatePayload = tx.trustScore.upsert.mock.calls[0][0];
    expect(updatePayload.update.factors.explanation).toMatchSnapshot();
  });

  it('always writes a trust score history row on update', async () => {
    const { service, tx } = makeService();
    await service.calculateTrustScore('biz-1', {
      eventType: 'DOCS_VERIFIED_MANUAL',
      reason: 'A document was manually verified.',
    });

    expect(tx.trustScoreHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.trustScoreHistory.create.mock.calls[0][0].data).toMatchObject({
      businessId: 'biz-1',
      eventType: 'DOCS_VERIFIED_MANUAL',
      reason: 'A document was manually verified.',
    });
  });
});
