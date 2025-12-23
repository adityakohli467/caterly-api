import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StoreLocationsService {
  private readonly logger = new Logger(StoreLocationsService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get available locations and check postcode
   */
  async getLocations(postcode?: string) {
    const query = `
      SELECT 
        location_id,
        location_name,
        post_codes,
        location_status,
        date_created
      FROM locations
      WHERE location_status = 1
    `;

    const result = await this.dataSource.query(query);
    const locations = result;

    // If postcode is provided, check which locations serve it
    if (postcode) {
      const availableLocations = locations.filter((location: any) => {
        if (!location.post_codes) return false;
        const postcodes = location.post_codes.split(',').map((pc: string) => pc.trim());
        return postcodes.includes(postcode.toString());
      });

      return {
        available: availableLocations.length > 0,
        locations: availableLocations,
        postcode,
      };
    }

    return { locations };
  }

  /**
   * Check if postcode is serviceable
   */
  async checkPostcode(postcode: string) {
    if (!postcode) {
      throw new BadRequestException('Postcode is required');
    }

    const query = `
      SELECT 
        location_id,
        location_name,
        post_codes
      FROM locations
      WHERE location_status = 1
    `;

    const result = await this.dataSource.query(query);

    const availableLocation = result.find((location: any) => {
      if (!location.post_codes) return false;
      const postcodes = location.post_codes.split(',').map((pc: string) => pc.trim());
      return postcodes.includes(postcode);
    });

    return {
      serviceable: !!availableLocation,
      location: availableLocation || null,
      postcode,
    };
  }
}
