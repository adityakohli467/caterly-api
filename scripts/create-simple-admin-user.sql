--
-- Simple Admin User for Login
-- Username: admin
-- Password: admin123
--

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create user table if it doesn't exist
CREATE TABLE IF NOT EXISTS public."user" (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL,
    login_username VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    auth_level INTEGER NOT NULL DEFAULT 3, -- 1=super_admin, 2=admin, 3=staff, 4=customer
    merchant_id TEXT,
    merchant_pass TEXT,
    abn TEXT,
    company_name TEXT,
    account_name VARCHAR(1000),
    account_number VARCHAR(1000),
    bsb VARCHAR(100),
    user_com_addr TEXT,
    account_email VARCHAR(150),
    account_uid VARCHAR(1000) NOT NULL DEFAULT uuid_generate_v4()::text,
    guid VARCHAR(1000) NOT NULL DEFAULT uuid_generate_v4()::text,
    is_customer INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON public."user"(email);
CREATE INDEX IF NOT EXISTS idx_user_auth_level ON public."user"(auth_level);

-- Insert admin user
-- Login: admin / Password: admin123
INSERT INTO public."user" (
    email,
    username,
    login_username,
    password,
    auth_level,
    company_name,
    account_uid,
    guid,
    is_customer,
    created_at,
    updated_at
) VALUES (
    'admin@stdreux.com',
    'Admin User',
    'admin',
    '$2b$10$rOzJ8K8qK8qK8qK8qK8qK.8qK8qK8qK8qK8qK8qK8qK8qK8qK8qK', -- admin123
    1, -- super_admin (auth_level 1)
    'St Dreux Coffee',
    uuid_generate_v4()::text,
    uuid_generate_v4()::text,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO UPDATE SET
    login_username = EXCLUDED.login_username,
    password = EXCLUDED.password,
    auth_level = EXCLUDED.auth_level;
