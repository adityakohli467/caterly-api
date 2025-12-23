import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface PinChargeRequest {
  amount: number; // Amount in cents
  currency: string; // e.g., 'AUD'
  description: string;
  email: string;
  ip_address: string;
  card_token?: string; // Token from Pin.js
  card?: {
    number: string;
    expiry_month: number;
    expiry_year: number;
    cvc: string;
    name: string;
    address_line1?: string;
    address_line2?: string;
    address_city?: string;
    address_postcode?: string;
    address_state?: string;
    address_country?: string;
  };
}

export interface PinChargeResponse {
  response: {
    token: string;
    success: boolean;
    amount: number;
    currency: string;
    description: string;
    email: string;
    ip_address: string;
    created_at: string;
    status_message: string;
    error_message?: string;
    card?: {
      token: string;
      scheme: string;
      display_number: string;
      issuing_country: string;
      issuing_bank: string;
      name: string;
      address_line1: string;
      address_city: string;
      address_postcode: string;
      address_state: string;
      address_country: string;
    };
  };
}

@Injectable()
export class PinPaymentsService {
  private readonly logger = new Logger(PinPaymentsService.name);
  private readonly apiClient: AxiosInstance;
  private readonly secretKey: string;
  private readonly publishableKey: string;
  private readonly isTestMode: boolean;

  constructor(private configService: ConfigService) {
    // Get API keys from environment variables
    this.secretKey = this.configService.get<string>('PINPAYMENTS_SECRET_KEY') || '';
    this.publishableKey = this.configService.get<string>('PINPAYMENTS_PUBLISHABLE_KEY') || '';
    this.isTestMode = this.configService.get<string>('NODE_ENV') !== 'production';

    if (!this.secretKey) {
      this.logger.warn('PINPAYMENTS_SECRET_KEY not configured');
    }

    // Create axios instance for Pin Payments API
    // Pin Payments uses Basic Auth with secret key as username and empty password
    this.apiClient = axios.create({
      baseURL: this.isTestMode
        ? 'https://test-api.pinpayments.com/1'
        : 'https://api.pinpayments.com/1',
      auth: {
        username: this.secretKey,
        password: '',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a charge using Pin Payments
   */
  async createCharge(chargeData: PinChargeRequest): Promise<PinChargeResponse> {
    try {
      this.logger.log(`Creating charge: ${chargeData.description} - $${chargeData.amount / 100} ${chargeData.currency}`);

      const requestBody: any = {
        amount: chargeData.amount,
        currency: chargeData.currency,
        description: chargeData.description,
        email: chargeData.email,
        ip_address: chargeData.ip_address,
      };

      if (chargeData.card_token) {
        requestBody.card_token = chargeData.card_token;
      } else if (chargeData.card) {
        requestBody.card = chargeData.card;
      }

      const response = await this.apiClient.post<PinChargeResponse>('/charges', requestBody);

      if (response.data.response.success) {
        this.logger.log(`Charge created successfully: ${response.data.response.token}`);
      } else {
        const errorMsg = response.data.response.error_message || response.data.response.status_message || 'Unknown error';
        this.logger.error(`Charge failed: ${errorMsg}`);
        // Throw error so calling code can handle it
        const error: any = new Error(errorMsg);
        error.response = { data: response.data };
        throw error;
      }

      return response.data;
    } catch (error: any) {
      this.logger.error('Pin Payments API error:', error.response?.data || error.message);
      // Re-throw with better error message
      if (error.response?.data?.error_description) {
        const pinError: any = new Error(error.response.data.error_description);
        pinError.response = error.response;
        throw pinError;
      }
      throw error;
    }
  }

  /**
   * Get charge details by token
   */
  async getCharge(token: string): Promise<PinChargeResponse> {
    try {
      const response = await this.apiClient.get<PinChargeResponse>(`/charges/${token}`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Pin Payments get charge error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Refund a charge
   */
  async refundCharge(chargeToken: string, amount?: number): Promise<any> {
    try {
      const refundData: any = {};
      if (amount) {
        refundData.amount = amount;
      }

      const response = await this.apiClient.post(`/charges/${chargeToken}/refunds`, refundData);
      return response.data;
    } catch (error: any) {
      this.logger.error('Pin Payments refund error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get publishable key (for frontend)
   */
  getPublishableKey(): string {
    return this.publishableKey;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.secretKey && !!this.publishableKey;
  }
}

