--
-- Quote Table Setup with Extensions
-- This file creates the quote table with required extensions and sample data
--

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create quote table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.quote (
    quote_id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    location_id VARCHAR(255),
    user_id INTEGER,
    quote_status VARCHAR(50) DEFAULT 'draft',
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    tax DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    notes TEXT,
    valid_until DATE,
    quote_number VARCHAR(100),
    CONSTRAINT quote_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE SET NULL,
    CONSTRAINT quote_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id) ON DELETE SET NULL,
    CONSTRAINT quote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quote_customer_id ON public.quote(customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_location_id ON public.quote(location_id);
CREATE INDEX IF NOT EXISTS idx_quote_user_id ON public.quote(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_status ON public.quote(quote_status);
CREATE INDEX IF NOT EXISTS idx_quote_created_at ON public.quote(created_at);

-- Insert sample quote data (optional - only if you want sample data)
-- Note: Make sure customer_id, location_id, and user_id exist before inserting
-- INSERT INTO public.quote (
--     customer_id,
--     location_id,
--     user_id,
--     quote_status,
--     subtotal,
--     tax,
--     total,
--     created_by,
--     notes,
--     quote_number
-- ) VALUES (
--     1, -- customer_id (must exist)
--     '96989', -- location_id (must exist)
--     1, -- user_id (must exist)
--     'draft',
--     100.00,
--     10.00,
--     110.00,
--     'admin',
--     'Sample quote',
--     'Q-001'
-- );
