import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class FatZebraService {
  private readonly logger = new Logger(FatZebraService.name);
  private readonly username: string;
  private readonly sharedSecret: string;
  private readonly environment: 'sandbox' | 'live';

  constructor(private readonly configService: ConfigService) {
    this.username = this.configService.get<string>('FATZEBRA_USERNAME') || '';
    this.sharedSecret = this.configService.get<string>('FATZEBRA_SHARED_SECRET') || '';
    const env =
      (this.configService.get<string>('FATZEBRA_ENV') || '').toLowerCase() ||
      (this.configService.get<string>('NODE_ENV') === 'production' ? 'live' : 'sandbox');
    this.environment = env === 'live' ? 'live' : 'sandbox';
    if (!this.username || !this.sharedSecret) {
      this.logger.warn('FatZebra PayNow credentials are not fully configured');
    }
  }

  isConfigured(): boolean {
    return !!this.username && !!this.sharedSecret;
  }

  private getBaseUrl(): string {
    return this.environment === 'live'
      ? 'https://paynow.pmnts.io/v2'
      : 'https://paynow.pmnts-sandbox.io/v2';
  }

  private hmacMd5(value: string): string {
    return crypto.createHmac('md5', this.sharedSecret).update(value).digest('hex');
  }

  private formatAmountFromCents(amountCents: number): string {
    const dollars = (amountCents / 100).toFixed(2);
    return dollars;
  }

  buildPayNowUrl(params: {
    reference: string;
    amountCents: number;
    currency?: string;
    returnPath?: string;
    iframe?: boolean;
    email?: string;
  }): string {
    const currency = params.currency || 'AUD';
    const amountStr = this.formatAmountFromCents(params.amountCents);
    let verificationString = `${params.reference}:${amountStr}:${currency}`;
    if (params.returnPath) {
      verificationString = `${verificationString}:${params.returnPath}`;
    }
    this.logger.log(`FatZebra verification string (no secret): ${verificationString}`);
    const hash = this.hmacMd5(verificationString);
    this.logger.log(`FatZebra generated hash length=${hash.length}`);

    const base = `${this.getBaseUrl()}/${encodeURIComponent(this.username)}/${encodeURIComponent(
      params.reference,
    )}/${encodeURIComponent(currency)}/${encodeURIComponent(amountStr)}/${hash}`;

    const qs: string[] = [];
    if (params.returnPath) {
      qs.push(`return_path=${encodeURIComponent(params.returnPath)}`);
    }
    if (typeof params.iframe === 'boolean') {
      qs.push(`iframe=${params.iframe ? 'true' : 'false'}`);
    }
    if (params.email) {
      qs.push(`email=${encodeURIComponent(params.email)}`);
    }

    return qs.length ? `${base}?${qs.join('&')}` : base;
  }

  /**
   * Verify FatZebra PayNow callback signature
   * PayNow uses GET callbacks with query parameters and a 'v' verification hash
   * The hash is HMAC-MD5 of: r:successful:amount:currency:id:token
   */
  verifyCallback(query: {
    r?: string;
    successful?: string;
    amount?: string;
    currency?: string;
    id?: string;
    token?: string;
    v?: string;
  }): boolean {
    // If no verification hash provided, reject
    if (!query || !query.v) {
      this.logger.warn('FatZebra callback missing verification hash (v parameter)');
      return false;
    }

    // Build verification string from query parameters
    // Order matters: r:successful:amount:currency:id:token
    const parts = [
      query.r || '',
      query.successful || '',
      query.amount || '',
      query.currency || '',
      query.id || '',
      query.token || '',
    ].join(':');

    this.logger.log(`FatZebra verify string: ${parts}`);

    // Generate expected hash using HMAC-MD5 with shared secret
    const expected = this.hmacMd5(parts);
    const actual = query.v;
    const ok = expected === actual;

    this.logger.log(`FatZebra signature verification: ${ok ? '✅ VALID' : '❌ INVALID'}`);
    this.logger.log(`Expected: ${expected}`);
    this.logger.log(`Actual:   ${actual}`);

    if (!ok) {
      this.logger.error('FatZebra signature verification FAILED!');
      this.logger.error('This could mean:');
      this.logger.error('1. FATZEBRA_SHARED_SECRET in .env does not match FatZebra dashboard');
      this.logger.error('2. Query parameters were modified in transit');
      this.logger.error('3. Using wrong environment (sandbox vs live)');
    }

    return ok;
  }
}
