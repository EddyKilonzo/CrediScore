import { NotFoundException } from '@nestjs/common';
import { UserService } from '../src/user/user.service';
import { TrackConversionEventDto } from '../src/user/dto/user.dto';

describe('Conversion events E2E (service flow)', () => {
  const createHarness = () => {
    const prisma = {
      business: {
        findUnique: jest.fn(),
      },
    } as any;

    const notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
    } as any;

    const userService = new UserService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      notificationsService,
      {
        normalizeCode: (c: string) => c,
        validateCodeFormat: () => true,
        queryTransactionStatus: jest.fn(),
      } as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    return { userService, prisma, notificationsService };
  };

  it('tracks a conversion event and notifies business owner', async () => {
    const { userService, prisma, notificationsService } = createHarness();
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz-1',
      ownerId: 'owner-1',
      name: 'Acme Dental',
    });

    const body: TrackConversionEventDto = {
      businessId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      eventType: 'CLICK_CALL',
      metadata: { source: 'business-page' },
    };

    await expect(
      userService.trackConversionEvent('user-1', body),
    ).resolves.toEqual({ tracked: true });

    expect(notificationsService.create).toHaveBeenCalledWith(
      'owner-1',
      'REVIEW_VOTE',
      'New conversion signal',
      expect.stringContaining('CLICK_CALL'),
      'biz-1',
    );
  });

  it('tracks event without notifying when actor is business owner', async () => {
    const { userService, prisma, notificationsService } = createHarness();
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz-2',
      ownerId: 'owner-2',
      name: 'Owner Cafe',
    });

    const body: TrackConversionEventDto = {
      businessId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
      eventType: 'VIEW',
    };

    await expect(
      userService.trackConversionEvent('owner-2', body),
    ).resolves.toEqual({ tracked: true });
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('throws not found when business does not exist', async () => {
    const { userService, prisma, notificationsService } = createHarness();
    prisma.business.findUnique.mockResolvedValue(null);

    const body: TrackConversionEventDto = {
      businessId: '3fa85f64-5717-4562-b3fc-2c963f66afa8',
      eventType: 'BOOKING_REQUEST',
    };

    await expect(userService.trackConversionEvent('user-3', body)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});
