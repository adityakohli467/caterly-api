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
    const hash = this.hmacMd5(verificationString);

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

  verifyCallback(query: {
    r?: string;
    successful?: string;
    amount?: string;
    currency?: string;
    id?: string;
    token?: string;
    v?: string;
  }): boolean {
    if (!query || !query.v) {
      return false;
    }
    const parts = [
      query.r || '',
      query.successful || '',
      query.amount || '',
      query.currency || '',
      query.id || '',
      query.token || '',
    ].join(':');
    const expected = this.hmacMd5(parts);
    return expected === query.v;
  }
}
