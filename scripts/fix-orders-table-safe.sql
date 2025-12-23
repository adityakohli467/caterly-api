--
-- Orders Table Setup (Safe - handles existing objects)
-- This file safely creates the orders table even if parts already exist
--

-- Enable required extensions (IF NOT EXISTS handles duplicates)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing objects if they exist (to recreate cleanly)
DROP TABLE IF EXISTS public.orders CASCADE;
DROP SEQUENCE IF EXISTS public.orders_order_id_seq CASCADE;

-- Create sequence first
CREATE SEQUENCE public.orders_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create orders table
CREATE TABLE public.orders (
    order_id integer NOT NULL DEFAULT nextval('public.orders_order_id_seq'::regclass),
    customer_id integer NOT NULL,
    branch_id integer NOT NULL,
    shipping_method integer NOT NULL,
    pickup_delivery_notes text,
    order_total numeric(15,4) NOT NULL,
    order_status integer DEFAULT 1 NOT NULL,
    date_added timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_modified timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    delivery_date_time timestamp without time zone NOT NULL,
    selected_location integer,
    standing_order integer DEFAULT 0 NOT NULL,
    customer_order_name character varying(255),
    order_comments text,
    coupon_id integer,
    delivery_fee numeric(15,4) NOT NULL,
    delivery_phone character varying(15),
    delivery_address text,
    delivery_email character varying(255),
    approval_comments character varying(255),
    user_id integer DEFAULT 0,
    postcode integer DEFAULT 0 NOT NULL,
    zone_id integer,
    oc_order_id integer,
    customer_order_email character varying(50),
    location_id integer,
    mark_paid_comment character varying(500),
    customer_company_name character varying(500),
    customer_company_addr character varying(500),
    customer_department_name character varying(500),
    express_order_products text,
    express_order character varying(100),
    customer_order_telephone character varying(30),
    my_ob character varying(10) DEFAULT 'No'::character varying,
    uid character varying(1000) NOT NULL DEFAULT uuid_generate_v4()::text,
    customer_uid character varying(1000) NOT NULL DEFAULT ''::character varying,
    cancel_comment text,
    late_fee integer DEFAULT 0,
    surcharge integer,
    order_image character varying(200),
    gst_status integer DEFAULT 0,
    updatedafterapproved boolean DEFAULT false,
    is_catering_checklist_added integer,
    is_completed character varying(2),
    customer_from character varying(100),
    accounts_email character varying(50),
    payment_transaction_id character varying(255),
    payment_token character varying(255),
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_gateway character varying(50) DEFAULT 'pinpayments'::character varying,
    payment_response jsonb,
    payment_date timestamp without time zone,
    invoice_url character varying(500),
    account_email character varying(150),
    cost_center character varying(255),
    delivery_contact character varying(255),
    delivery_details text,
    delivery_method character varying(50),
    CONSTRAINT orders_pkey PRIMARY KEY (order_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(delivery_date_time);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_url ON public.orders(invoice_url) WHERE invoice_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id ON public.orders(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);

-- Add foreign key constraints (only if referenced tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE RESTRICT;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'locations') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_location_id_fkey 
            FOREIGN KEY (location_id) REFERENCES public.locations(location_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Set sequence ownership
ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;
