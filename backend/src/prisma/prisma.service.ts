import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Use WebSocket transport so connections go over port 443 (not blocked TCP 5432)
neonConfig.webSocketConstructor = ws;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter } as any);
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 3000;

  private static buildArgs(): any {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return {};
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    return { adapter };
  }

  constructor() {
    super(PrismaService.buildArgs());
  }

  async onModuleInit(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to PostgreSQL database via Neon WebSocket adapter');
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Database connection attempt ${attempt}/${this.MAX_RETRIES} failed — ` +
          (attempt < this.MAX_RETRIES
            ? `retrying in ${this.RETRY_DELAY_MS / 1000}s… (Neon may be waking from suspend)`
            : 'giving up'),
        );
        if (attempt < this.MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY_MS));
        }
      }
    }

    // Log but don't crash — first request will trigger a lazy reconnect via Prisma's pool
    this.logger.error(
      'Could not establish an initial database connection after retries. ' +
      'Requests will fail until the database is reachable.',
      lastError,
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error('Error occurred while disconnecting from database', error);
    }
  }
}
