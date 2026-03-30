import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../../common/services/email.service';
import { NotificationService } from '../../common/services/notification.service';

@Injectable()
export class StoreAuthService implements OnModuleInit {
  constructor(
    private dataSource: DataSource,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private notificationService: NotificationService,
  ) { }

  async onModuleInit() {
    await this.createTablesIfNotExist();
  }

  private async createTablesIfNotExist() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          token VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (error) {
      console.error('Error creating password_reset_tokens table:', error);
    }
  }

  /**
   * Customer Login
   */
  async login(username: string, password: string): Promise<any> {
    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    // Find user by login_username or email
    const query = `
      SELECT * FROM "user" 
      WHERE (login_username = $1 OR email = $1)
      LIMIT 1
    `;
    const result = await this.dataSource.query(query, [username]);
    const user = result[0];

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is customer (auth_level >= 3 or is_customer = 1)
    if (user.auth_level < 3 && user.is_customer !== 1) {
      throw new ForbiddenException('Access denied. Customer account required.');
    }

    // Get customer details
    const customerQuery = `
      SELECT 
        c.*,
        co.company_name,
        d.department_name
      FROM customer c
      LEFT JOIN company co ON c.company_id = co.company_id
      LEFT JOIN department d ON c.department_id = d.department_id
      WHERE c.user_id = $1
    `;
    const customerResult = await this.dataSource.query(customerQuery, [user.user_id]);
    const customer = customerResult[0] || null;

    // Generate JWT token
    const token = this.jwtService.sign({
      user_id: user.user_id,
      email: user.email,
      auth_level: user.auth_level,
      username: user.username,
      customer_id: customer?.customer_id,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
      customer,
      expiresIn: 14400, // 4 hours in seconds
    };
  }

  /**
   * Customer Registration
   */
  async register(registerDto: {
    email: string;
    username: string;
    password: string;
    firstname: string;
    lastname: string;
    telephone?: string;
    company_id?: number;
    department_id?: number;
    company_name?: string;
    address_line1?: string;
    address_line2?: string;
    suburb?: string;
    postal_code?: string;
    state?: string;
    service_type?: string;
    estimated_opening_date?: string;
    preferred_contact_method?: string;
    business_type?: string;
    wholesale_type?: string;
  }): Promise<any> {
    const {
      email,
      username,
      password,
      firstname,
      lastname,
      telephone,
      company_id,
      department_id,
      company_name,
      address_line1,
      address_line2,
      suburb,
      postal_code,
      state,
      service_type,
      estimated_opening_date,
      preferred_contact_method,
      business_type,
      wholesale_type,
    } = registerDto;

    if (!email || !username || !password || !firstname || !lastname) {
      throw new BadRequestException('All required fields must be provided');
    }

    // Check if user already exists
    const checkQuery = `
      SELECT user_id FROM "user" 
      WHERE email = $1 OR login_username = $2
    `;
    const checkResult = await this.dataSource.query(checkQuery, [email, username]);

    if (checkResult.length > 0) {
      throw new BadRequestException('User already exists with this email or username');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userQuery = `
      INSERT INTO "user" (
        email,
        username,
        login_username,
        password,
        auth_level,
        is_customer
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const userResult = await this.dataSource.query(userQuery, [
      email,
      `${firstname} ${lastname}`,
      username,
      hashedPassword,
      3, // Customer auth level
      1, // is_customer flag
    ]);

    const user = userResult[0];
    let finalCompanyId = company_id || null;

    // Create company if wholesaler and company_name provided
    if (company_name) {
      const addressParts = [
        address_line1,
        address_line2,
        suburb,
        state,
        postal_code,
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ');

      const companyQuery = `
        INSERT INTO company (
          user_id,
          company_name,
          company_address,
          company_status,
          created_from
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING company_id
      `;

      const companyResult = await this.dataSource.query(companyQuery, [
        user.user_id,
        company_name,
        fullAddress || null,
        1, // Active
        'storefront_registration',
      ]);

      finalCompanyId = companyResult[0].company_id;
    }

    // Build customer address
    const addressParts = [
      address_line1,
      address_line2,
      suburb,
      state,
      postal_code,
    ].filter(Boolean);
    const customerAddress = addressParts.join(', ');

    // Check which columns exist in customer table
    const columnCheck = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer' 
      AND column_name IN ('service_type', 'estimated_opening_date', 'preferred_contact_method', 'business_type', 'wholesale_type', 'customer_type')
    `);
    const existingColumns = columnCheck.map((row: any) => row.column_name);
    const hasServiceType = existingColumns.includes('service_type');
    const hasEstimatedOpeningDate = existingColumns.includes('estimated_opening_date');
    const hasPreferredContactMethod = existingColumns.includes('preferred_contact_method');
    const hasBusinessType = existingColumns.includes('business_type');
    const hasWholesaleType = existingColumns.includes('wholesale_type');
    const hasCustomerType = existingColumns.includes('customer_type');

    // Build columns and values arrays
    const columns = [
      'user_id',
      'firstname',
      'lastname',
      'email',
      'telephone',
      'company_id',
      'department_id',
      'customer_address',
      'customer_date_added',
      'status',
      'approved',
      'created_from'
    ];
    const values: any[] = [
      user.user_id,
      firstname,
      lastname,
      email,
      telephone || null,
      finalCompanyId,
      department_id || null,
      customerAddress || null,
      null, // Will be replaced with NOW()
      1,
      !company_name ? true : false, // Regular customers auto-approved, wholesalers need approval
      'storefront'
    ];

    // Add optional columns if they exist
    if (hasServiceType && service_type) {
      columns.push('service_type');
      values.push(service_type);
    }
    if (hasEstimatedOpeningDate && estimated_opening_date) {
      columns.push('estimated_opening_date');
      values.push(estimated_opening_date);
    }
    if (hasPreferredContactMethod && preferred_contact_method) {
      columns.push('preferred_contact_method');
      values.push(preferred_contact_method);
    }
    if (hasBusinessType && business_type) {
      columns.push('business_type');
      values.push(business_type);
    }
    if (hasWholesaleType && wholesale_type) {
      columns.push('wholesale_type');
      values.push(wholesale_type);
    }
    if (hasCustomerType && company_name) {
      // Set customer_type based on service_type
      let customerTypeValue = 'Retail';
      if (service_type === 'Full Service Wholesaler') {
        customerTypeValue = 'Full Service Wholesale';
      } else if (service_type === 'Half Service') {
        customerTypeValue = 'Partial Service Wholesale';
      }
      columns.push('customer_type');
      values.push(customerTypeValue);
    }

    // Build placeholders - NOW() for customer_date_added, $N for others
    const placeholders: string[] = [];
    let paramIndex = 1;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] === 'customer_date_added') {
        placeholders.push('NOW()');
      } else {
        placeholders.push(`$${paramIndex}`);
        paramIndex++;
      }
    }

    // Remove null from values array where NOW() is used
    const finalValues = values.filter((val, idx) => columns[idx] !== 'customer_date_added');

    const customerQuery = `
      INSERT INTO customer (
        ${columns.join(', ')}
      ) VALUES (
        ${placeholders.join(', ')}
      )
      RETURNING *
    `;

    const customerResult = await this.dataSource.query(customerQuery, finalValues);

    const customer = customerResult[0];

    // Send registration notification email
    try {
      const customerName = `${firstname} ${lastname}`;
      const frontendUrl = this.configService.get<string>('STORE_PORTAL_URL') || this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/auth/login`;
      const contactNumber = this.configService.get<string>('COMPANY_PHONE') || '';
      const contactEmail = this.configService.get<string>('ADMIN_EMAIL') || this.configService.get<string>('COMPANY_EMAIL') || '';
      const companyNameVar = this.configService.get<string>('COMPANY_NAME') || 'Caterly';

      // Always send regular customer registration since Caterly only has retailers
      const logoAttachment = this.emailService.getLogoAttachment();
      
      await this.notificationService.sendNotification({
        templateKey: 'customer_registration',
        recipientEmail: email,
        recipientName: customerName,
        variables: {},
        attachments: logoAttachment ? [logoAttachment] : [],
        customSubject: `Welcome to ${companyNameVar} – Your Account is Ready`,
        customBody: (() => {
          return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .content { padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #E03A3E; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    Welcome to ${companyNameVar}! Your retailer account has been successfully created.
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? `<img src="cid:logo" alt="${companyNameVar}" style="max-width: 200px; height: auto;">` : `<h1>${companyNameVar}</h1>`}
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <p>Welcome to ${companyNameVar}.</p>
      <p>Your retailer account has been successfully created. You can now sign in to browse products, place orders, and manage your account anytime.</p>
      <div style="text-align: center;">
        <a href="${loginUrl}" class="button" style="color: white !important; text-decoration: none;">Login Here</a>
      </div>
      <p>If you have any questions, please contact us at ${contactNumber} ${contactEmail}.</p>
      <p>Kind regards,<br/>${companyNameVar} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyNameVar}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
          `;
        })(),
      });

      // Notify Admin about new Customer registration
      if (contactEmail) {
        await this.notificationService.sendNotification({
          templateKey: 'admin_new_customer_notification',
          recipientEmail: contactEmail,
          recipientName: 'Admin',
          variables: {
            customer_name: customerName,
            customer_email: email,
            telephone: telephone || 'N/A',
          },
          attachments: logoAttachment ? [logoAttachment] : [],
          customSubject: `New Customer Registration: ${customerName}`,
          customBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    A new retailer has registered: ${customerName} (${email}).
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? `<img src="cid:logo" alt="${companyNameVar}" style="max-width: 200px; height: auto;">` : `<h1>${companyNameVar}</h1>`}
      <h2>New Retailer Registration</h2>
    </div>
    <div class="content">
      <p>A new retailer has registered on the storefront.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Name:</strong> ${customerName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${telephone || 'N/A'}</p>
      </div>
      <p>They can now log in and browse products.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyNameVar}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
        });
      }
    } catch (error: any) {
      // Log error but don't fail registration
      console.error('Failed to send registration email:', error);
    }

    // Generate JWT token for auto-login
    const token = this.jwtService.sign({
      user_id: user.user_id,
      email: user.email,
      auth_level: user.auth_level,
      username: user.username,
      customer_id: customer?.customer_id,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
      customer,
      message: 'Registration successful',
      expiresIn: 14400, // 4 hours in seconds
    };
  }

  /**
   * Get current customer info
   */
  async getCurrentCustomer(userId: number): Promise<any> {
    // Get user details
    const userQuery = `
      SELECT * FROM "user" 
      WHERE user_id = $1
    `;
    const userResult = await this.dataSource.query(userQuery, [userId]);
    const user = userResult[0];

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get customer details with company and department
    const customerQuery = `
      SELECT 
        c.*,
        co.company_name,
        co.company_abn as abn,
        d.department_name
      FROM customer c
      LEFT JOIN company co ON c.company_id = co.company_id
      LEFT JOIN department d ON c.department_id = d.department_id
      WHERE c.user_id = $1
    `;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);
    const customer = customerResult[0] || null;

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      customer,
    };
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<any> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Find user by email
    const userQuery = `
      SELECT user_id, email, username 
      FROM "user" 
      WHERE email = $1 AND (auth_level >= 3 OR is_customer = 1)
      LIMIT 1
    `;
    const userResult = await this.dataSource.query(userQuery, [email]);
    const user = userResult[0];

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Delete any existing tokens for this user
    await this.dataSource.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.user_id]
    );

    // Save reset token
    await this.dataSource.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.user_id, resetToken, expiresAt]
    );

    // Send reset email - always store portal for this service
    const frontendUrl = this.configService.get<string>('STORE_PORTAL_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    const logoAttachment = this.emailService.getLogoAttachment();

    await this.notificationService.sendNotification({
      templateKey: 'forgot_password',
      recipientEmail: user.email,
      recipientName: user.username || 'Customer',
      variables: {},
      attachments: logoAttachment ? [logoAttachment] : [],
      customSubject: `Reset Your Password - ${this.configService.get<string>('COMPANY_NAME') || 'Caterly'}`,
      customBody: (() => {
        const contactNumber = this.configService.get<string>('COMPANY_PHONE') || '';
        const contactEmail = this.configService.get<string>('COMPANY_EMAIL') || '';
        const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .content { padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #E03A3E; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    A password reset has been requested for your account. If you did not request this, please ignore it.
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? `<img src="cid:logo" alt="${companyName}" style="max-width: 200px; height: auto;">` : `<h1>Reset Your Password</h1>`}
    </div>
    <div class="content">
      <p>Dear ${user.username || 'Customer'},</p>
      <p>We received a request to reset the password for your ${companyName} account.</p>
      <p>To reset your password, please click the link below:</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button" style="color: white !important; text-decoration: none;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p>If you did not request a password reset, please disregard this email.</p>
      <p>If you have any questions, please contact us at ${contactNumber} ${contactEmail}.</p>
      <p>Kind regards,<br/>${companyName} Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `;
      })(),
    });

    return {
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  }

  /**
   * Verify password reset token
   */
  async verifyResetToken(token: string): Promise<any> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Token is required');
    }

    // Find token
    const tokenQuery = `
      SELECT prt.*, u.email, u.username
      FROM password_reset_tokens prt
      JOIN "user" u ON prt.user_id = u.user_id
      WHERE prt.token = $1 AND prt.used = FALSE
    `;
    const tokenResult = await this.dataSource.query(tokenQuery, [token]);
    const tokenData = tokenResult[0];

    if (!tokenData) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    return {
      valid: true,
      message: 'Token is valid',
      email: tokenData.email,
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, password: string): Promise<any> {
    if (!token || !password) {
      throw new BadRequestException('Token and password are required');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Find token
    const tokenQuery = `
      SELECT prt.*, u.user_id, u.email
      FROM password_reset_tokens prt
      JOIN "user" u ON prt.user_id = u.user_id
      WHERE prt.token = $1 AND prt.used = FALSE
    `;
    const tokenResult = await this.dataSource.query(tokenQuery, [token]);
    const tokenData = tokenResult[0];

    if (!tokenData) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await this.dataSource.query(
      'UPDATE "user" SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [hashedPassword, tokenData.user_id]
    );

    // Mark token as used
    await this.dataSource.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1',
      [tokenData.id]
    );

    return {
      message: 'Password reset successfully',
    };
  }

  /**
   * Update password for authenticated user
   */
  async updatePassword(userId: number, currentPassword: string, newPassword: string): Promise<any> {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    // Get user
    const userQuery = `SELECT user_id, password FROM "user" WHERE user_id = $1`;
    const userResult = await this.dataSource.query(userQuery, [userId]);
    const user = userResult[0];

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.dataSource.query(
      'UPDATE "user" SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [hashedPassword, userId]
    );

    return {
      message: 'Password updated successfully',
    };
  }
}

