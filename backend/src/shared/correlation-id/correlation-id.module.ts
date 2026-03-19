import { Global, Module } from '@nestjs/common';
import { CorrelationIdService } from './correlation-id.service';

@Global()
@Module({
  providers: [CorrelationIdService],
  exports: [CorrelationIdService],
})
export class CorrelationIdModule {}
