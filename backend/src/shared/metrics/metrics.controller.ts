import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text format',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Get('json')
  @ApiOperation({ summary: 'Get metrics in JSON format' })
  @ApiResponse({
    status: 200,
    description: 'Metrics in JSON format',
  })
  async getMetricsAsJson(): Promise<any> {
    return this.metricsService.getMetricsAsJson();
  }
}
