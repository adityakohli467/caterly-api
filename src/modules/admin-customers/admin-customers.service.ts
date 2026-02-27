import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Customer } from '../../entities/Customer';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class AdminCustomersService {
  private readonly logger = new Logger(AdminCustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private dataSource: DataSource,
    private configService: ConfigService,
    private emailService: EmailService,
  ) { }

  async findAll(query: any): Promise<any> {
    const { limit = 20, offset = 0, search, company_id, customer_type, archived = 'false', department_id, exclude_pending_approval } = query;

    // Check which columns exist
    const columnCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('customer_type', 'archived', 'department_id', 'discount_percentage', 'wholesale_discount_percentage')
    `);
    const existingColumns = columnCheck.map((row: any) => row.column_name);
    const hasCustomerType = existingColumns.includes('customer_type');
    const hasArchived = existingColumns.includes('archived');
    const hasDepartmentId = existingColumns.includes('department_id');
    const hasDiscountPercentage = existingColumns.includes('discount_percentage');
    const hasWholesaleDiscountPercentage = existingColumns.includes('wholesale_discount_percentage');

    const discountColumn = hasDiscountPercentage
      ? 'c.discount_percentage'
      : hasWholesaleDiscountPercentage
        ? 'c.wholesale_discount_percentage'
        : 'NULL';

    // Check if created_from and approved columns exist
    const createdFromCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('created_from', 'approved')
    `);
    const hasCreatedFrom = createdFromCheck.some((row: any) => row.column_name === 'created_from');
    const hasApproved = createdFromCheck.some((row: any) => row.column_name === 'approved');

    let sqlQuery = `
      SELECT 
        c.*,
        ${discountColumn} as discount_percentage,
        co.company_name,
        ${hasDepartmentId ? 'd.department_name,' : 'NULL as department_name,'}
        u.email as user_email,
        u.username as user_username,
        ${hasCreatedFrom ? 'c.created_from' : "'admin' as created_from"},
        ${hasApproved ? 'COALESCE(c.approved, false) as approved' : 'false as approved'}
      FROM customer c
      LEFT JOIN company co ON c.company_id = co.company_id
      ${hasDepartmentId ? 'LEFT JOIN department d ON c.department_id = d.department_id' : ''}
      LEFT JOIN "user" u ON c.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND (c.firstname ILIKE $${paramIndex} OR c.lastname ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.telephone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (company_id) {
      sqlQuery += ` AND c.company_id = $${paramIndex}`;
      params.push(Number(company_id));
      paramIndex++;
    }

    if (customer_type && customer_type.trim() !== '' && hasCustomerType) {
      sqlQuery += ` AND c.customer_type = $${paramIndex}`;
      params.push(customer_type.trim());
      paramIndex++;
    }

    if (department_id && hasDepartmentId) {
      sqlQuery += ` AND c.department_id = $${paramIndex}`;
      params.push(Number(department_id));
      paramIndex++;
    }

    if (hasArchived) {
      const isArchived = archived === 'true';
      sqlQuery += ` AND COALESCE(c.archived, false) = $${paramIndex}`;
      params.push(isArchived);
      paramIndex++;
    }

    // Exclude pending approval customers if requested (all customers with approved = false)
    if (exclude_pending_approval === 'true' && hasApproved) {
      sqlQuery += ` AND COALESCE(c.approved, true) = true`;
    }

    sqlQuery += ' ORDER BY c.customer_date_added DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    // Get count
    let countQuery = 'SELECT COUNT(*) FROM customer c WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (c.firstname ILIKE $${countParamIndex} OR c.lastname ILIKE $${countParamIndex} OR c.email ILIKE $${countParamIndex} OR c.telephone ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (company_id) {
      countQuery += ` AND c.company_id = $${countParamIndex}`;
      countParams.push(Number(company_id));
      countParamIndex++;
    }

    if (customer_type && customer_type.trim() !== '' && hasCustomerType) {
      countQuery += ` AND c.customer_type = $${countParamIndex}`;
      countParams.push(customer_type.trim());
      countParamIndex++;
    }

    if (department_id && hasDepartmentId) {
      countQuery += ` AND c.department_id = $${countParamIndex}`;
      countParams.push(Number(department_id));
      countParamIndex++;
    }

    if (hasArchived) {
      const isArchived = archived === 'true';
      countQuery += ` AND COALESCE(c.archived, false) = $${countParamIndex}`;
      countParams.push(isArchived);
    }

    // Exclude pending approval customers if requested (all customers with approved = false)
    if (exclude_pending_approval === 'true' && hasApproved) {
      countQuery += ` AND COALESCE(c.approved, true) = true`;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    // Transform the result to nest company and department data
    const customers = result.map((row: any) => ({
      ...row,
      company: row.company_id && row.company_name ? {
        company_id: row.company_id,
        company_name: row.company_name
      } : null,
      department: row.department_id && row.department_name ? {
        department_id: row.department_id,
        department_name: row.department_name
      } : null,
      // Remove flat fields to avoid confusion
      company_name: undefined,
      department_name: undefined,
    }));

    return { customers, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number): Promise<any> {
    const columnCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('department_id', 'discount_percentage', 'wholesale_discount_percentage')
    `);
    const hasDepartmentId = columnCheck.some((row: any) => row.column_name === 'department_id');
    const hasDiscountPercentage = columnCheck.some((row: any) => row.column_name === 'discount_percentage');
    const hasWholesaleDiscountPercentage = columnCheck.some((row: any) => row.column_name === 'wholesale_discount_percentage');

    const discountColumn = hasDiscountPercentage
      ? 'c.discount_percentage'
      : hasWholesaleDiscountPercentage
        ? 'c.wholesale_discount_percentage'
        : 'NULL';

    const result = await this.dataSource.query(
      `
      SELECT 
        c.*,
        ${discountColumn} as discount_percentage,
        co.company_name,
        ${hasDepartmentId ? 'd.department_name,' : 'NULL as department_name,'}
        u.email as user_email,
        u.username as user_username
      FROM customer c
      LEFT JOIN company co ON c.company_id = co.company_id
      ${hasDepartmentId ? 'LEFT JOIN department d ON c.department_id = d.department_id' : ''}
      LEFT JOIN "user" u ON c.user_id = u.user_id
      WHERE c.customer_id = $1
    `,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    return { customer: result[0] };
  }

  async create(createCustomerDto: any): Promise<any> {
    const {
      firstname,
      lastname,
      email,
      telephone,
      customer_address,
      customer_type,
      customer_notes,
      customer_cost_centre,
      company_id,
      department_id,
      status,
      archived,
      discount_percentage,
    } = createCustomerDto;

    if (!firstname || !firstname.trim()) {
      throw new BadRequestException('First name is required');
    }

    if (!lastname || !lastname.trim()) {
      throw new BadRequestException('Last name is required');
    }

    // Check which discount column exists
    const columnCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('discount_percentage', 'wholesale_discount_percentage')
    `);
    const hasDiscountPercentage = columnCheck.some((row: any) => row.column_name === 'discount_percentage');
    const hasWholesaleDiscountPercentage = columnCheck.some((row: any) => row.column_name === 'wholesale_discount_percentage');

    const discountColumn = hasDiscountPercentage ? 'discount_percentage' : hasWholesaleDiscountPercentage ? 'wholesale_discount_percentage' : null;

    // Check if created_from column exists
    const createdFromCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name = 'created_from'
    `);
    const hasCreatedFrom = createdFromCheck.length > 0;

    // Check if approved column exists
    const approvedCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name = 'approved'
    `);
    const hasApproved = approvedCheck.length > 0;

    // Build dynamic query parts
    const columns: string[] = [
      'firstname', 'lastname', 'email', 'telephone', 'customer_address',
      'company_id', 'department_id', 'customer_type', 'customer_notes',
      'customer_cost_centre', 'status'
    ];
    const placeholders: string[] = [];
    const values: any[] = [
      firstname.trim(),
      lastname.trim(),
      email ? email.trim() : null,
      telephone ? telephone.trim() : null,
      customer_address ? customer_address.trim() : null,
      company_id ? Number(company_id) : null,
      department_id ? Number(department_id) : null,
      customer_type || 'Retail',
      customer_notes ? customer_notes.trim() : null,
      customer_cost_centre ? customer_cost_centre.trim() : null,
      status || 1,
    ];

    let paramIndex = values.length + 1;

    if (discountColumn) {
      columns.push(discountColumn);
      const discountValue =
        discount_percentage !== undefined && discount_percentage !== null && discount_percentage !== ''
          ? discount_percentage >= 0 && discount_percentage <= 100
            ? Number(discount_percentage)
            : null
          : null;
      values.push(discountValue);
      paramIndex++;
    }

    if (hasCreatedFrom) {
      columns.push('created_from');
      values.push('admin');
      paramIndex++;
    }

    // Set approved = true for admin-created customers
    if (hasApproved) {
      columns.push('approved');
      values.push(true);
      paramIndex++;
    }

    // Build placeholders
    for (let i = 1; i <= values.length; i++) {
      placeholders.push(`$${i}`);
    }

    const query = `
      INSERT INTO customer (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    try {
      const result = await this.dataSource.query(query, values);
      return { customer: result[0], message: 'Customer created successfully' };
    } catch (error: any) {
      if (error.code === '23503') {
        throw new BadRequestException('Invalid company or department ID');
      }
      if (error.code === '23505') {
        throw new BadRequestException('Customer with this email already exists');
      }
      throw error;
    }
  }

  async update(id: number, updateCustomerDto: any): Promise<any> {
    const columnCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('customer_type', 'customer_notes', 'customer_cost_centre', 'department_id', 'archived', 'discount_percentage', 'wholesale_discount_percentage')
    `);
    const existingColumns = columnCheck.map((row: any) => row.column_name);
    const hasCustomerType = existingColumns.includes('customer_type');
    const hasCustomerNotes = existingColumns.includes('customer_notes');
    const hasCostCentre = existingColumns.includes('customer_cost_centre');
    const hasDepartmentId = existingColumns.includes('department_id');
    const hasArchived = existingColumns.includes('archived');
    const hasDiscountPercentage = existingColumns.includes('discount_percentage');
    const hasWholesaleDiscountPercentage = existingColumns.includes('wholesale_discount_percentage');

    // Validate required fields if they're being updated
    if (updateCustomerDto.firstname !== undefined && (!updateCustomerDto.firstname || !updateCustomerDto.firstname.trim())) {
      throw new BadRequestException('First name is required');
    }
    if (updateCustomerDto.lastname !== undefined && (!updateCustomerDto.lastname || !updateCustomerDto.lastname.trim())) {
      throw new BadRequestException('Last name is required');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateCustomerDto.firstname !== undefined) {
      updates.push(`firstname = $${paramIndex++}`);
      values.push(updateCustomerDto.firstname.trim());
    }

    if (updateCustomerDto.lastname !== undefined) {
      updates.push(`lastname = $${paramIndex++}`);
      values.push(updateCustomerDto.lastname.trim());
    }

    updates.push(`email = $${paramIndex++}`);
    values.push(updateCustomerDto.email ? updateCustomerDto.email.trim() : null);

    updates.push(`telephone = $${paramIndex++}`);
    values.push(updateCustomerDto.telephone ? updateCustomerDto.telephone.trim() : null);

    updates.push(`customer_address = $${paramIndex++}`);
    values.push(updateCustomerDto.customer_address ? updateCustomerDto.customer_address.trim() : null);

    updates.push(`company_id = $${paramIndex++}`);
    values.push(updateCustomerDto.company_id ? Number(updateCustomerDto.company_id) : null);

    if (hasCustomerType && updateCustomerDto.customer_type !== undefined) {
      updates.push(`customer_type = $${paramIndex++}`);
      values.push(updateCustomerDto.customer_type ? updateCustomerDto.customer_type.trim() : null);
    }

    if (hasCustomerNotes && updateCustomerDto.customer_notes !== undefined) {
      updates.push(`customer_notes = $${paramIndex++}`);
      values.push(updateCustomerDto.customer_notes ? updateCustomerDto.customer_notes.trim() : null);
    }

    if (hasCostCentre && updateCustomerDto.customer_cost_centre !== undefined) {
      updates.push(`customer_cost_centre = $${paramIndex++}`);
      values.push(updateCustomerDto.customer_cost_centre ? updateCustomerDto.customer_cost_centre.trim() : null);
    }

    if (hasDepartmentId && updateCustomerDto.department_id !== undefined) {
      updates.push(`department_id = $${paramIndex++}`);
      values.push(updateCustomerDto.department_id ? Number(updateCustomerDto.department_id) : null);
    }


    if (updateCustomerDto.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(updateCustomerDto.status || 1);
    }

    if (hasArchived && updateCustomerDto.archived !== undefined) {
      updates.push(`archived = $${paramIndex++}`);
      values.push(updateCustomerDto.archived === true || updateCustomerDto.archived === 'true');
    }

    if (hasDiscountPercentage && updateCustomerDto.discount_percentage !== undefined) {
      const discountValue =
        updateCustomerDto.discount_percentage === null || updateCustomerDto.discount_percentage === ''
          ? null
          : updateCustomerDto.discount_percentage >= 0 && updateCustomerDto.discount_percentage <= 100
            ? Number(updateCustomerDto.discount_percentage)
            : null;
      updates.push(`discount_percentage = $${paramIndex++}`);
      values.push(discountValue);
    } else if (hasWholesaleDiscountPercentage && updateCustomerDto.discount_percentage !== undefined) {
      const discountValue =
        updateCustomerDto.discount_percentage === null || updateCustomerDto.discount_percentage === ''
          ? null
          : updateCustomerDto.discount_percentage >= 0 && updateCustomerDto.discount_percentage <= 100
            ? Number(updateCustomerDto.discount_percentage)
            : null;
      updates.push(`wholesale_discount_percentage = $${paramIndex++}`);
      values.push(discountValue);
    }

    values.push(id);

    const query = `
      UPDATE customer SET
        ${updates.join(', ')}
      WHERE customer_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.dataSource.query(query, values);

    return { customer: result[0], message: 'Customer updated successfully' };
  }

  async archive(id: number): Promise<void> {
    await this.dataSource.query('UPDATE customer SET archived = true WHERE customer_id = $1', [id]);
  }

  async restore(id: number): Promise<void> {
    await this.dataSource.query('UPDATE customer SET archived = false WHERE customer_id = $1', [id]);
  }

  async delete(id: number): Promise<void> {
    await this.dataSource.query('DELETE FROM customer WHERE customer_id = $1', [id]);
  }

  async getWholesaleCustomers(query: any): Promise<any> {
    return this.findAll({ ...query, customer_type: 'Wholesale' });
  }

  async getCustomerProductOptionDiscounts(customerId: number): Promise<any> {
    // Get customer type to determine which price to use
    const customerQuery = `SELECT customer_type FROM customer WHERE customer_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [customerId]);
    const customer = customerResult[0];
    const isWholesale = customer?.customer_type?.includes('Wholesale') || false;

    // Get all products with their options and existing discounts
    const productsWithOptionsQuery = `
      SELECT 
        p.product_id,
        p.product_name,
        (
          SELECT json_agg(
            json_build_object(
              'product_option_id', po.product_option_id,
              'option_value_id', ov.option_value_id,
              'option_value_name', ov.name,
              'option_base_price', CASE 
                WHEN $2 = true THEN COALESCE(ov.wholesale_price, po.option_price, 0)
                ELSE COALESCE(ov.standard_price, po.option_price, 0)
              END,
              'option_price', CASE 
                WHEN $2 = true THEN COALESCE(ov.wholesale_price, po.option_price, 0)
                ELSE COALESCE(ov.standard_price, po.option_price, 0)
              END,
              'option_price_prefix', po.option_price_prefix,
              'discount_percentage', COALESCE(cpod.discount_percentage, 0),
              'customer_product_option_discount_id', cpod.customer_product_option_discount_id
            ) ORDER BY ov.sort_order
          )
          FROM product_option po
          JOIN option_value ov ON po.option_value_id = ov.option_value_id
          LEFT JOIN customer_product_option_discount cpod 
            ON cpod.customer_id = $1 
            AND cpod.product_id = p.product_id 
            AND cpod.option_value_id = ov.option_value_id
          WHERE po.product_id = p.product_id
        ) as options
      FROM product p
      WHERE p.product_status = 1
        AND EXISTS (
          SELECT 1 FROM product_option po WHERE po.product_id = p.product_id
        )
      ORDER BY p.product_name
    `;

    // Get products WITHOUT options and their product-level discounts
    const productsWithoutOptionsQuery = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_price,
        COALESCE(cpd.discount_percentage, 0) as discount_percentage,
        cpd.customer_product_discount_id
      FROM product p
      LEFT JOIN customer_product_discount cpd 
        ON cpd.customer_id = $1 
        AND cpd.product_id = p.product_id
      WHERE p.product_status = 1
        AND NOT EXISTS (
          SELECT 1 FROM product_option po WHERE po.product_id = p.product_id
        )
      ORDER BY p.product_name
    `;

    const [productsWithOptionsResult, productsWithoutOptionsResult] = await Promise.all([
      this.dataSource.query(productsWithOptionsQuery, [customerId, isWholesale]),
      this.dataSource.query(productsWithoutOptionsQuery, [customerId])
    ]);

    // Format products with options
    // Include ALL products with options, even if options array is empty/null
    const productsWithOptions = productsWithOptionsResult.map((p: any) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      options: p.options || [],
      has_options: true
    }));

    // Format products without options
    const productsWithoutOptions = productsWithoutOptionsResult.map((p: any) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      product_price: parseFloat(p.product_price || 0),
      discount_percentage: parseFloat(p.discount_percentage || 0),
      customer_product_discount_id: p.customer_product_discount_id,
      has_options: false
    }));

    return {
      products: [...productsWithOptions, ...productsWithoutOptions],
      productsWithOptions,
      productsWithoutOptions
    };
  }

  async setCustomerProductOptionDiscounts(customerId: number, discounts: any[]): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Separate option-level and product-level discounts
      const optionDiscounts = discounts.filter(d => d.option_value_id !== undefined && d.option_value_id !== null);
      const productDiscounts = discounts.filter(d => d.option_value_id === undefined || d.option_value_id === null);

      // Delete existing option-level discounts
      await queryRunner.query('DELETE FROM customer_product_option_discount WHERE customer_id = $1', [customerId]);

      // Delete existing product-level discounts
      await queryRunner.query('DELETE FROM customer_product_discount WHERE customer_id = $1', [customerId]);

      // Insert new option-level discounts
      for (const discount of optionDiscounts) {
        if (discount.discount_percentage > 0) {
          await queryRunner.query(
            `INSERT INTO customer_product_option_discount (customer_id, product_id, option_value_id, discount_percentage)
             VALUES ($1, $2, $3, $4)`,
            [customerId, discount.product_id, discount.option_value_id, discount.discount_percentage],
          );
        }
      }

      // Insert new product-level discounts
      for (const discount of productDiscounts) {
        if (discount.discount_percentage > 0) {
          await queryRunner.query(
            `INSERT INTO customer_product_discount (customer_id, product_id, discount_percentage)
             VALUES ($1, $2, $3)
             ON CONFLICT (customer_id, product_id) 
             DO UPDATE SET discount_percentage = EXCLUDED.discount_percentage, updated_at = CURRENT_TIMESTAMP`,
            [customerId, discount.product_id, discount.discount_percentage],
          );
        }
      }

      await queryRunner.commitTransaction();
      return { message: 'Product and option discounts updated successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getCustomerProductOptionDiscount(
    customerId: number,
    productId: number,
    optionValueId: number,
  ): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT * FROM customer_product_option_discount 
       WHERE customer_id = $1 AND product_id = $2 AND option_value_id = $3`,
      [customerId, productId, optionValueId],
    );
    return { discount: result[0] || null };
  }

  /**
   * Get pending approval customers (wholesale from frontend)
   */
  async getPendingApprovalCustomers(query: any): Promise<any> {
    const { limit = 20, offset = 0, search } = query;

    // Check if created_from and approved columns exist
    const createdFromCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('created_from', 'approved')
    `);
    const hasCreatedFrom = createdFromCheck.some((row: any) => row.column_name === 'created_from');
    const hasApproved = createdFromCheck.some((row: any) => row.column_name === 'approved');

    if (!hasCreatedFrom || !hasApproved) {
      return { customers: [], total: 0 };
    }

    let sqlQuery = `
      SELECT 
        c.*,
        co.company_name,
        u.email as user_email,
        u.username as user_username
      FROM customer c
      LEFT JOIN company co ON c.company_id = co.company_id
      LEFT JOIN "user" u ON c.user_id = u.user_id
      WHERE c.created_from = 'storefront' 
        AND COALESCE(c.approved, false) = false
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND (c.firstname ILIKE $${paramIndex} OR c.lastname ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR co.company_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY c.customer_date_added DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const customers = await this.dataSource.query(sqlQuery, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM customer c
      WHERE c.created_from = 'storefront' 
        AND COALESCE(c.approved, false) = false
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (c.firstname ILIKE $${countParamIndex} OR c.lastname ILIKE $${countParamIndex} OR c.email ILIKE $${countParamIndex} OR EXISTS (
        SELECT 1 FROM company co WHERE co.company_id = c.company_id AND co.company_name ILIKE $${countParamIndex}
      ))`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.total || '0', 10);

    return { customers, total };
  }

  /**
   * Approve customer (for wholesale customers from frontend)
   */
  async approveCustomer(id: number): Promise<any> {
    // Get customer details
    const customer = await this.findOne(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if approved column exists
    const approvedCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name = 'approved'
    `);
    const hasApproved = approvedCheck.some((row: any) => row.column_name === 'approved');

    if (!hasApproved) {
      throw new BadRequestException('Approval feature not available');
    }

    // Update customer approval status
    const updateQuery = `
      UPDATE customer 
      SET approved = true 
      WHERE customer_id = $1
      RETURNING *
    `;
    const result = await this.dataSource.query(updateQuery, [id]);

    // Send approval email
    try {
      await this.sendApprovalEmail(customer);
    } catch (error) {
      this.logger.error('Failed to send approval email:', error);
      // Don't fail the approval if email fails
    }

    return { customer: result[0], message: 'Customer approved successfully' };
  }

  /**
   * Reject customer (for wholesale customers from frontend)
   */
  async rejectCustomer(id: number): Promise<any> {
    // Get customer details
    const customer = await this.findOne(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if approved column exists
    const approvedCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name = 'approved'
    `);
    const hasApproved = approvedCheck.some((row: any) => row.column_name === 'approved');

    if (!hasApproved) {
      throw new BadRequestException('Approval feature not available');
    }

    // Update customer approval status to false
    const updateQuery = `
      UPDATE customer 
      SET approved = false 
      WHERE customer_id = $1
      RETURNING *
    `;
    const result = await this.dataSource.query(updateQuery, [id]);

    return { customer: result[0], message: 'Customer rejected successfully' };
  }

  /**
   * Send approval email to customer
   */
  private async sendApprovalEmail(customer: any): Promise<void> {
    const customerEmail = customer.user_email || customer.email;
    if (!customerEmail) {
      this.logger.warn('No email found for customer:', customer.customer_id);
      return;
    }

    const customerName = customer.firstname && customer.lastname
      ? `${customer.firstname} ${customer.lastname}`
      : customer.firstname || customer.user_username || 'Customer';

    const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
    const storefrontUrl = this.configService.get<string>('STOREFRONT_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'https://storefront.example.com';

    const emailSubject = `Your Wholesale Account Has Been Approved - ${companyName}`;

    const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .message { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .cta-button { display: inline-block; padding: 12px 24px; background-color: #2952E6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Approved!</h1>
          </div>
          <div class="content">
            <div class="message">
              <p>Dear ${customerName},</p>
              <p>Great news! Your wholesale account with ${companyName} has been approved.</p>
              <p>You can now log in to your account and start placing orders with your wholesale pricing.</p>
              <p>Your login credentials are:</p>
              <ul>
                <li><strong>Email:</strong> ${customerEmail}</li>
                <li><strong>Username:</strong> ${customer.user_username || customerEmail}</li>
              </ul>
              <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${storefrontUrl}/auth/login" class="cta-button">Login to Your Account</a>
            </div>
            
            <p style="font-size: 0.9em; color: #666;">
              Thank you for choosing ${companyName}!
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact us.</p>
            <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendEmail({
      to: customerEmail,
      subject: emailSubject,
      html: emailBody,
    });

    this.logger.log(`Approval email sent to ${customerEmail}`);
  }
}
