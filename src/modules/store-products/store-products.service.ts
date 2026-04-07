import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { PricingService } from '../../common/services/pricing.service';

@Injectable()
export class StoreProductsService {
  private readonly logger = new Logger(StoreProductsService.name);

  constructor(
    private dataSource: DataSource,
    private jwtService: JwtService,
    private pricingService: PricingService,
  ) { }

  /**
   * Get customer discount percentage
   */
  private async getCustomerDiscount(userId: number): Promise<number> {
    try {
      if (!userId) return 0;

      // Check which discount column exists
      const columnCheck = await this.dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customer' 
        AND column_name IN ('discount_percentage', 'wholesale_discount_percentage')
      `);
      const hasDiscountPercentage = columnCheck.some((row: any) => row.column_name === 'discount_percentage');
      const hasWholesaleDiscountPercentage = columnCheck.some((row: any) => row.column_name === 'wholesale_discount_percentage');

      const discountColumn = hasDiscountPercentage ? 'c.discount_percentage' :
        hasWholesaleDiscountPercentage ? 'c.wholesale_discount_percentage' : 'NULL';

      const customerQuery = `
        SELECT 
          c.customer_type, 
          ${discountColumn} as discount_percentage
        FROM customer c
        WHERE c.user_id = $1
      `;
      const customerResult = await this.dataSource.query(customerQuery, [userId]);
      const customer = customerResult[0];

      if (!customer) return 0;

      // If custom discount percentage is set, use it
      if (customer.discount_percentage !== null && customer.discount_percentage !== undefined) {
        const discount = parseFloat(customer.discount_percentage.toString());
        if (!isNaN(discount) && discount > 0) {
          return discount;
        }
      }

      // Otherwise, use defaults based on customer type
      const customerType = customer.customer_type || '';
      if (customerType.includes('Full Service')) {
        return 15;
      } else if (customerType.includes('Partial Service')) {
        return 10;
      }

      return 0;
    } catch (error) {
      this.logger.error('Error getting customer discount:', error);
      return 0;
    }
  }

  /**
   * Extract user ID from JWT token
   */
  private extractUserIdFromToken(authHeader?: string): number | null {
    try {
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = this.jwtService.decode(token) as any;
        return decoded?.user_id || decoded?.id || null;
      }
    } catch (error) {
      // Token invalid or not provided
    }
    return null;
  }

  /**
   * List products for storefront with filters
   */
  async listProducts(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      category_id?: number;
      heading_id?: number;
      min_price?: number;
      max_price?: number;
      order_by?: string;
    },
    authHeader?: string,
  ) {
    const {
      page = 1,
      limit = 20,
      search,
      category_id,
      heading_id,
      min_price,
      max_price,
      order_by = 'featured',
    } = filters;

    // Get user from token if provided
    let userId: number | null = null;
    let discountPercentage = 0;
    let customerType: string | null = null;

    userId = this.extractUserIdFromToken(authHeader);
    if (userId) {
      discountPercentage = await this.getCustomerDiscount(userId);
      const customerTypeQuery = await this.dataSource.query(
        `SELECT customer_type FROM customer WHERE user_id = $1`,
        [userId],
      );
      if (customerTypeQuery.length > 0) {
        customerType = customerTypeQuery[0].customer_type || null;
      }
    }

    const isRetailer = customerType ? customerType.toLowerCase().trim() === 'retail' : false;
    const isWholesaler = customerType ? (
      customerType.toLowerCase().includes('wholesale') ||
      customerType.toLowerCase().includes('wholesaler') ||
      customerType.toLowerCase().startsWith('full service') ||
      customerType.toLowerCase().startsWith('partial service')
    ) : false;

    const offset = (Number(page) - 1) * Number(limit);
    const params: any[] = [];
    let paramIndex = 1;

    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_description,
        p.product_price,
        p.retail_price,
        p.customer_type_visibility,
        p.product_image,
        p.product_status,
        p.product_date_added,
        p.info_description,
        p.subcategory_id,
        (
          SELECT ph.heading 
          FROM product_header ph 
          JOIN heading_product hp ON ph.heading_id = hp.heading_id 
          WHERE hp.product_id = p.product_id 
          ORDER BY ph.heading_id ASC
          LIMIT 1
        ) as header_name,
        COALESCE(
          (SELECT c.category_name FROM category c WHERE c.category_id = p.subcategory_id),
          (SELECT c.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as subcategory_name,
        COALESCE(
          (SELECT cp.category_name FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_name,
        COALESCE(
          (SELECT cp.category_id FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_id FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_id,
        (
          SELECT json_agg(json_build_object('category_id', c.category_id, 'category_name', c.category_name) ORDER BY c.sort_order ASC, c.category_name ASC)
          FROM product_category pc
          JOIN category c ON pc.category_id = c.category_id
          WHERE pc.product_id = p.product_id
        ) as categories,
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
      WHERE p.product_status = 1 AND p.show_in_storefront = true
    `;

    // Filter by customer type visibility
    if (userId && customerType) {
      if (isRetailer) {
        query += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'retailers')`;
      } else if (isWholesaler) {
        query += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'wholesalers')`;
      } else {
        query += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
      }
    } else {
      query += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.product_name ILIKE $${paramIndex} OR p.product_description ILIKE $${paramIndex})`;
      paramIndex++;
    }

    if (category_id) {
      const catId = Number(category_id);
      params.push(catId);
      // Filter products that are directly in this category, or in a subcategory of this category,
      // or have this category as their assigned subcategory_id
      query += ` AND (
        EXISTS (
          SELECT 1 FROM product_category pc_filter 
          WHERE pc_filter.product_id = p.product_id 
          AND (
            pc_filter.category_id = $${paramIndex} 
            OR pc_filter.category_id IN (SELECT category_id FROM category WHERE parent_category_id = $${paramIndex})
          )
        )
        OR p.subcategory_id = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM category c_sub_filter 
          WHERE c_sub_filter.category_id = p.subcategory_id 
          AND c_sub_filter.parent_category_id = $${paramIndex}
        )
      )`;
      paramIndex++;
    }

    if (heading_id) {
      params.push(Number(heading_id));
      query += ` AND EXISTS (SELECT 1 FROM heading_product hp_filter WHERE hp_filter.product_id = p.product_id AND hp_filter.heading_id = $${paramIndex})`;
      paramIndex++;
    }

    if (min_price) {
      params.push(Number(min_price));
      query += ` AND p.product_price >= $${paramIndex}`;
      paramIndex++;
    }

    if (max_price) {
      params.push(Number(max_price));
      query += ` AND p.product_price <= $${paramIndex}`;
      paramIndex++;
    }

    // Determine sort order
    let orderByClause: string;
    if (order_by === 'price-low') {
      orderByClause = 'ORDER BY p.product_price ASC';
    } else if (order_by === 'price-high') {
      orderByClause = 'ORDER BY p.product_price DESC';
    } else if (order_by === 'newest') {
      orderByClause = 'ORDER BY p.product_date_added DESC';
    } else {
      orderByClause = 'ORDER BY p.product_id DESC';
    }

    query += `
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(Number(limit), offset);

