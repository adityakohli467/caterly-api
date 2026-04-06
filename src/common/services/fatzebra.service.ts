import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FatZebraPurchaseRequest {
    amount: number; // Amount in cents
    reference: string;
    customer_ip: string;
    card_holder: string;
    card_number: string;
    card_expiry: string;
    cvv: string;
}

export interface FatZebraTokenPurchaseRequest {
    amount: number;
    reference: string;
    customer_ip: string;
    token: string;
    cvv?: string;
}

export interface FatZebraResponse {
    successful: boolean;
    id: string;
    message: string;
    reference: string;
    response_code: string;
    authorization?: string;
    transaction_id?: string;
    errors?: string[];
}

@Injectable()
export class FatZebraService {
    private readonly logger = new Logger(FatZebraService.name);
    private readonly apiClient: AxiosInstance;
    private readonly username: string;
    private readonly secret: string;
    private readonly sharedSecret: string;
    private readonly isTestMode: boolean;

    constructor(private configService: ConfigService) {
        this.username = this.configService.get<string>('FATZEBRA_USERNAME') || '';
        this.secret = this.configService.get<string>('FATZEBRA_SECRET') || '';
        this.sharedSecret = this.configService.get<string>('FATZEBRA_SHARED_SECRET') || '';
        this.isTestMode = this.configService.get<string>('NODE_ENV') !== 'production';

        const baseURL = this.isTestMode
            ? 'https://gateway.sandbox.fatzebra.com.au/v1.0'    
            : 'https://gateway.fatzebra.com.au/v1.0';

        this.apiClient = axios.create({
            baseURL,
            auth: {
                username: this.username,
                password: this.secret,
            },
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!this.username || !this.secret) {
            this.logger.warn('Fat Zebra credentials not fully configured');
        }
    }

    /**
     * Create a purchase using credit card details
     */
    async createPurchase(data: FatZebraPurchaseRequest): Promise<FatZebraResponse> {
        try {
            this.logger.log(`Creating Fat Zebra purchase for reference: ${data.reference}`);

            const payload = {
                amount: data.amount,
                reference: data.reference,
                customer_ip: data.customer_ip,
                card_holder: data.card_holder,
                card_number: data.card_number,
                card_expiry: data.card_expiry,
                cvv: data.cvv,
            };

            const response = await this.apiClient.post('/purchases', payload);
            return response.data;
        } catch (error: any) {
            this.logger.error('Fat Zebra purchase error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create a purchase using a token
     */
    async createTokenPurchase(data: FatZebraTokenPurchaseRequest): Promise<FatZebraResponse> {
        try {
            this.logger.log(`Creating Fat Zebra token purchase for reference: ${data.reference}`);

            const payload = {
                amount: data.amount,
                reference: data.reference,
                customer_ip: data.customer_ip,
                token: data.token,
                cvv: data.cvv,
            };

            const response = await this.apiClient.post('/purchases', payload);
            return response.data;
        } catch (error: any) {
            this.logger.error('Fat Zebra token purchase error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Check if service is configured
     */
    isConfigured(): boolean {
        return !!this.username && !!this.secret;
    }
}
