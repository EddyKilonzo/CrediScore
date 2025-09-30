import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register({
      ttl: 3600, // 1 hour default
      max: 1000, // Maximum number of items in cache
    }),
    CircuitBreakerModule,
    MetricsModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
