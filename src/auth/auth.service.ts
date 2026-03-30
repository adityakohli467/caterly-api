import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/User';
import { Customer } from '../entities/Customer';
import { Company } from '../entities/Company';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailService } from '../common/services/email.service';
import { NotificationService } from '../common/services/notification.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
      console.error('Error creating password_reset_tokens table (AuthService):', error);
    }
  }

  async login(username: string, password: string): Promise<any> {
    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    // Find user by login_username or email
    const user = await this.dataSource.query(
      `SELECT * FROM "user" WHERE (login_username = $1 OR email = $1) LIMIT 1`,
      [username],
    );

    if (!user || user.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userData = user[0];

    // Verify password
    const isValid = await bcrypt.compare(password, userData.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get customer details if user is a customer
    let customer = null;
    if (userData.is_customer === 1 || userData.auth_level >= 3) {
      const customerResult = await this.dataSource.query(
        `SELECT c.*, co.company_name, d.department_name
         FROM customer c
         LEFT JOIN company co ON c.company_id = co.company_id
         LEFT JOIN department d ON c.department_id = d.department_id
         WHERE c.user_id = $1`,
        [userData.user_id],
      );
      customer = customerResult[0] || null;
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      user_id: userData.user_id,
      email: userData.email,
      auth_level: userData.auth_level,
      username: userData.username,
      customer_id: (customer as any)?.customer_id,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = userData;

    return {
      token,
      user: userWithoutPassword,
      customer,
      expiresIn: 14400, // 4 hours in seconds
    };
  }

  async register(registerDto: any): Promise<any> {
    const {
      email,
      username,
      password,
      firstname,
      lastname,
      telephone,
      login_username,
      auth_level = 3,
      is_customer = false,
      company_id,
      department_id,
      company_name,
      address_line1,
      address_line2,
      suburb,
      postal_code,
      state,
    } = registerDto;

    if (!email || !username || !password) {
      throw new BadRequestException('Email, username, and password are required');
    }

    // For customers, require firstname and lastname (check for empty strings too)
    if ((is_customer || auth_level >= 3) && (!firstname || !lastname || firstname.trim() === "" || lastname.trim() === "")) {
      throw new BadRequestException('First name and last name are required for customer registration');
    }

    // Check if user already exists
    const existingUser = await this.dataSource.query(
      `SELECT user_id FROM "user" WHERE email = $1 OR login_username = $2`,
      [email, login_username || username],
    );

    if (existingUser.length > 0) {
      throw new BadRequestException('User already exists with this email or username');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine auth_level and is_customer
    const finalAuthLevel = is_customer ? 3 : auth_level;
    const finalIsCustomer = is_customer ? 1 : 0;

    // Create user
    const userResult = await this.dataSource.query(
      `INSERT INTO "user" (email, username, login_username, password, auth_level, is_customer)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        email,
        firstname && lastname ? `${firstname} ${lastname}` : username,
        login_username || username,
        hashedPassword,
        finalAuthLevel,
        finalIsCustomer,
      ],
    );

    const user = userResult[0];
    let finalCompanyId = company_id || null;
    let customer = null;

    // Create company if wholesaler and company_name provided
    if (company_name) {
      const addressParts = [address_line1, address_line2, suburb, state, postal_code].filter(Boolean);
      const fullAddress = addressParts.join(', ');

      const companyResult = await this.dataSource.query(
        `INSERT INTO company (user_id, company_name, company_address, company_status, created_from)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING company_id`,
        [user.user_id, company_name, fullAddress || null, 1, 'storefront_registration'],
      );

      finalCompanyId = companyResult[0].company_id;
    }

    // Create customer record if customer
    if (finalIsCustomer === 1 || finalAuthLevel >= 3) {
      const addressParts = [address_line1, address_line2, suburb, state, postal_code].filter(Boolean);
      const customerAddress = addressParts.join(', ');

      const approved = !company_name; // Regular customers auto-approved

      const customerResult = await this.dataSource.query(
        `INSERT INTO customer (user_id, firstname, lastname, email, telephone, company_id, department_id, customer_address, customer_date_added, status, approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 1, $9)
         RETURNING *`,
        [
          user.user_id,
          firstname,
          lastname,
          email,
          telephone || null,
          finalCompanyId,
          department_id || null,
          customerAddress || null,
          approved,
        ],
      );

      customer = customerResult[0];
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      user_id: user.user_id,
      email: user.email,
      auth_level: user.auth_level,
      username: user.username,
      customer_id: (customer as any)?.customer_id,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
      customer,
      message: company_name
        ? 'Registration successful. Your account is pending approval.'
        : 'Registration successful',
      expiresIn: 604800,
    };
  }

  async getCurrentUser(userId: number): Promise<any> {
    const userResult = await this.dataSource.query(
      `SELECT user_id, email, username, login_username, auth_level, merchant_id, merchant_pass, abn,
              company_name, account_name, account_number, bsb, user_com_addr, account_email,
              account_uid, guid, is_customer, created_at, updated_at
       FROM "user"
       WHERE user_id = $1`,
      [userId],
    );

    if (!userResult || userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult[0];

    // Get customer details if user is a customer
    let customer = null;
    if (user.is_customer === 1 || user.auth_level === 3) {
      const customerResult = await this.dataSource.query(
        `SELECT c.customer_id, c.firstname, c.lastname, c.email, c.telephone,
                c.customer_date_added, c.status, c.approved,
                co.company_name, d.department_name
         FROM customer c
         LEFT JOIN company co ON c.company_id = co.company_id
         LEFT JOIN department d ON c.department_id = d.department_id
         WHERE c.user_id = $1`,
        [userId],
      );
      customer = customerResult[0] || null;
    }

    return {
      user,
      customer,
    };
  }

  async forgotPassword(email: string): Promise<any> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Find user by email
    const userResult = await this.dataSource.query(
      `SELECT user_id, email, username FROM "user" 
       WHERE email = $1 AND (auth_level >= 3 OR is_customer = 1) LIMIT 1`,
      [email],
    );

    // Always return success to prevent email enumeration
    if (!userResult || userResult.length === 0) {
      return {
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }

    const user = userResult[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Delete any existing tokens for this user
    await this.dataSource.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.user_id]);

    // Save reset token
    await this.dataSource.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.user_id, resetToken, expiresAt],
    );

    // Send reset email - use appropriate portal based on user level
    const isAdmin = user.auth_level < 3;
    const portalUrl = isAdmin
      ? this.configService.get<string>('ADMIN_PORTAL_URL')
      : this.configService.get<string>('STORE_PORTAL_URL');

    const frontendUrl = portalUrl || this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
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
        const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
        const contactNumber = this.configService.get<string>('COMPANY_PHONE') || '';
        const contactEmail = this.configService.get<string>('COMPANY_EMAIL') || '';

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

  async verifyResetToken(token: string): Promise<any> {
    const tokenResult = await this.dataSource.query(
      `SELECT prt.*, u.email FROM password_reset_tokens prt
       JOIN "user" u ON prt.user_id = u.user_id
       WHERE prt.token = $1 AND prt.used = FALSE`,
      [token],
    );

    if (!tokenResult || tokenResult.length === 0) {
      throw new BadRequestException('Invalid token');
    }

    const tokenData = tokenResult[0];

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    return {
      valid: true,
      email: tokenData.email,
    };
  }

  async resetPassword(token: string, password: string): Promise<any> {
    if (!token || !password) {
      throw new BadRequestException('Token and password are required');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Find token
    const tokenResult = await this.dataSource.query(
      `SELECT prt.*, u.user_id, u.email FROM password_reset_tokens prt
       JOIN "user" u ON prt.user_id = u.user_id
       WHERE prt.token = $1 AND prt.used = FALSE`,
      [token],
    );

    if (!tokenResult || tokenResult.length === 0) {
      throw new BadRequestException('Invalid or expired token');
    }

    const tokenData = tokenResult[0];

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await this.dataSource.query(
      `UPDATE "user" SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [hashedPassword, tokenData.user_id],
    );

    // Mark token as used
    await this.dataSource.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [tokenData.id]);

    return {
      message: 'Password reset successfully',
    };
  }
}

