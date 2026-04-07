import { ConfigService } from '@nestjs/config';
import { FraudDetectionService } from './fraud-detection.service';

describe('FraudDetectionService', () => {
  const makeService = (reviews: any[] = []) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          flagCount: 0,
        }),
      },
      review: {
        findMany: jest.fn().mockResolvedValue(reviews),
      },
    } as any;
    const config = { get: jest.fn().mockReturnValue('http://localhost:8000') } as unknown as ConfigService;
    return new FraudDetectionService(config, prisma);
  };

  it('keeps low-risk human review below fraud threshold (false-positive fixture)', async () => {
    const service = makeService();
    const result = await service.detectFraudNative(
      'The food was fresh and service was quick. I paid via card and got my receipt.',
      60,
      { confidence: 0.95, businessName: 'Cafe One', amount: 1200 },
      { name: 'Cafe One' },
    );
    expect(result.isFraudulent).toBe(false);
    expect(result.riskScore).toBeLessThan(50);
  });

  it('flags spammy template text as fraudulent (false-negative fixture)', async () => {
    const service = makeService();
    const result = await service.detectFraudNative(
      'BUY NOW click here 100% guarantee!!! http://spam.test',
      -5,
      { confidence: 0.2, businessName: 'Fake Shop', amount: 9999999 },
      { name: 'Real Shop' },
    );
    expect(result.isFraudulent).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(50);
  });

  it('detects velocity + similarity + device/ip clusters', async () => {
    const now = Date.now();
    const reviews = Array.from({ length: 4 }).map((_, i) => ({
      businessId: `b-${i}`,
      createdAt: new Date(now - i * 60 * 1000),
      isVerified: false,
      rating: 5,
      comment: 'Great service highly recommend',
      validationResult: {
        ipAddress: '1.2.3.4',
        deviceFingerprint: 'device-abc',
      },
    }));
    const service = makeService(reviews);
    const analysis = await service.analyzeUserReviewPatterns('user-1');
    expect(analysis.suspiciousPatterns.join(' ')).toContain('device-fingerprint');
    expect(analysis.suspiciousPatterns.join(' ')).toContain('IP clusters');
    expect(analysis.riskScore).toBeGreaterThan(0);
  });
});
