import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  validateCodeFormat(code: string): boolean {
    return /^[A-Z0-9]{10}$/i.test(code);
  }

  normalizeCode(code: string): string {
    return code.toUpperCase().trim();
  }

  isDarajaConfigured(): boolean {
    return !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET);
  }

  async queryTransactionStatus(code: string): Promise<{ verified: boolean; amount?: number }> {
    if (!this.isDarajaConfigured()) {
      this.logger.warn(`Daraja API not configured; skipping status query for code ${code}`);
      return { verified: false };
    }
    // TODO: Add Daraja API integration here when credentials are configured
    // POST /oauth/v1/generate?grant_type=client_credentials to get token
    // POST /mpesa/transactionstatus/v1/query to check status
    return { verified: false };
  }

  handleCallback(body: any): void {
    this.logger.log('M-Pesa callback received', JSON.stringify(body));
  }
}