    const result = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM product p
      WHERE p.product_status = 1 AND p.show_in_storefront = true
    `;

    let countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (p.product_name ILIKE $${countParamIndex} OR p.product_description ILIKE $${countParamIndex})`;
      countParamIndex++;
    }

    if (category_id) {
      const catId = Number(category_id);
      countParams.push(catId);
      countQuery += ` AND (
        EXISTS (
          SELECT 1 FROM product_category pc_filter 
          WHERE pc_filter.product_id = p.product_id 
          AND (
            pc_filter.category_id = $${countParamIndex} 
            OR pc_filter.category_id IN (SELECT category_id FROM category WHERE parent_category_id = $${countParamIndex})
          )
        )
        OR p.subcategory_id = $${countParamIndex}
        OR EXISTS (
          SELECT 1 FROM category c_sub_filter 
          WHERE c_sub_filter.category_id = p.subcategory_id 
          AND c_sub_filter.parent_category_id = $${countParamIndex}
        )
      )`;
      countParamIndex++;
    }

    if (heading_id) {
      countParams.push(Number(heading_id));
      countQuery += ` AND EXISTS (SELECT 1 FROM heading_product hp_filter WHERE hp_filter.product_id = p.product_id AND hp_filter.heading_id = $${countParamIndex})`;
      countParamIndex++;
    }

    if (min_price) {
      countParams.push(Number(min_price));
      countQuery += ` AND p.product_price >= $${countParamIndex}`;
      countParamIndex++;
    }

    if (max_price) {
      countParams.push(Number(max_price));
      countQuery += ` AND p.product_price <= $${countParamIndex}`;
      countParamIndex++;
    }

    // Apply same visibility filter to count query
    if (userId && customerType) {
      if (isRetailer) {
        countQuery += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'retailers')`;
      } else if (isWholesaler) {
        countQuery += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'wholesalers')`;
      } else {
        countQuery += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
      }
    } else {
      countQuery += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0].total);

    // Get customer ID and discounts
    let customerId: number | null = null;
    let productDiscountsMap = new Map<number, number>();

    if (userId) {
      try {
        // Get customer_id from user_id
        const customerQuery = await this.dataSource.query(
          `SELECT customer_id FROM customer WHERE user_id = $1`,
          [userId],
        );
        if (customerQuery.length > 0) {
          customerId = customerQuery[0].customer_id;

          // Get product-level discounts from customer_product_discount table
          const productDiscountQuery = `
            SELECT product_id, discount_percentage
            FROM customer_product_discount
            WHERE customer_id = $1
          `;
          const productDiscountResult = await this.dataSource.query(productDiscountQuery, [customerId]);
          productDiscountResult.forEach((row: any) => {
            if (row.discount_percentage > 0) {
              productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
            }
          });
        }
      } catch (error) {
        this.logger.error('Error fetching customer discounts:', error);
      }
    }

    // Apply pricing based on customer type and discounts
    const productsWithDiscount = result.map((product: any) => {
      const retailPrice = parseFloat(product.product_price || 0);
      const wholesalePrice = product.retail_price ? parseFloat(product.retail_price || 0) : null;
      const retailDiscountPercentage = product.retail_discount_percentage ? parseFloat(product.retail_discount_percentage) : null;

      // Get product-level discount (prioritize customer_product_discount over general discount)
      const productDiscount = productDiscountsMap.get(product.product_id) || discountPercentage;

      // Use pricing service for consistent calculations
      const pricing = this.pricingService.calculateProductPrice(
        retailPrice,
        wholesalePrice,
        retailDiscountPercentage,
        isWholesaler,
        productDiscount,
      );

      return {
        ...product,
        product_price: pricing.finalPrice.toFixed(2),
        original_price: pricing.originalPrice,
        discounted_price: pricing.finalPrice,
        discount_percentage: pricing.discountPercentage,
        has_discount: pricing.hasDiscount,
        wholesale_price: pricing.wholesalePrice,
        base_price: pricing.basePrice,
        is_wholesale: pricing.isWholesale,
      };
    });

    return {
      products: productsWithDiscount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Get product details with options
   */
  async getProduct(id: number, authHeader?: string) {
    // Get user from token if provided
    let userId: number | null = null;
    let discountPercentage = 0;
    let customerType: string | null = null;

    userId = this.extractUserIdFromToken(authHeader);
    if (userId) {
      discountPercentage = await this.getCustomerDiscount(userId);
      const customerTypeQuery = await this.dataSource.query(
        `SELECT customer_type FROM customer WHERE user_id = $1`,
        [userId],
      );
      if (customerTypeQuery.length > 0) {
        customerType = customerTypeQuery[0].customer_type || null;
      }
    }

    const isRetailer = customerType ? customerType.toLowerCase().trim() === 'retail' : false;
    const isWholesaler = customerType ? (
      customerType.toLowerCase().includes('wholesale') ||
      customerType.toLowerCase().includes('wholesaler') ||
      customerType.toLowerCase().startsWith('full service') ||
      customerType.toLowerCase().startsWith('partial service')
    ) : false;

    // Get product details
    let productQuery = `
      SELECT 
        p.*,
        ph.heading as header_name,
        ph.image as header_image,
        COALESCE(
          (SELECT c.category_name FROM category c WHERE c.category_id = p.subcategory_id),
          (SELECT c.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as subcategory_name,
        COALESCE(
          (SELECT cp.category_name FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_name,
        COALESCE(
          (SELECT cp.category_id FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_id FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_id,
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
      LEFT JOIN heading_product hp ON p.product_id = hp.product_id
      LEFT JOIN product_header ph ON hp.heading_id = ph.heading_id
      WHERE p.product_id = $1 AND p.product_status = 1 AND p.show_in_storefront = true
    `;

    // Filter by customer type visibility
    if (userId && customerType) {
      if (isRetailer) {
        productQuery += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'retailers')`;
      } else if (isWholesaler) {
        productQuery += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'wholesalers')`;
      } else {
        productQuery += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
      }
    } else {
      productQuery += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
    }

    const productResult = await this.dataSource.query(productQuery, [id]);
    const product = productResult[0];

    if (!product) {
      throw new NotFoundException('Product not found or not available for your customer type');
    }

    // Get product categories
    const categoriesQuery = `
    SELECT
    c.category_id,
      c.category_name,
      c.parent_category_id
      FROM category c
      JOIN product_category pc ON c.category_id = pc.category_id
      WHERE pc.product_id = $1
      ORDER BY c.sort_order ASC, c.category_name ASC
      `;
    const categoriesResult = await this.dataSource.query(categoriesQuery, [id]);

    // Get product options
    const optionsQuery = `
      SELECT DISTINCT
    o.option_id,
      o.name as option_name,
      o.option_type,
      ov.option_value_id,
      ov.name as option_value,
      ov.sort_order,
      po.product_option_id,
      po.option_required as required,
      po.option_price as product_option_price_base,
      po.option_price_prefix as product_option_price_prefix,
      p.retail_discount_percentage,
      ov.standard_price,
      ov.wholesale_price
      FROM product_option po
      JOIN option_value ov ON po.option_value_id = ov.option_value_id
      JOIN options o ON ov.option_id = o.option_id
      JOIN product p ON po.product_id = p.product_id
      WHERE po.product_id = $1
      ORDER BY o.option_id, ov.sort_order
      `;
    const optionsResult = await this.dataSource.query(optionsQuery, [id]);

    // Group options by option_id
    const optionsMap = new Map();
    for (const row of optionsResult) {
      if (!optionsMap.has(row.option_id)) {
        optionsMap.set(row.option_id, {
          option_id: row.option_id,
          option_name: row.option_name,
          option_type: row.option_type,
          required: row.required === 1,
          values: [],
        });
      }
      const option = optionsMap.get(row.option_id);

      const baseOptionPrice = parseFloat(row.product_option_price_base || 0);
      let productOptionPrice: number;

      if (isWholesaler) {
        const discount = parseFloat(product.retail_discount_percentage || 40);
        productOptionPrice = baseOptionPrice * (1 - discount / 100);
      } else {
        productOptionPrice = baseOptionPrice;
      }

      option.values.push({
        option_value_id: row.option_value_id,
        option_id: row.option_id,
        option_value: row.option_value,
        sort_order: row.sort_order,
        product_option_id: row.product_option_id,
        product_option_price: productOptionPrice,
        product_option_price_prefix: row.product_option_price_prefix,
        standard_price: row.standard_price,
        wholesale_price: row.wholesale_price,
      });
    }
    const options = Array.from(optionsMap.values());

    // Get customer ID and discounts
    let customerId: number | null = null;
    let productDiscount = 0;
    const optionDiscountsMap = new Map<number, number>();

    if (userId) {
      try {
        // Get customer_id from user_id
        const customerQuery = await this.dataSource.query(
          `SELECT customer_id FROM customer WHERE user_id = $1`,
          [userId],
        );
        if (customerQuery.length > 0) {
          customerId = customerQuery[0].customer_id;

          // Get product-level discount from customer_product_discount table
          const productDiscountQuery = `
            SELECT discount_percentage
            FROM customer_product_discount
            WHERE customer_id = $1 AND product_id = $2
      `;
          const productDiscountResult = await this.dataSource.query(productDiscountQuery, [customerId, id]);
          if (productDiscountResult.length > 0 && productDiscountResult[0].discount_percentage > 0) {
            productDiscount = parseFloat(productDiscountResult[0].discount_percentage);
          }

          // Get option-level discounts
          const optionDiscountQuery = `
            SELECT option_value_id, discount_percentage
            FROM customer_product_option_discount
            WHERE customer_id = $1 AND product_id = $2
      `;
          const optionDiscountResult = await this.dataSource.query(optionDiscountQuery, [customerId, id]);
          optionDiscountResult.forEach((row: any) => {
            if (row.discount_percentage > 0) {
              optionDiscountsMap.set(row.option_value_id, parseFloat(row.discount_percentage));
            }
          });
        }
      } catch (error) {
        this.logger.error('Error fetching customer discounts:', error);
      }
    }

    const retailPrice = parseFloat(product.product_price || 0);
    const wholesalePrice = product.retail_price ? parseFloat(product.retail_price || 0) : null;
    const retailDiscountPercentage = product.retail_discount_percentage ? parseFloat(product.retail_discount_percentage) : null;

    // Use pricing service for consistent calculations
    const pricing = this.pricingService.calculateProductPrice(
      retailPrice,
      wholesalePrice,
      retailDiscountPercentage,
      isWholesaler,
      productDiscount || discountPercentage,
    );

    // Apply option discounts using pricing service
    const optionsWithPricing = options.map((option: any) => ({
      ...option,
      values: option.values.map((value: any) => {
        const baseOptionPrice = parseFloat(value.product_option_price || 0);
        const standardPrice = value.standard_price ? parseFloat(value.standard_price) : null;
        const optionWholesalePrice = value.wholesale_price ? parseFloat(value.wholesale_price) : null;
        const optionDiscount = optionDiscountsMap.get(value.option_value_id) || 0;

        const optionPricing = this.pricingService.calculateOptionPrice(
          standardPrice,
          optionWholesalePrice,
          baseOptionPrice,
          isWholesaler,
          optionDiscount,
        );

        return {
          ...value,
          product_option_price: optionPricing.finalPrice,
          original_option_price: optionPricing.basePrice,
          discounted_option_price: optionPricing.finalPrice,
          discount_percentage: optionPricing.discountPercentage,
          has_discount: optionPricing.hasDiscount,
        };
      }),
    }));

    const productWithDiscount = {
      ...product,
      product_price: pricing.finalPrice.toFixed(2),
      original_price: pricing.originalPrice,
      discounted_price: pricing.finalPrice,
      discount_percentage: pricing.discountPercentage,
      has_discount: pricing.hasDiscount,
      wholesale_price: pricing.wholesalePrice,
      base_price: pricing.basePrice,
      is_wholesale: pricing.isWholesale,
      categories: categoriesResult,
      options: optionsWithPricing,
    };

    return { product: productWithDiscount };
  }


  /**
   * Get all categories for storefront
   */
  async getCategories() {
    const query = `
    SELECT
    category_id,
      parent_category_id,
      category_name
      FROM category
      ORDER BY sort_order ASC, category_name ASC
      `;

    const result = await this.dataSource.query(query);

    // Organize into tree structure
    const categoriesMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create all categories
    result.forEach((cat: any) => {
      categoriesMap.set(cat.category_id, { ...cat, children: [] });
    });

    // Second pass: organize hierarchy
    result.forEach((cat: any) => {
      const category = categoriesMap.get(cat.category_id);
      if (cat.parent_category_id) {
        const parent = categoriesMap.get(cat.parent_category_id);
        if (parent) {
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return { categories: rootCategories };
  }

  /**
   * Get product headers (sections)
   */
  async getHeaders() {
    const query = `
    SELECT
    heading_id,
      heading,
      image
      FROM product_header
      ORDER BY heading_id
    `;

    const result = await this.dataSource.query(query);
    return { headers: result };
  }

  /**
   * Get featured/popular products
   */
  async getFeaturedProducts(limit: number = 8, authHeader?: string) {
    // Get user from token if provided
    let userId: number | null = null;
    let discountPercentage = 0;
    let customerType: string | null = null;

    userId = this.extractUserIdFromToken(authHeader);
    if (userId) {
      discountPercentage = await this.getCustomerDiscount(userId);
      const customerTypeQuery = await this.dataSource.query(
        `SELECT customer_type FROM customer WHERE user_id = $1`,
        [userId],
      );
      if (customerTypeQuery.length > 0) {
        customerType = customerTypeQuery[0].customer_type || null;
      }
    }

    const isRetailer = customerType ? customerType.toLowerCase().trim() === 'retail' : false;
    const isWholesaler = customerType ? (
      customerType.toLowerCase().includes('wholesale') ||
      customerType.toLowerCase().includes('wholesaler') ||
      customerType.toLowerCase().startsWith('full service') ||
      customerType.toLowerCase().startsWith('partial service')
    ) : false;

    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_description,
        p.product_price,
        p.retail_price,
        p.customer_type_visibility,
        p.product_image,
        p.product_status,
        p.info_description,
        p.subcategory_id,
        (
          SELECT ph.heading 
          FROM product_header ph 
          JOIN heading_product hp ON ph.heading_id = hp.heading_id 
          WHERE hp.product_id = p.product_id 
          LIMIT 1
        ) as header_name,
        COALESCE(
          (SELECT c.category_name FROM category c WHERE c.category_id = p.subcategory_id),
          (SELECT c.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as subcategory_name,
        COALESCE(
          (SELECT cp.category_name FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_name,
        COALESCE(
          (SELECT cp.category_id FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_id FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_id,
        (
          SELECT json_agg(json_build_object('category_id', c.category_id, 'category_name', c.category_name) ORDER BY c.sort_order ASC, c.category_name ASC)
          FROM product_category pc
          JOIN category c ON pc.category_id = c.category_id
          WHERE pc.product_id = p.product_id
        ) as categories,
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
      WHERE p.product_status = 1 AND p.show_in_storefront = true
    `;

    // Filter by customer type visibility
    if (userId && customerType) {
      if (isRetailer) {
        query += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'retailers')`;
      } else if (isWholesaler) {
        query += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'wholesalers')`;
      } else {
        query += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
      }
    } else {
      query += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
    }

    query += `
      ORDER BY p.product_id DESC
      LIMIT $1
    `;

    const result = await this.dataSource.query(query, [Number(limit)]);

    // Get product-specific discounts
    let productDiscountsMap = new Map<number, number>();
    if (userId) {
      try {
        // Get customer_id
        const customerQuery = await this.dataSource.query(
          `SELECT customer_id FROM customer WHERE user_id = $1`,
          [userId],
        );
        
        if (customerQuery.length > 0) {
          const customerId = customerQuery[0].customer_id;
          
          // Get product-level discounts from customer_product_discount table
          const productDiscountQuery = `
            SELECT product_id, discount_percentage
            FROM customer_product_discount
            WHERE customer_id = $1
          `;
          const productDiscountResult = await this.dataSource.query(productDiscountQuery, [customerId]);
          productDiscountResult.forEach((row: any) => {
            if (row.discount_percentage > 0) {
              productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
            }
          });
        }
      } catch (error) {
        this.logger.error('Error fetching customer discounts:', error);
      }
    }

    // Apply pricing
    const productsWithDiscount = result.map((product: any) => {
      const retailPrice = parseFloat(product.product_price || 0);
      const wholesalePrice = product.retail_price ? parseFloat(product.retail_price || 0) : null;
      const retailDiscountPercentage = product.retail_discount_percentage ? parseFloat(product.retail_discount_percentage) : null;

      const productDiscount = productDiscountsMap.get(product.product_id) || discountPercentage;

      // Use pricing service for consistent calculations
      const pricing = this.pricingService.calculateProductPrice(
        retailPrice,
        wholesalePrice,
        retailDiscountPercentage,
        isWholesaler,
        productDiscount,
      );

      return {
        ...product,
        product_price: pricing.finalPrice.toFixed(2),
        original_price: pricing.originalPrice,
        discounted_price: pricing.finalPrice,
        discount_percentage: pricing.discountPercentage,
        has_discount: pricing.hasDiscount,
        wholesale_price: pricing.wholesalePrice,
        base_price: pricing.basePrice,
        is_wholesale: pricing.isWholesale,
      };
    });

    return { products: productsWithDiscount };
  }

  /**
   * Get featured products by featured flag (featured_1 or featured_2)
   */
  async getFeaturedProductsByFlag(featuredFlag: 'featured_1' | 'featured_2', limit: number = 4, authHeader?: string) {
    // Get user from token if provided
    let userId: number | null = null;
    let discountPercentage = 0;
    let customerType: string | null = null;

    userId = this.extractUserIdFromToken(authHeader);
    if (userId) {
      discountPercentage = await this.getCustomerDiscount(userId);
      const customerTypeQuery = await this.dataSource.query(
        `SELECT customer_type FROM customer WHERE user_id = $1`,
        [userId],
      );
      if (customerTypeQuery.length > 0) {
        customerType = customerTypeQuery[0].customer_type || null;
      }
    }

    const isRetailer = customerType ? customerType.toLowerCase().trim() === 'retail' : false;
    const isWholesaler = customerType ? (
      customerType.toLowerCase().includes('wholesale') ||
      customerType.toLowerCase().includes('wholesaler') ||
      customerType.toLowerCase().startsWith('full service') ||
      customerType.toLowerCase().startsWith('partial service')
    ) : false;

    // Check if featured columns exist
    const featuredCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'product' 
      AND column_name IN('featured_1', 'featured_2')
      `);
    const hasFeatured1 = featuredCheck.some((row: any) => row.column_name === 'featured_1');
    const hasFeatured2 = featuredCheck.some((row: any) => row.column_name === 'featured_2');

    if ((featuredFlag === 'featured_1' && !hasFeatured1) || (featuredFlag === 'featured_2' && !hasFeatured2)) {
      // Fallback to regular featured products if column doesn't exist
      return this.getFeaturedProducts(limit, authHeader);
    }

    // Build query with proper column name - use string concatenation for column name
    const featuredColumn = featuredFlag === 'featured_1' ? 'featured_1' : 'featured_2';

    // Use proper SQL identifier quoting for column name
    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_description,
        p.product_price,
        p.retail_price,
        p.customer_type_visibility,
        p.product_image,
        p.product_status,
        p.info_description,
        p.subcategory_id,
        (
          SELECT ph.heading 
          FROM product_header ph 
          JOIN heading_product hp ON ph.heading_id = hp.heading_id 
          WHERE hp.product_id = p.product_id 
          LIMIT 1
        ) as header_name,
        COALESCE(
          (SELECT c.category_name FROM category c WHERE c.category_id = p.subcategory_id),
          (SELECT c.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as subcategory_name,
        COALESCE(
          (SELECT cp.category_name FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_name FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_name,
        COALESCE(
          (SELECT cp.category_id FROM category c JOIN category cp ON c.parent_category_id = cp.category_id WHERE c.category_id = p.subcategory_id),
          (SELECT cp.category_id FROM product_category pc JOIN category c ON pc.category_id = c.category_id JOIN category cp ON c.parent_category_id = cp.category_id WHERE pc.product_id = p.product_id LIMIT 1)
        ) as parent_category_id,
        (
          SELECT json_agg(json_build_object('category_id', c.category_id, 'category_name', c.category_name) ORDER BY c.sort_order ASC, c.category_name ASC)
          FROM product_category pc
          JOIN category c ON pc.category_id = c.category_id
          WHERE pc.product_id = p.product_id
        ) as categories,
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
      WHERE p.product_status = 1 AND p.show_in_storefront = true
        AND p.${featuredColumn} = true
    `;

    // Filter by customer type visibility
    if (userId && customerType) {
      if (isRetailer) {
        query += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'retailers')`;
      } else if (isWholesaler) {
        query += ` AND (LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all' OR LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'wholesalers')`;
      } else {
        query += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
      }
    } else {
      query += ` AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'`;
    }

    query += `
      ORDER BY p.product_id DESC
      LIMIT $1
    `;

    const result = await this.dataSource.query(query, [Number(limit)]);

    // Get product-specific discounts
    let productDiscountsMap = new Map<number, number>();
    if (userId) {
      try {
        // Get customer_id
        const customerQuery = await this.dataSource.query(
          `SELECT customer_id FROM customer WHERE user_id = $1`,
          [userId],
        );
        
        if (customerQuery.length > 0) {
          const customerId = customerQuery[0].customer_id;
          
          // Get product-level discounts from customer_product_discount table
          const productDiscountQuery = `
            SELECT product_id, discount_percentage
            FROM customer_product_discount
            WHERE customer_id = $1
          `;
          const productDiscountResult = await this.dataSource.query(productDiscountQuery, [customerId]);
          productDiscountResult.forEach((row: any) => {
            if (row.discount_percentage > 0) {
              productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
            }
          });
        }
      } catch (error) {
        this.logger.error('Error fetching customer discounts:', error);
      }
    }

    // Apply pricing (same logic as getFeaturedProducts)
    const productsWithDiscount = result.map((product: any) => {
      const retailPrice = parseFloat(product.product_price || 0);
      const wholesalePrice = product.retail_price ? parseFloat(product.retail_price || 0) : null;
      const retailDiscountPercentage = product.retail_discount_percentage ? parseFloat(product.retail_discount_percentage) : null;

      const productDiscount = productDiscountsMap.get(product.product_id) || discountPercentage;

      // Use pricing service for consistent calculations
      const pricing = this.pricingService.calculateProductPrice(
        retailPrice,
        wholesalePrice,
        retailDiscountPercentage,
        isWholesaler,
        productDiscount,
      );

      return {
        ...product,
        product_price: pricing.finalPrice.toFixed(2),
        original_price: pricing.originalPrice,
        discounted_price: pricing.finalPrice,
        discount_percentage: pricing.discountPercentage,
        has_discount: pricing.hasDiscount,
        wholesale_price: pricing.wholesalePrice,
        base_price: pricing.basePrice,
        is_wholesale: pricing.isWholesale,
      };
    });

    return { products: productsWithDiscount };
  }

  /**
   * Get reviews for a product
   */
  async getProductReviews(id: number, limit: number = 10, offset: number = 0) {
    const query = `
    SELECT
    r.review_id,
      r.product_id,
      r.customer_id,
      r.rating,
      r.review_text,
      r.reviewer_name,
      r.created_at,
      c.firstname,
      c.lastname,
      c.email
      FROM product_review r
      LEFT JOIN customer c ON r.customer_id = c.customer_id
      WHERE r.product_id = $1 AND r.status = 1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
      `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM product_review
      WHERE product_id = $1 AND status = 1
      `;

    const [reviewsResult, countResult] = await Promise.all([
      this.dataSource.query(query, [id, Number(limit), Number(offset)]),
      this.dataSource.query(countQuery, [id]),
    ]);

    const reviews = reviewsResult.map((review: any) => ({
      review_id: review.review_id,
      product_id: review.product_id,
      customer_id: review.customer_id,
      rating: review.rating,
      review_text: review.review_text,
      reviewer_name: review.reviewer_name ||
        (review.firstname && review.lastname ? `${review.firstname} ${review.lastname} ` : 'Anonymous'),
      created_at: review.created_at,
    }));

    return {
      reviews,
      total: parseInt(countResult[0].total),
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  /**
   * Submit a product review
   */
  async submitProductReview(
    id: number,
    reviewData: {
      rating: number;
      review_text: string;
      reviewer_name?: string;
      reviewer_email?: string;
    },
    authHeader?: string,
  ) {
    const { rating, review_text, reviewer_name, reviewer_email } = reviewData;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    if (!review_text || review_text.trim().length === 0) {
      throw new BadRequestException('Review text is required');
    }

    if (review_text.trim().length < 10) {
      throw new BadRequestException('Review text must be at least 10 characters');
    }

    // Get user from token if provided
    let userId: number | null = null;
    userId = this.extractUserIdFromToken(authHeader);

    // Get customer_id if user is logged in
    let customerId = null;
    if (userId) {
      const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1 LIMIT 1`;
      const customerResult = await this.dataSource.query(customerQuery, [userId]);
      if (customerResult.length > 0) {
        customerId = customerResult[0].customer_id;
      }
    }

    // Check if product exists
    const productQuery = `SELECT product_id FROM product WHERE product_id = $1 AND product_status = 1 AND show_in_storefront = true`;
    const productResult = await this.dataSource.query(productQuery, [id]);
    if (productResult.length === 0) {
      throw new NotFoundException('Product not found');
    }

    // Check if user already reviewed this product (if logged in)
    if (customerId) {
      const existingReviewQuery = `
        SELECT review_id FROM product_review 
        WHERE product_id = $1 AND customer_id = $2
      `;
      const existingReview = await this.dataSource.query(existingReviewQuery, [id, customerId]);
      if (existingReview.length > 0) {
        throw new BadRequestException('You have already reviewed this product');
      }
    }

    // Insert review
    const insertQuery = `
      INSERT INTO product_review(
        product_id,
        customer_id,
        user_id,
        rating,
        review_text,
        reviewer_name,
        reviewer_email,
        status
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING review_id, created_at
      `;

    const status = 0; // Pending approval - admin must review and publish

    const result = await this.dataSource.query(insertQuery, [
      id,
      customerId,
      userId || null,
      rating,
      review_text.trim(),
      reviewer_name || null,
      reviewer_email || null,
      status,
    ]);

    return {
      message: 'Review submitted successfully',
      review: {
        review_id: result[0].review_id,
        product_id: parseInt(id.toString()),
        rating,
        review_text: review_text.trim(),
        reviewer_name: reviewer_name || 'Anonymous',
        created_at: result[0].created_at,
      },
    };
  }
}
