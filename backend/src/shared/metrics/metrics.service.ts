import { Injectable, Logger } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // AI Service Metrics
  private readonly aiRequestsTotal = new Counter({
    name: 'ai_requests_total',
    help: 'Total number of AI service requests',
    labelNames: ['service', 'operation', 'status'],
  });

  private readonly aiRequestDuration = new Histogram({
    name: 'ai_request_duration_seconds',
    help: 'Duration of AI service requests in seconds',
    labelNames: ['service', 'operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  });

  private readonly aiCacheHits = new Counter({
    name: 'ai_cache_hits_total',
    help: 'Total number of AI cache hits',
    labelNames: ['operation'],
  });

  private readonly aiCacheMisses = new Counter({
    name: 'ai_cache_misses_total',
    help: 'Total number of AI cache misses',
    labelNames: ['operation'],
  });

  // Circuit Breaker Metrics
  private readonly circuitBreakerState = new Gauge({
    name: 'circuit_breaker_state',
    help: 'Current state of circuit breakers',
    labelNames: ['circuit_name'],
  });

  private readonly circuitBreakerFailures = new Counter({
    name: 'circuit_breaker_failures_total',
    help: 'Total number of circuit breaker failures',
    labelNames: ['circuit_name'],
  });

  // Rate Limiting Metrics
  private readonly rateLimitHits = new Counter({
    name: 'rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['endpoint', 'user_id'],
  });

  // Document Processing Metrics
  private readonly documentsProcessed = new Counter({
    name: 'documents_processed_total',
    help: 'Total number of documents processed',
    labelNames: ['type', 'status'],
  });

  private readonly documentProcessingDuration = new Histogram({
    name: 'document_processing_duration_seconds',
    help: 'Duration of document processing in seconds',
    labelNames: ['type'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
  });

  // Batch Processing Metrics
  private readonly batchProcessingSize = new Histogram({
    name: 'batch_processing_size',
    help: 'Size of batch processing operations',
    labelNames: ['operation'],
    buckets: [1, 5, 10, 20, 50, 100],
  });

  constructor() {
    // Register all metrics
    register.registerMetric(this.aiRequestsTotal);
    register.registerMetric(this.aiRequestDuration);
    register.registerMetric(this.aiCacheHits);
    register.registerMetric(this.aiCacheMisses);
    register.registerMetric(this.circuitBreakerState);
    register.registerMetric(this.circuitBreakerFailures);
    register.registerMetric(this.rateLimitHits);
    register.registerMetric(this.documentsProcessed);
    register.registerMetric(this.documentProcessingDuration);
    register.registerMetric(this.batchProcessingSize);
  }

  // AI Service Metrics
  recordAiRequest(
    service: string,
    operation: string,
    status: 'success' | 'error',
    duration: number,
  ) {
    this.aiRequestsTotal.inc({ service, operation, status });
    this.aiRequestDuration.observe({ service, operation }, duration);
  }

  recordAiCacheHit(operation: string) {
    this.aiCacheHits.inc({ operation });
  }

  recordAiCacheMiss(operation: string) {
    this.aiCacheMisses.inc({ operation });
  }

  // Circuit Breaker Metrics
  updateCircuitBreakerState(circuitName: string, state: number) {
    this.circuitBreakerState.set({ circuit_name: circuitName }, state);
  }

  recordCircuitBreakerFailure(circuitName: string) {
    this.circuitBreakerFailures.inc({ circuit_name: circuitName });
  }

  // Rate Limiting Metrics
  recordRateLimitHit(endpoint: string, userId: string) {
    this.rateLimitHits.inc({ endpoint, user_id: userId });
  }

  // Document Processing Metrics
  recordDocumentProcessed(type: string, status: 'success' | 'error') {
    this.documentsProcessed.inc({ type, status });
  }

  recordDocumentProcessingDuration(type: string, duration: number) {
    this.documentProcessingDuration.observe({ type }, duration);
  }

  // Batch Processing Metrics
  recordBatchProcessingSize(operation: string, size: number) {
    this.batchProcessingSize.observe({ operation }, size);
  }

  // Get all metrics as string
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Get metrics in JSON format
  async getMetricsAsJson(): Promise<any> {
    return register.getMetricsAsJSON();
  }

  // Clear all metrics
  clearMetrics(): void {
    register.clear();
    this.logger.log('All metrics cleared');
  }
}
