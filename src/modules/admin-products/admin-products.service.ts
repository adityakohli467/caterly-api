import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { S3Service } from '../../common/services/s3.service';
import { PricingService } from '../../common/services/pricing.service';

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(
    private dataSource: DataSource,
    private s3Service: S3Service,
    private pricingService: PricingService,
  ) { }

  /**
   * List products with search and pagination
   * @param filters - Filter options including optional customer_id for price calculation
   */
  async listProducts(filters: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: number;
    customer_id?: number; // Optional: if provided, prices will be calculated based on customer type and discounts
  }) {
    const { limit = 20, offset = 0, search, status } = filters;

    let query = `
      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object('category_id', c.category_id, 'category_name', c.category_name) ORDER BY c.sort_order ASC, c.category_name ASC)
          FROM product_category pc
          JOIN category c ON pc.category_id = c.category_id
          WHERE pc.product_id = p.product_id
        ) as categories,
        (
          SELECT json_agg(
            json_build_object(
              'product_option_id', po.product_option_id,
              'option_id', o.option_id,
              'option_name', o.name,
              'option_type', o.option_type,
              'option_value_id', ov.option_value_id,
              'option_value_name', ov.name,
              'option_price', po.option_price,
              'option_price_prefix', po.option_price_prefix,
              'option_required', po.option_required,
              'standard_price', ov.standard_price,
              'wholesale_price', ov.wholesale_price
            )
          )
          FROM product_option po
          JOIN option_value ov ON po.option_value_id = ov.option_value_id
          JOIN options o ON ov.option_id = o.option_id
          WHERE po.product_id = p.product_id
        ) as options,
        (
          SELECT json_build_object('category_id', sc.category_id, 'category_name', sc.category_name)
          FROM category sc
          WHERE sc.category_id = p.subcategory_id
        ) as subcategory,
        (
          SELECT json_agg(
            json_build_object(
              'product_image_id', pi.product_image_id,
              'image_url', pi.image_url,
              'image_order', pi.image_order
            ) ORDER BY pi.image_order
          )
          FROM product_images pi
          WHERE pi.product_id = p.product_id
        ) as product_images
      FROM product p
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      query += ` AND (p.product_name ILIKE $${paramIndex} OR p.product_description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Status filter
    if (status !== undefined) {
      query += ` AND p.product_status = $${paramIndex}`;
      params.push(Number(status));
      paramIndex++;
    }

    query += ' ORDER BY p.product_id DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    // Get customer type and discounts if customer_id provided
    let customerType: string | null = null;
    let isWholesale = false;
    const productDiscountsMap = new Map<number, number>();
    const optionDiscountsMap = new Map<string, number>();

    if (filters.customer_id) {
      try {
        // Get customer type
        const customerQuery = `SELECT customer_type FROM customer WHERE customer_id = $1`;
        const customerResult = await this.dataSource.query(customerQuery, [filters.customer_id]);
        if (customerResult.length > 0) {
          customerType = customerResult[0].customer_type || null;
          isWholesale = customerType?.includes('Wholesale') || customerType?.includes('Wholesaler') || false;
        }

        // Get product-level discounts
        const productDiscountQuery = `
          SELECT product_id, discount_percentage
          FROM customer_product_discount
          WHERE customer_id = $1
        `;
        const productDiscountResult = await this.dataSource.query(productDiscountQuery, [filters.customer_id]);
        productDiscountResult.forEach((row: any) => {
          productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage || 0));
        });

        // Get option-level discounts
        const optionDiscountQuery = `
          SELECT product_id, option_value_id, discount_percentage
          FROM customer_product_option_discount
          WHERE customer_id = $1
        `;
        const optionDiscountResult = await this.dataSource.query(optionDiscountQuery, [filters.customer_id]);
        optionDiscountResult.forEach((row: any) => {
          const key = `${row.product_id}_${row.option_value_id}`;
          optionDiscountsMap.set(key, parseFloat(row.discount_percentage || 0));
        });
      } catch (error) {
        this.logger.error('Error fetching customer discounts:', error);
      }
    }

    // Apply pricing based on customer type and discounts using pricing service
    const productsWithPricing = result.map((product: any) => {
      const retailPrice = parseFloat(product.product_price || 0);
      const wholesalePrice = product.retail_price ? parseFloat(product.retail_price || 0) : null;
      const retailDiscountPercentage = product.retail_discount_percentage ? parseFloat(product.retail_discount_percentage) : null;
      const productDiscount = productDiscountsMap.get(product.product_id) || 0;

      // Use pricing service for consistent calculations
      const pricing = this.pricingService.calculateProductPrice(
        retailPrice,
        wholesalePrice,
        retailDiscountPercentage,
        isWholesale,
        productDiscount,
      );

      // Process options with pricing using pricing service
      let optionsWithPricing = null;
      if (product.options && Array.isArray(product.options)) {
        optionsWithPricing = product.options.map((option: any) => {
          const baseOptionPrice = parseFloat(option.option_price || 0);
          const standardPrice = option.standard_price ? parseFloat(option.standard_price) : null;
          const optionWholesalePrice = option.wholesale_price ? parseFloat(option.wholesale_price) : null;
          const optionKey = `${product.product_id}_${option.option_value_id}`;
          const optionDiscount = optionDiscountsMap.get(optionKey) || 0;

          const optionPricing = this.pricingService.calculateOptionPrice(
            standardPrice,
            optionWholesalePrice,
            baseOptionPrice,
            isWholesale,
            optionDiscount,
          );

          return {
            ...option,
            option_base_price: optionPricing.basePrice,
            option_price: optionPricing.finalPrice,
            discount_percentage: optionPricing.discountPercentage,
            original_option_price: optionPricing.basePrice,
            has_discount: optionPricing.hasDiscount,
          };
        });
      }

      return {
        ...product,
        product_price: pricing.finalPrice,
        original_price: pricing.basePrice,
        base_retail_price: pricing.originalPrice,
        base_wholesale_price: pricing.wholesalePrice,
        discount_percentage: pricing.discountPercentage,
        has_discount: pricing.hasDiscount,
        customer_type: customerType,
        is_wholesale: pricing.isWholesale,
        options: optionsWithPricing || product.options,
      };
    });

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM product p WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (p.product_name ILIKE $${countParamIndex} OR p.product_description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status !== undefined) {
      countQuery += ` AND p.product_status = $${countParamIndex}`;
      countParams.push(Number(status));
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return {
      products: productsWithPricing,
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  /**
   * Get single product
   * @param id - Product ID
   * @param customer_id - Optional: if provided, prices will be calculated based on customer type and discounts
   */
  async getProduct(id: number, customer_id?: number) {
    const query = `
      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object('category_id', c.category_id, 'category_name', c.category_name) ORDER BY c.sort_order ASC, c.category_name ASC)
          FROM product_category pc
          JOIN category c ON pc.category_id = c.category_id
          WHERE pc.product_id = p.product_id
        ) as categories,
        (
          SELECT json_agg(
            json_build_object(
              'product_option_id', po.product_option_id,
              'option_id', o.option_id,
              'option_name', o.name,
              'option_type', o.option_type,
              'option_value_id', ov.option_value_id,
              'option_value_name', ov.name,
              'option_price', po.option_price,
              'option_price_prefix', po.option_price_prefix,
              'option_required', po.option_required,
              'standard_price', ov.standard_price,
              'wholesale_price', ov.wholesale_price,
              'discount_percentage', 0
            )
          )
          FROM product_option po
          JOIN option_value ov ON po.option_value_id = ov.option_value_id
          JOIN options o ON ov.option_id = o.option_id
          WHERE po.product_id = p.product_id
        ) as options,
        (
          SELECT json_build_object('category_id', sc.category_id, 'category_name', sc.category_name)
          FROM category sc
          WHERE sc.category_id = p.subcategory_id
        ) as subcategory,
        (
          SELECT json_agg(
            json_build_object(
              'product_image_id', pi.product_image_id,
              'image_url', pi.image_url,
              'image_order', pi.image_order
            ) ORDER BY pi.image_order
          )
          FROM product_images pi
          WHERE pi.product_id = p.product_id
        ) as product_images
      FROM product p
      WHERE p.product_id = $1
    `;

    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Product not found');
    }

    const product = result[0];

    // Get customer type and discounts if customer_id provided
    let customerType: string | null = null;
    let isWholesale = false;
    const productDiscountsMap = new Map<number, number>();
    const optionDiscountsMap = new Map<string, number>();

    if (customer_id) {
      try {
        // Get customer type
        const customerQuery = `SELECT customer_type FROM customer WHERE customer_id = $1`;
        const customerResult = await this.dataSource.query(customerQuery, [customer_id]);
        if (customerResult.length > 0) {
          customerType = customerResult[0].customer_type || null;
          isWholesale = customerType?.includes('Wholesale') || customerType?.includes('Wholesaler') || false;
        }

        // Get product-level discount
        const productDiscountQuery = `
          SELECT discount_percentage
          FROM customer_product_discount
          WHERE customer_id = $1 AND product_id = $2
        `;
        const productDiscountResult = await this.dataSource.query(productDiscountQuery, [customer_id, id]);
        if (productDiscountResult.length > 0) {
          productDiscountsMap.set(id, parseFloat(productDiscountResult[0].discount_percentage || 0));
        }

        // Get option-level discounts
        const optionDiscountQuery = `
          SELECT option_value_id, discount_percentage
          FROM customer_product_option_discount
          WHERE customer_id = $1 AND product_id = $2
        `;
        const optionDiscountResult = await this.dataSource.query(optionDiscountQuery, [customer_id, id]);
        optionDiscountResult.forEach((row: any) => {
          const key = `${id}_${row.option_value_id}`;
          optionDiscountsMap.set(key, parseFloat(row.discount_percentage || 0));
        });
      } catch (error) {
        this.logger.error('Error fetching customer discounts:', error);
      }
    }

    // Apply pricing based on customer type and discounts
    const retailPrice = parseFloat(product.product_price || 0);
    const wholesalePrice = product.retail_price ? parseFloat(product.retail_price || 0) : null;
    const retailDiscountPercentage = product.retail_discount_percentage ? parseFloat(product.retail_discount_percentage) : null;
    const productDiscount = productDiscountsMap.get(id) || 0;

    // Use pricing service for consistent calculations
    const pricing = this.pricingService.calculateProductPrice(
      retailPrice,
      wholesalePrice,
      retailDiscountPercentage,
      isWholesale,
      productDiscount,
    );

    // Process options with pricing using pricing service
    let optionsWithPricing = null;
    if (product.options && Array.isArray(product.options)) {
      optionsWithPricing = product.options.map((option: any) => {
        const baseOptionPrice = parseFloat(option.option_price || 0);
        const standardPrice = option.standard_price ? parseFloat(option.standard_price) : null;
        const optionWholesalePrice = option.wholesale_price ? parseFloat(option.wholesale_price) : null;
        const optionKey = `${id}_${option.option_value_id}`;
        const optionDiscount = optionDiscountsMap.get(optionKey) || 0;

        const optionPricing = this.pricingService.calculateOptionPrice(
          standardPrice,
          optionWholesalePrice,
          baseOptionPrice,
          isWholesale,
          optionDiscount,
        );

        return {
          ...option,
          option_base_price: optionPricing.basePrice,
          option_price: optionPricing.finalPrice,
          discount_percentage: optionPricing.discountPercentage,
          original_option_price: optionPricing.basePrice,
          has_discount: optionPricing.hasDiscount,
        };
      });
    }

    return {
      product: {
        ...product,
        product_price: pricing.finalPrice,
        original_price: pricing.basePrice,
        base_retail_price: pricing.originalPrice,
        base_wholesale_price: pricing.wholesalePrice,
        discount_percentage: pricing.discountPercentage,
        has_discount: pricing.hasDiscount,
        customer_type: customerType,
        is_wholesale: pricing.isWholesale,
        options: optionsWithPricing || product.options,
      },
    };
  }

  /**
   * Create product
   */
  async createProduct(
    productData: {
      product_name: string;
      product_description?: string;
      short_description?: string;
      roast_level?: string;
      show_specifications?: boolean;
      show_other_info?: boolean;
      product_price: number;
      retail_price?: number;
      retail_discount_percentage?: number;
      customer_type_visibility?: string;
      product_status?: number;
      user_id: number;
      categories?: number[];
      subcategory_id?: number;
      options?: any[];
      product_image_url?: string;
      product_images?: string[];
      min_quantity?: number;
      you_may_also_like?: boolean;
      show_in_checkout?: boolean;
      featured_1?: boolean;
      featured_2?: boolean;
      show_in_storefront?: boolean;
      info_description?: string;
    },
    files?: Express.Multer.File[],
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const uploadedImageUrls: string[] = [];

      // Handle image uploads
      if (files && Array.isArray(files) && files.length > 0) {
        this.logger.log(`Starting upload of ${files.length} image(s) to S3...`);
        for (const file of files) {
          try {
            const tempProductId = Date.now();
            const result = await this.s3Service.uploadProductImage(
              file.buffer,
              tempProductId,
              file.originalname,
            );
            this.logger.log(`✅ Successfully uploaded ${file.originalname} to S3: ${result.url}`);
            uploadedImageUrls.push(result.url);
          } catch (error: any) {
            this.logger.error(`❌ Failed to upload ${file.originalname}:`, error);
            throw new Error(`Failed to upload image ${file.originalname}: ${error.message || error}`);
          }
        }
      }

      // Combine uploaded images with any existing image URLs
      const allImageUrls = [...uploadedImageUrls, ...(productData.product_images || [])];

      const {
        product_name,
        product_description,
        short_description,
        roast_level,
        show_specifications,
        show_other_info,
        product_price,
        retail_price,
        retail_discount_percentage,
        customer_type_visibility,
        product_status,
        user_id,
        categories,
        subcategory_id,
        options,
        product_image_url,
        min_quantity,
        you_may_also_like,
        show_in_checkout,
        featured_1,
        featured_2,
        show_in_storefront,
        info_description,
      } = productData;

      // Validation
      if (!product_name || product_name.trim() === '') {
        throw new BadRequestException('Product name is required');
      }

      if (product_name.length > 255) {
        throw new BadRequestException('Product name must be 255 characters or less');
      }

      if (product_price === undefined || product_price === null) {
        throw new BadRequestException('Product price is required');
      }

      const price = parseFloat(product_price.toString());
      if (isNaN(price) || price < 0 || price > 99999999.99) {
        throw new BadRequestException('Product price must be a valid number between 0 and 99,999,999.99');
      }

      if (product_description && product_description.length > 10000) {
        throw new BadRequestException('Product description must be 10,000 characters or less');
      }

      if (!user_id) {
        throw new BadRequestException('User ID is required');
      }

      if (product_image_url && product_image_url.length > 500) {
        throw new BadRequestException('Product image URL must be 500 characters or less');
      }

      if (allImageUrls.length > 10) {
        throw new BadRequestException('Maximum 10 images allowed per product');
      }

      // Calculate retail_price if not provided
      let finalRetailPrice = retail_price;
      if (!finalRetailPrice && product_price) {
        const discount = retail_discount_percentage || 40;
        finalRetailPrice = parseFloat(product_price.toString()) * (1 - parseFloat(discount.toString()) / 100);
      }

      // Set default visibility if not provided
      const visibility = customer_type_visibility || 'all';

      // Create product
      const productResult = await queryRunner.query(
        `INSERT INTO product (
          product_name, 
          product_description,
          short_description,
          roast_level,
          show_specifications,
          show_other_info,
          product_price,
          retail_price,
          retail_discount_percentage,
          customer_type_visibility,
          product_status,
          user_id,
          product_image,
          subcategory_id,
          min_quantity,
          you_may_also_like,
          show_in_checkout,
          featured_1,
          featured_2,
          show_in_storefront,
          info_description,
          product_date_added,
          product_date_modified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        RETURNING *`,
        [
          product_name,
          product_description || '',
          short_description || null,
          roast_level || null,
          show_specifications || false,
          show_other_info || false,
          product_price,
          finalRetailPrice ? parseFloat(finalRetailPrice.toString()).toFixed(2) : null,
          retail_discount_percentage || 40,
          visibility,
          product_status || 1,
          user_id,
          product_image_url || null,
          subcategory_id || null,
          min_quantity || 1,
          you_may_also_like || false,
          show_in_checkout || false,
          featured_1 || false,
          featured_2 || false,
          show_in_storefront || false,
          info_description || null,
        ],
      );

      const newProduct = productResult[0];

      // Insert categories if provided
      if (categories && Array.isArray(categories) && categories.length > 0) {
        for (const categoryId of categories) {
          await queryRunner.query(
            'INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)',
            [newProduct.product_id, categoryId],
          );
        }
      }

      // Insert options if provided
      if (options && Array.isArray(options) && options.length > 0) {
        for (const option of options) {
          if (!option.option_value_id) {
            throw new BadRequestException(`Missing option_value_id in option: ${JSON.stringify(option)}`);
          }
          await queryRunner.query(
            `INSERT INTO product_option (product_id, option_value_id, option_price, option_price_prefix, option_required) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              newProduct.product_id,
              option.option_value_id,
              option.option_price || 0,
              option.option_price_prefix || '+',
              option.option_required || 0,
            ],
          );
        }
      }

      // Insert product images if provided
      if (allImageUrls && Array.isArray(allImageUrls) && allImageUrls.length > 0) {
        this.logger.log(`Inserting ${allImageUrls.length} images for product ${newProduct.product_id}`);
        for (let i = 0; i < allImageUrls.length; i++) {
          const imageUrl = allImageUrls[i];
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
            try {
              await queryRunner.query(
                `INSERT INTO product_images (product_id, image_url, image_order) 
                 VALUES ($1, $2, $3)`,
                [newProduct.product_id, imageUrl.trim(), i],
              );
              this.logger.log(`Inserted image ${i + 1}: ${imageUrl}`);
            } catch (imgError) {
              this.logger.error(`Failed to insert image ${i + 1}:`, imgError);
              // Continue with other images even if one fails
            }
          }
        }
      }

      await queryRunner.commitTransaction();

      // Fetch the complete product
      const completeProduct = await this.getProduct(newProduct.product_id);

      return {
        product: completeProduct.product,
        message: 'Product created successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update product
   */
  async updateProduct(
    id: number,
    productData: {
      product_name?: string;
      product_description?: string;
      short_description?: string;
      roast_level?: string;
      show_specifications?: boolean;
      show_other_info?: boolean;
      product_price?: number;
      retail_price?: number;
      retail_discount_percentage?: number;
      customer_type_visibility?: string;
      product_status?: number;
      categories?: number[];
      subcategory_id?: number;
      options?: any[];
      product_image_url?: string;
      product_images?: string[];
      min_quantity?: number;
      you_may_also_like?: boolean;
      show_in_checkout?: boolean;
      featured_1?: boolean;
      featured_2?: boolean;
      show_in_storefront?: boolean;
      info_description?: string;
    },
    files?: Express.Multer.File[],
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const uploadedImageUrls: string[] = [];

      // Handle image uploads
      if (files && Array.isArray(files) && files.length > 0) {
        this.logger.log(`Starting upload of ${files.length} image(s) to S3 for product update...`);
        for (const file of files) {
          try {
            const result = await this.s3Service.uploadProductImage(
              file.buffer,
              Number(id),
              file.originalname,
            );
            this.logger.log(`✅ Successfully uploaded ${file.originalname} to S3: ${result.url}`);
            uploadedImageUrls.push(result.url);
          } catch (error: any) {
            this.logger.error(`❌ Failed to upload ${file.originalname}:`, error);
            // Don't fail the entire update - continue with other images
          }
        }
      }

      // Combine uploaded images with any existing image URLs
      const allImageUrls = [...uploadedImageUrls, ...(productData.product_images || [])];

      const {
        product_name,
        product_description,
        short_description,
        roast_level,
        show_specifications,
        show_other_info,
        product_price,
        retail_price,
        retail_discount_percentage,
        customer_type_visibility,
        product_status,
        categories,
        subcategory_id,
        options,
        product_image_url,
        min_quantity,
        you_may_also_like,
        show_in_checkout,
        featured_1,
        featured_2,
        show_in_storefront,
        info_description,
      } = productData;

      // Validate update fields
      if (product_name !== undefined && product_name !== null) {
        if (product_name.trim() === '') {
          throw new BadRequestException('Product name cannot be empty');
        }
        if (product_name.length > 255) {
          throw new BadRequestException('Product name must be 255 characters or less');
        }
      }

      if (product_price !== undefined && product_price !== null) {
        const price = parseFloat(product_price.toString());
        if (isNaN(price) || price < 0 || price > 99999999.99) {
          throw new BadRequestException('Product price must be a valid number between 0 and 99,999,999.99');
        }
      }

      if (product_description !== undefined && product_description !== null && product_description.length > 10000) {
        throw new BadRequestException('Product description must be 10,000 characters or less');
      }

      if (product_image_url && product_image_url.length > 500) {
        throw new BadRequestException('Product image URL must be 500 characters or less');
      }

      // Calculate retail_price if not provided but product_price is being updated
      let finalRetailPrice = retail_price;
      if (!finalRetailPrice && product_price) {
        const discount = retail_discount_percentage || 40;
        finalRetailPrice = parseFloat(product_price.toString()) * (1 - parseFloat(discount.toString()) / 100);
      }

      // Build dynamic UPDATE query for new fields
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (product_name !== undefined) {
        updateFields.push(`product_name = $${paramIndex++}`);
        updateParams.push(product_name);
      }
      if (product_description !== undefined) {
        updateFields.push(`product_description = $${paramIndex++}`);
        updateParams.push(product_description);
      }
      if (short_description !== undefined) {
        updateFields.push(`short_description = $${paramIndex++}`);
        updateParams.push(short_description || null);
      }
      if (roast_level !== undefined) {
        updateFields.push(`roast_level = $${paramIndex++}`);
        updateParams.push(roast_level || null);
      }
      if (show_specifications !== undefined) {
        updateFields.push(`show_specifications = $${paramIndex++}`);
        updateParams.push(show_specifications);
      }
      if (show_other_info !== undefined) {
        updateFields.push(`show_other_info = $${paramIndex++}`);
        updateParams.push(show_other_info);
      }
      if (product_price !== undefined) {
        updateFields.push(`product_price = $${paramIndex++}`);
        updateParams.push(product_price);
      }
      if (finalRetailPrice !== undefined) {
        updateFields.push(`retail_price = $${paramIndex++}`);
        updateParams.push(finalRetailPrice ? parseFloat(finalRetailPrice.toString()).toFixed(2) : null);
      }
      if (retail_discount_percentage !== undefined) {
        updateFields.push(`retail_discount_percentage = $${paramIndex++}`);
        updateParams.push(retail_discount_percentage);
      }
      if (customer_type_visibility !== undefined) {
        updateFields.push(`customer_type_visibility = $${paramIndex++}`);
        updateParams.push(customer_type_visibility);
      }
      if (product_status !== undefined) {
        updateFields.push(`product_status = $${paramIndex++}`);
        updateParams.push(product_status);
      }
      if (product_image_url !== undefined) {
        updateFields.push(`product_image = $${paramIndex++}`);
        updateParams.push(product_image_url);
      }
      if (subcategory_id !== undefined) {
        updateFields.push(`subcategory_id = $${paramIndex++}`);
        updateParams.push(subcategory_id || null);
      }
      if (min_quantity !== undefined) {
        updateFields.push(`min_quantity = $${paramIndex++}`);
        updateParams.push(min_quantity);
      }
      if (you_may_also_like !== undefined) {
        updateFields.push(`you_may_also_like = $${paramIndex++}`);
        updateParams.push(you_may_also_like);
      }
      if (show_in_checkout !== undefined) {
        updateFields.push(`show_in_checkout = $${paramIndex++}`);
        updateParams.push(show_in_checkout);
      }
      if (featured_1 !== undefined) {
        updateFields.push(`featured_1 = $${paramIndex++}`);
        updateParams.push(featured_1);
      }
      if (featured_2 !== undefined) {
        updateFields.push(`featured_2 = $${paramIndex++}`);
        updateParams.push(featured_2);
      }
      if (show_in_storefront !== undefined) {
        updateFields.push(`show_in_storefront = $${paramIndex++}`);
        updateParams.push(show_in_storefront);
      }
      if (info_description !== undefined) {
        updateFields.push(`info_description = $${paramIndex++}`);
        updateParams.push(info_description || null);
      }

      updateFields.push('product_date_modified = CURRENT_TIMESTAMP');
      updateParams.push(Number(id));

      const updateQuery = `UPDATE product 
         SET ${updateFields.join(', ')}
         WHERE product_id = $${paramIndex}
         RETURNING *`;

      const result = await queryRunner.query(updateQuery, updateParams);

      if (result.length === 0) {
        throw new NotFoundException('Product not found');
      }

      // Update categories if provided
      if (categories !== undefined && Array.isArray(categories)) {
        // Delete existing categories
        await queryRunner.query('DELETE FROM product_category WHERE product_id = $1', [Number(id)]);

        // Insert new categories
        for (const categoryId of categories) {
          await queryRunner.query(
            'INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)',
            [Number(id), categoryId],
          );
        }
      }

      // Update options if provided
      if (options !== undefined && Array.isArray(options)) {
        // Delete existing options
        await queryRunner.query('DELETE FROM product_option WHERE product_id = $1', [Number(id)]);

        // Insert new options
        for (const option of options) {
          if (!option.option_value_id) {
            throw new BadRequestException(`Missing option_value_id in option: ${JSON.stringify(option)}`);
          }
          await queryRunner.query(
            `INSERT INTO product_option (product_id, option_value_id, option_price, option_price_prefix, option_required) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              Number(id),
              option.option_value_id,
              option.option_price || 0,
              option.option_price_prefix || '+',
              option.option_required || 0,
            ],
          );
        }
      }

      // Update product images if provided
      if (allImageUrls !== undefined && allImageUrls !== null) {
        // Delete existing images
        await queryRunner.query('DELETE FROM product_images WHERE product_id = $1', [Number(id)]);

        // Insert new images (including newly uploaded ones)
        if (Array.isArray(allImageUrls) && allImageUrls.length > 0) {
          this.logger.log(`Updating ${allImageUrls.length} images for product ${id}`);
          for (let i = 0; i < allImageUrls.length; i++) {
            const imageUrl = allImageUrls[i];
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
              try {
                await queryRunner.query(
                  `INSERT INTO product_images (product_id, image_url, image_order) 
                   VALUES ($1, $2, $3)`,
                  [Number(id), imageUrl.trim(), i],
                );
                this.logger.log(`Inserted image ${i + 1}: ${imageUrl}`);
              } catch (imgError) {
                this.logger.error(`Failed to insert image ${i + 1}:`, imgError);
                // Continue with other images even if one fails
              }
            }
          }
        }
      }

      await queryRunner.commitTransaction();

      // Fetch the complete product
      const completeProduct = await this.getProduct(id);

      return {
        product: completeProduct.product,
        message: 'Product updated successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(id: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if product exists
      const productCheck = await queryRunner.query(
        'SELECT product_id, product_name FROM product WHERE product_id = $1',
        [Number(id)],
      );

      if (productCheck.length === 0) {
        throw new NotFoundException('Product not found');
      }

      // Check if product is used in any orders
      const orderProductCheck = await queryRunner.query(
        'SELECT COUNT(*) as count FROM order_product WHERE product_id = $1',
        [Number(id)],
      );

      const orderCount = parseInt(orderProductCheck[0].count);
      if (orderCount > 0) {
        throw new BadRequestException(
          `Cannot delete product "${productCheck[0].product_name}" because it is used in ${orderCount} order(s). Please remove it from all orders first.`,
        );
      }

      // Delete product options first (foreign key constraint)
      await queryRunner.query('DELETE FROM product_option WHERE product_id = $1', [Number(id)]);

      // Delete product categories
      await queryRunner.query('DELETE FROM product_category WHERE product_id = $1', [Number(id)]);

      // Delete product images
      await queryRunner.query('DELETE FROM product_images WHERE product_id = $1', [Number(id)]);

      // Delete product
      const result = await queryRunner.query(
        'DELETE FROM product WHERE product_id = $1 RETURNING *',
        [Number(id)],
      );

      await queryRunner.commitTransaction();

      return { message: 'Product deleted successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Delete product error:', error);
      throw new BadRequestException(
        error.message || 'Failed to delete product. It may be referenced in existing orders.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * List categories
   */
  async listCategories() {
    const query = `
      SELECT 
        c.*,
        (
          SELECT json_build_object('category_id', pc.category_id, 'category_name', pc.category_name)
          FROM category pc
          WHERE pc.category_id = c.parent_category_id
        ) as parent_category
      FROM category c
      ORDER BY c.category_id
    `;

    const result = await this.dataSource.query(query);
    return { categories: result };
  }

  /**
   * Create category
   */
  async createCategory(data: { category_name: string; parent_category_id?: number }) {
    const { category_name, parent_category_id } = data;

    if (!category_name) {
      throw new BadRequestException('Category name is required');
    }

    const query = `
      INSERT INTO category (category_name, parent_category_id)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [category_name, parent_category_id || null]);
    return {
      category: result[0],
      message: 'Category created successfully',
    };
  }

  /**
   * Update category
   */
  async updateCategory(id: number, data: { category_name?: string; parent_category_id?: number }) {
    const { category_name, parent_category_id } = data;

    const query = `
      UPDATE category
      SET 
        category_name = COALESCE($1, category_name),
        parent_category_id = COALESCE($2, parent_category_id)
      WHERE category_id = $3
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [category_name, parent_category_id, Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return {
      category: result[0],
      message: 'Category updated successfully',
    };
  }

  /**
   * Delete category
   */
  async deleteCategory(id: number) {
    const query = 'DELETE FROM category WHERE category_id = $1 RETURNING *';
    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return { message: 'Category deleted successfully' };
  }

  /**
   * Toggle product status (activate/deactivate)
   */
  async toggleProductStatus(id: number, status: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate status (0 = inactive, 1 = active)
      if (status !== 0 && status !== 1) {
        throw new BadRequestException('Invalid status. Must be 0 (inactive) or 1 (active)');
      }

      // Check if product exists
      const checkQuery = 'SELECT product_id, product_status FROM product WHERE product_id = $1';
      const checkResult = await queryRunner.query(checkQuery, [id]);

      if (checkResult.length === 0) {
        throw new NotFoundException('Product not found');
      }

      // Update product status
      const updateQuery = `
        UPDATE product 
        SET product_status = $1, product_date_modified = CURRENT_TIMESTAMP
        WHERE product_id = $2
        RETURNING product_id, product_status, product_name
      `;
      const result = await queryRunner.query(updateQuery, [status, id]);

      await queryRunner.commitTransaction();

      return {
        message: `Product ${status === 1 ? 'activated' : 'deactivated'} successfully`,
        product: result[0],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get inactive products
   */
  async getInactiveProducts(filters: {
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    return this.listProducts({
      ...filters,
      status: 0, // Only inactive products
    });
  }
}
