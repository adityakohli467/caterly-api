--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

-- Started on 2025-12-03 17:27:56 IST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3 (class 3079 OID 27992)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 4393 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 2 (class 3079 OID 27981)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4394 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 339 (class 1255 OID 37426)
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM password_reset_tokens 
  WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$;


--
-- TOC entry 336 (class 1255 OID 37386)
-- Name: update_contact_inquiries_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_contact_inquiries_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- TOC entry 338 (class 1255 OID 35714)
-- Name: update_customer_date_modified(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_customer_date_modified() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.customer_date_modified = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 344 (class 1255 OID 35749)
-- Name: update_customer_product_option_discount_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_customer_product_option_discount_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 337 (class 1255 OID 35241)
-- Name: update_payment_history_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_payment_history_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 335 (class 1255 OID 35185)
-- Name: update_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- TOC entry 334 (class 1255 OID 28518)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- TOC entry 340 (class 1255 OID 37428)
-- Name: update_wholesale_enquiries_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_wholesale_enquiries_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 28150)
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    category_id integer NOT NULL,
    parent_category_id integer,
    category_name character varying(255) NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 28149)
-- Name: category_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4395 (class 0 OID 0)
-- Dependencies: 225
-- Name: category_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_category_id_seq OWNED BY public.category.category_id;


--
-- TOC entry 252 (class 1259 OID 28403)
-- Name: catering_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catering_checklist (
    catering_checklist_id integer NOT NULL,
    order_id integer,
    catering_location integer DEFAULT 0,
    catering_time integer DEFAULT 0,
    catering_people integer DEFAULT 0,
    catering_delivery_instructions integer DEFAULT 0,
    catering_dietary_req integer DEFAULT 0,
    day_before_location integer DEFAULT 0,
    day_before_time integer DEFAULT 0,
    day_before_people integer DEFAULT 0,
    day_before_delivery_instructions integer DEFAULT 0,
    day_before_dietary_req integer DEFAULT 0,
    delivery_day_check_everything integer DEFAULT 0,
    delivery_day_others integer DEFAULT 0,
    delivery_day_start_packing integer DEFAULT 0,
    delivery_day_call_customer integer DEFAULT 0,
    kitchen_catering_labels integer DEFAULT 0,
    kitchen_check_dietary integer DEFAULT 0,
    kitchen_check_all_items integer DEFAULT 0,
    kitchen_staff_name character varying(200),
    date_updated integer
);


--
-- TOC entry 251 (class 1259 OID 28402)
-- Name: catering_checklist_catering_checklist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catering_checklist_catering_checklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4396 (class 0 OID 0)
-- Dependencies: 251
-- Name: catering_checklist_catering_checklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catering_checklist_catering_checklist_id_seq OWNED BY public.catering_checklist.catering_checklist_id;


--
-- TOC entry 214 (class 1259 OID 28051)
-- Name: company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company (
    company_id integer NOT NULL,
    user_id integer,
    company_name character varying(255) NOT NULL,
    company_abn character varying(15),
    company_phone character varying(15),
    company_address text,
    company_status integer DEFAULT 1 NOT NULL,
    created_from character varying(100),
    company_created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 213 (class 1259 OID 28050)
-- Name: company_company_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_company_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4397 (class 0 OID 0)
-- Dependencies: 213
-- Name: company_company_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_company_id_seq OWNED BY public.company.company_id;


--
-- TOC entry 279 (class 1259 OID 37356)
-- Name: contact_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_inquiries (
    id integer NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(50),
    message text NOT NULL,
    status character varying(20) DEFAULT 'new'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4398 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE contact_inquiries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.contact_inquiries IS 'Stores contact form submissions from the public storefront contact page';


--
-- TOC entry 4399 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN contact_inquiries.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_inquiries.status IS 'Status of the inquiry: new, read, replied, archived';


--
-- TOC entry 4400 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN contact_inquiries.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_inquiries.created_at IS 'When the inquiry was submitted';


--
-- TOC entry 4401 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN contact_inquiries.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contact_inquiries.updated_at IS 'When the inquiry was last updated';


--
-- TOC entry 278 (class 1259 OID 37355)
-- Name: contact_inquiries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contact_inquiries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4402 (class 0 OID 0)
-- Dependencies: 278
-- Name: contact_inquiries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contact_inquiries_id_seq OWNED BY public.contact_inquiries.id;


--
-- TOC entry 250 (class 1259 OID 28391)
-- Name: coupon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon (
    coupon_id integer NOT NULL,
    coupon_code character varying(255) NOT NULL,
    coupon_description character varying(255) NOT NULL,
    coupon_discount numeric(10,2) NOT NULL,
    type character varying(1) NOT NULL,
    status integer DEFAULT 1 NOT NULL
);


--
-- TOC entry 4403 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE coupon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coupon IS 'Discount coupons';


--
-- TOC entry 4404 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN coupon.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon.type IS 'P=percentage, F=fixed amount';


--
-- TOC entry 249 (class 1259 OID 28390)
-- Name: coupon_coupon_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupon_coupon_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4405 (class 0 OID 0)
-- Dependencies: 249
-- Name: coupon_coupon_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupon_coupon_id_seq OWNED BY public.coupon.coupon_id;


--
-- TOC entry 218 (class 1259 OID 28088)
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    customer_id integer NOT NULL,
    user_id integer,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    email character varying(255),
    telephone character varying(15),
    customer_fax character varying(15),
    customer_date_added timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    company_id integer,
    department character varying(30),
    customer_address text,
    is_cost_centre_account boolean DEFAULT false,
    status integer DEFAULT 0 NOT NULL,
    approved boolean DEFAULT false,
    date_added date,
    customer_type character varying(100) DEFAULT 'Retail'::character varying,
    customer_cost_centre character varying(255),
    customer_notes text,
    customer_image character varying(500),
    estimated_opening_date date,
    archived boolean DEFAULT false,
    department_id integer,
    customer_date_modified timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4406 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN customer.customer_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer.customer_type IS 'Type of customer: Retail, Club Members, Full Service Wholesale, Partial Service Wholesale';


--
-- TOC entry 4407 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN customer.customer_cost_centre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer.customer_cost_centre IS 'Cost centre code for wholesale customers';


--
-- TOC entry 4408 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN customer.customer_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer.customer_notes IS 'Additional notes about the customer';


--
-- TOC entry 4409 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN customer.customer_image; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer.customer_image IS 'URL or path to customer image';


--
-- TOC entry 4410 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN customer.estimated_opening_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer.estimated_opening_date IS 'Estimated opening date for wholesale locations';


--
-- TOC entry 4411 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN customer.archived; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer.archived IS 'Whether the customer is archived';


--
-- TOC entry 217 (class 1259 OID 28087)
-- Name: customer_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4412 (class 0 OID 0)
-- Dependencies: 217
-- Name: customer_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_customer_id_seq OWNED BY public.customer.customer_id;


--
-- TOC entry 254 (class 1259 OID 28432)
-- Name: customer_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_feedback (
    feedback_id integer NOT NULL,
    order_id integer NOT NULL,
    cname character varying(500) NOT NULL,
    company_name character varying(1000),
    delivery_date date,
    website_experience text,
    food integer DEFAULT 0 NOT NULL,
    pricing integer DEFAULT 0 NOT NULL,
    menu integer DEFAULT 0 NOT NULL,
    experience integer DEFAULT 0 NOT NULL,
    delivery integer DEFAULT 0 NOT NULL,
    packaging integer DEFAULT 0 NOT NULL,
    service integer DEFAULT 0 NOT NULL,
    commenttext text NOT NULL,
    deliveredontime character varying(20),
    location_id integer,
    suggestions character varying(300)
);


--
-- TOC entry 253 (class 1259 OID 28431)
-- Name: customer_feedback_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_feedback_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4413 (class 0 OID 0)
-- Dependencies: 253
-- Name: customer_feedback_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_feedback_feedback_id_seq OWNED BY public.customer_feedback.feedback_id;


--
-- TOC entry 261 (class 1259 OID 28507)
-- Name: customer_id_count; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_id_count (
    customer_id integer NOT NULL,
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 275 (class 1259 OID 35718)
-- Name: customer_product_option_discount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_product_option_discount (
    customer_product_option_discount_id integer NOT NULL,
    customer_id integer NOT NULL,
    product_id integer NOT NULL,
    option_value_id integer NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_product_option_discount_discount_percentage_check CHECK (((discount_percentage >= (0)::numeric) AND (discount_percentage <= (100)::numeric)))
);


--
-- TOC entry 274 (class 1259 OID 35717)
-- Name: customer_product_option_disco_customer_product_option_disco_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_product_option_disco_customer_product_option_disco_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4414 (class 0 OID 0)
-- Dependencies: 274
-- Name: customer_product_option_disco_customer_product_option_disco_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_product_option_disco_customer_product_option_disco_seq OWNED BY public.customer_product_option_discount.customer_product_option_discount_id;


--
-- TOC entry 268 (class 1259 OID 29748)
-- Name: customer_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_type (
    customer_type_id integer NOT NULL,
    type_name character varying(100) NOT NULL,
    type_description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 267 (class 1259 OID 29747)
-- Name: customer_type_customer_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_type_customer_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4415 (class 0 OID 0)
-- Dependencies: 267
-- Name: customer_type_customer_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_type_customer_type_id_seq OWNED BY public.customer_type.customer_type_id;


--
-- TOC entry 216 (class 1259 OID 28069)
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    department_id integer NOT NULL,
    company_id integer NOT NULL,
    user_id integer,
    department_name character varying(255) NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    created_from character varying(100),
    department_created_on date
);


--
-- TOC entry 215 (class 1259 OID 28068)
-- Name: department_department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.department_department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4416 (class 0 OID 0)
-- Dependencies: 215
-- Name: department_department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.department_department_id_seq OWNED BY public.department.department_id;


--
-- TOC entry 232 (class 1259 OID 28208)
-- Name: heading_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.heading_product (
    product_id integer NOT NULL,
    heading_id integer NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 28129)
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    location_id integer NOT NULL,
    location_name character varying(200),
    post_codes character varying(200),
    location_status integer,
    date_created date DEFAULT CURRENT_DATE NOT NULL,
    remittance_email character varying(255),
    account_name character varying(255),
    account_number character varying(100),
    contact character varying(50),
    abn character varying(50),
    company_name character varying(255),
    bsb character varying(20),
    pickup_address text
);


--
-- TOC entry 4417 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE locations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.locations IS 'Stores location information with remittance and account details';


--
-- TOC entry 221 (class 1259 OID 28128)
-- Name: locations_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4418 (class 0 OID 0)
-- Dependencies: 221
-- Name: locations_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_location_id_seq OWNED BY public.locations.location_id;


--
-- TOC entry 264 (class 1259 OID 28521)
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- TOC entry 263 (class 1259 OID 28520)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4419 (class 0 OID 0)
-- Dependencies: 263
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 258 (class 1259 OID 28473)
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id integer NOT NULL,
    description character varying(500) NOT NULL,
    orderid integer NOT NULL,
    userid integer NOT NULL,
    date_added date NOT NULL,
    time_added time without time zone NOT NULL,
    read_status boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 257 (class 1259 OID 28472)
-- Name: notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4420 (class 0 OID 0)
-- Dependencies: 257
-- Name: notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_id_seq OWNED BY public.notification.id;


--
-- TOC entry 236 (class 1259 OID 28231)
-- Name: option_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.option_value (
    option_value_id integer NOT NULL,
    option_id integer NOT NULL,
    name character varying(255) NOT NULL,
    sort_order integer NOT NULL
);


--
-- TOC entry 235 (class 1259 OID 28230)
-- Name: option_value_option_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.option_value_option_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4421 (class 0 OID 0)
-- Dependencies: 235
-- Name: option_value_option_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.option_value_option_value_id_seq OWNED BY public.option_value.option_value_id;


--
-- TOC entry 234 (class 1259 OID 28224)
-- Name: options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.options (
    option_id integer NOT NULL,
    name character varying(255) NOT NULL
);


--
-- TOC entry 233 (class 1259 OID 28223)
-- Name: options_option_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.options_option_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4422 (class 0 OID 0)
-- Dependencies: 233
-- Name: options_option_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.options_option_id_seq OWNED BY public.options.option_id;


--
-- TOC entry 266 (class 1259 OID 29146)
-- Name: order_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_checklist (
    checklist_id integer NOT NULL,
    order_id integer NOT NULL,
    catering_location boolean DEFAULT false,
    catering_time boolean DEFAULT false,
    catering_people boolean DEFAULT false,
    catering_delivery_instructions boolean DEFAULT false,
    catering_dietary_req boolean DEFAULT false,
    day_before_location boolean DEFAULT false,
    day_before_time boolean DEFAULT false,
    day_before_people boolean DEFAULT false,
    day_before_delivery_instructions boolean DEFAULT false,
    day_before_dietary_req boolean DEFAULT false,
    delivery_day_check_everything boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    delivery_day_cutlery boolean DEFAULT false,
    delivery_day_cups boolean DEFAULT false,
    delivery_day_coffee_tea boolean DEFAULT false,
    delivery_day_sugar boolean DEFAULT false,
    delivery_day_plates boolean DEFAULT false,
    delivery_day_signs boolean DEFAULT false,
    delivery_day_hot_cold boolean DEFAULT false,
    delivery_day_safety_pins boolean DEFAULT false,
    delivering_check_right_order boolean DEFAULT false,
    delivering_greet_introduce boolean DEFAULT false,
    delivering_ask_setup_area boolean DEFAULT false,
    delivering_introduce_service boolean DEFAULT false,
    delivering_setup_specifications boolean DEFAULT false,
    delivering_cover_everything boolean DEFAULT false,
    delivering_remind_questions boolean DEFAULT false,
    delivering_wish_great_day boolean DEFAULT false
);


--
-- TOC entry 265 (class 1259 OID 29145)
-- Name: order_checklist_checklist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_checklist_checklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4423 (class 0 OID 0)
-- Dependencies: 265
-- Name: order_checklist_checklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_checklist_checklist_id_seq OWNED BY public.order_checklist.checklist_id;


--
-- TOC entry 246 (class 1259 OID 28341)
-- Name: order_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_images (
    order_image_id integer NOT NULL,
    order_id integer NOT NULL,
    order_image character varying(200) NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 28340)
-- Name: order_images_order_image_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_images_order_image_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4424 (class 0 OID 0)
-- Dependencies: 245
-- Name: order_images_order_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_images_order_image_id_seq OWNED BY public.order_images.order_image_id;


--
-- TOC entry 242 (class 1259 OID 28300)
-- Name: order_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_product (
    order_product_id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer,
    price numeric(15,4),
    total numeric(15,4),
    sort_order integer NOT NULL,
    order_product_comment text,
    exclude_gst integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 28322)
-- Name: order_product_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_product_option (
    order_product_option_id integer NOT NULL,
    order_id integer NOT NULL,
    order_product_id integer NOT NULL,
    product_option_id integer NOT NULL,
    option_value character varying(250) NOT NULL,
    option_name character varying(250) NOT NULL,
    option_quantity integer NOT NULL,
    option_price numeric(15,4) NOT NULL,
    option_total numeric(15,4) NOT NULL
);


--
-- TOC entry 243 (class 1259 OID 28321)
-- Name: order_product_option_order_product_option_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_product_option_order_product_option_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4425 (class 0 OID 0)
-- Dependencies: 243
-- Name: order_product_option_order_product_option_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_product_option_order_product_option_id_seq OWNED BY public.order_product_option.order_product_option_id;


--
-- TOC entry 241 (class 1259 OID 28299)
-- Name: order_product_order_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_product_order_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4426 (class 0 OID 0)
-- Dependencies: 241
-- Name: order_product_order_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_product_order_product_id_seq OWNED BY public.order_product.order_product_id;


--
-- TOC entry 260 (class 1259 OID 28496)
-- Name: ordercompanyinfo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordercompanyinfo (
    id integer NOT NULL,
    order_id integer NOT NULL,
    merchant_id character varying(55),
    merchant_pass character varying(55),
    abn character varying(24),
    company_name character varying(300),
    bsb character varying(44)
);


--
-- TOC entry 259 (class 1259 OID 28495)
-- Name: ordercompanyinfo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordercompanyinfo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4427 (class 0 OID 0)
-- Dependencies: 259
-- Name: ordercompanyinfo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordercompanyinfo_id_seq OWNED BY public.ordercompanyinfo.id;


--
-- TOC entry 262 (class 1259 OID 28513)
-- Name: orderids_count; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderids_count (
    order_id integer NOT NULL,
    date date NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 28261)
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    order_id integer NOT NULL,
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
    uid character varying(1000) DEFAULT (public.uuid_generate_v4())::text NOT NULL,
    customer_uid character varying(1000) DEFAULT ''::character varying NOT NULL,
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
    account_email character varying(150) DEFAULT NULL::character varying,
    cost_center character varying(255) DEFAULT NULL::character varying,
    delivery_contact character varying(255) DEFAULT NULL::character varying,
    delivery_details text,
    delivery_method character varying(50) DEFAULT NULL::character varying
);


--
-- TOC entry 4428 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.orders IS 'Customer orders';


--
-- TOC entry 4429 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.order_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.order_status IS '0=cancelled, 1=new, 2=paid, 4=awaiting_approval, 7=approved, 8=rejected, 9=modified';


--
-- TOC entry 4430 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.account_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.account_email IS 'Account email for delivery notifications';


--
-- TOC entry 4431 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.cost_center; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.cost_center IS 'Cost center code for order tracking';


--
-- TOC entry 4432 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.delivery_contact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_contact IS 'Contact person for delivery';


--
-- TOC entry 4433 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.delivery_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_details IS 'Additional delivery details and instructions';


--
-- TOC entry 4434 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.delivery_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_method IS 'Delivery method: delivery or pickup';


--
-- TOC entry 239 (class 1259 OID 28260)
-- Name: orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4435 (class 0 OID 0)
-- Dependencies: 239
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- TOC entry 285 (class 1259 OID 37408)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 284 (class 1259 OID 37407)
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4436 (class 0 OID 0)
-- Dependencies: 284
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- TOC entry 287 (class 1259 OID 37465)
-- Name: payment_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_audit_log (
    id integer NOT NULL,
    payment_history_id integer,
    order_id integer,
    transaction_id character varying(255),
    event_type character varying(50) NOT NULL,
    old_status character varying(50),
    new_status character varying(50),
    event_data jsonb,
    performed_by integer,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4437 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE payment_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_audit_log IS 'Audit trail for all payment operations and status changes';


--
-- TOC entry 4438 (class 0 OID 0)
-- Dependencies: 287
-- Name: COLUMN payment_audit_log.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_audit_log.event_type IS 'Event type: charge, refund, void, webhook, callback, status_change';


--
-- TOC entry 4439 (class 0 OID 0)
-- Dependencies: 287
-- Name: COLUMN payment_audit_log.event_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_audit_log.event_data IS 'Additional event data in JSON format';


--
-- TOC entry 286 (class 1259 OID 37464)
-- Name: payment_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4440 (class 0 OID 0)
-- Dependencies: 286
-- Name: payment_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_audit_log_id_seq OWNED BY public.payment_audit_log.id;


--
-- TOC entry 272 (class 1259 OID 35211)
-- Name: payment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_history (
    payment_history_id integer NOT NULL,
    order_id integer NOT NULL,
    payment_transaction_id character varying(255) NOT NULL,
    payment_type character varying(50) DEFAULT 'charge'::character varying NOT NULL,
    payment_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    payment_gateway character varying(50) DEFAULT 'pinpayments'::character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'AUD'::character varying NOT NULL,
    refund_amount numeric(10,2) DEFAULT 0,
    customer_email character varying(255),
    customer_id integer,
    card_last4 character varying(4),
    card_brand character varying(50),
    card_expiry_month integer,
    card_expiry_year integer,
    card_token character varying(255),
    payment_method character varying(50),
    gateway_response jsonb NOT NULL,
    gateway_error jsonb,
    ip_address inet,
    user_agent text,
    request_id character varying(255),
    idempotency_key character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone,
    metadata jsonb,
    notes text
);


--
-- TOC entry 4441 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE payment_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_history IS 'Comprehensive payment transaction history with security and audit trail';


--
-- TOC entry 4442 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN payment_history.card_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_history.card_token IS 'Tokenized card reference - never stores actual card numbers';


--
-- TOC entry 4443 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN payment_history.gateway_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_history.gateway_response IS 'Full gateway response for audit and debugging';


--
-- TOC entry 4444 (class 0 OID 0)
-- Dependencies: 272
-- Name: COLUMN payment_history.idempotency_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_history.idempotency_key IS 'Prevents duplicate payment processing';


--
-- TOC entry 271 (class 1259 OID 35210)
-- Name: payment_history_payment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_history_payment_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4445 (class 0 OID 0)
-- Dependencies: 271
-- Name: payment_history_payment_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_history_payment_history_id_seq OWNED BY public.payment_history.payment_history_id;


--
-- TOC entry 273 (class 1259 OID 35243)
-- Name: payment_history_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.payment_history_summary AS
 SELECT payment_history.payment_history_id,
    payment_history.order_id,
    payment_history.payment_transaction_id,
    payment_history.payment_type,
    payment_history.payment_status,
    payment_history.payment_gateway,
    payment_history.amount,
    payment_history.currency,
    payment_history.refund_amount,
    payment_history.card_last4,
    payment_history.card_brand,
    payment_history.payment_method,
    payment_history.created_at,
    payment_history.processed_at,
        CASE
            WHEN ((payment_history.payment_status)::text = 'succeeded'::text) THEN 'Success'::character varying
            WHEN ((payment_history.payment_status)::text = 'failed'::text) THEN 'Failed'::character varying
            WHEN ((payment_history.payment_status)::text = 'refunded'::text) THEN 'Refunded'::character varying
            WHEN ((payment_history.payment_status)::text = 'pending'::text) THEN 'Pending'::character varying
            ELSE payment_history.payment_status
        END AS status_display
   FROM public.payment_history;


--
-- TOC entry 283 (class 1259 OID 37389)
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    transaction_id integer NOT NULL,
    order_id integer NOT NULL,
    transaction_ref character varying(255),
    amount integer,
    response_code character varying(10),
    response_text text,
    fingerprint character varying(255),
    fp_timestamp character varying(20),
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- TOC entry 4446 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE payment_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_transactions IS 'Audit trail for all payment transactions';


--
-- TOC entry 4447 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN payment_transactions.amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.amount IS 'Payment amount in cents';


--
-- TOC entry 4448 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN payment_transactions.response_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.response_code IS 'SecurePay response code (00=success, etc.)';


--
-- TOC entry 282 (class 1259 OID 37388)
-- Name: payment_transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4449 (class 0 OID 0)
-- Dependencies: 282
-- Name: payment_transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_transactions_transaction_id_seq OWNED BY public.payment_transactions.transaction_id;


--
-- TOC entry 230 (class 1259 OID 28171)
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    product_id integer NOT NULL,
    product_name character varying(255) NOT NULL,
    product_description text,
    product_tag text,
    product_meta_keyword text,
    product_desc_1 character varying(255),
    product_desc_2 character varying(255),
    product_desc_3 character varying(255),
    product_desc_4 character varying(255),
    product_desc_5 character varying(255),
    product_image text,
    product_price numeric(15,4) NOT NULL,
    product_date_available timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    product_minimum integer DEFAULT 1 NOT NULL,
    product_status integer DEFAULT 1 NOT NULL,
    product_date_added timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    product_date_modified timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    addons_option integer DEFAULT 0 NOT NULL,
    user_id integer NOT NULL,
    uid character varying(500),
    exclude_gst integer DEFAULT 0 NOT NULL,
    product_image_url character varying(500),
    customer_type_visibility character varying(20) DEFAULT 'all'::character varying,
    retail_price numeric(10,2),
    retail_discount_percentage numeric(5,2) DEFAULT 40.00
);


--
-- TOC entry 4450 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product.customer_type_visibility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.customer_type_visibility IS 'Product visibility: all, retailers, or wholesalers';


--
-- TOC entry 4451 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product.retail_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.retail_price IS 'Retail price (calculated from base price with discount)';


--
-- TOC entry 4452 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN product.retail_discount_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product.retail_discount_percentage IS 'Discount percentage applied to base price to calculate retail price (default 40%)';


--
-- TOC entry 231 (class 1259 OID 28193)
-- Name: product_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category (
    product_id integer NOT NULL,
    category_id integer NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 28162)
-- Name: product_header; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_header (
    heading_id integer NOT NULL,
    heading character varying(255) NOT NULL,
    image character varying(255)
);


--
-- TOC entry 227 (class 1259 OID 28161)
-- Name: product_header_heading_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_header_heading_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4453 (class 0 OID 0)
-- Dependencies: 227
-- Name: product_header_heading_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_header_heading_id_seq OWNED BY public.product_header.heading_id;


--
-- TOC entry 277 (class 1259 OID 37329)
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    product_image_id integer NOT NULL,
    product_id integer NOT NULL,
    image_url character varying(500) NOT NULL,
    image_order integer DEFAULT 0 NOT NULL,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4454 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE product_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.product_images IS 'Stores multiple images for each product with ordering support';


--
-- TOC entry 4455 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN product_images.product_image_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_images.product_image_id IS 'Primary key for product image';


--
-- TOC entry 4456 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN product_images.product_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_images.product_id IS 'Foreign key to product table';


--
-- TOC entry 4457 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN product_images.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_images.image_url IS 'URL of the product image (S3 URL)';


--
-- TOC entry 4458 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN product_images.image_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_images.image_order IS 'Order/position of the image (0-based index)';


--
-- TOC entry 4459 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN product_images.created_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_images.created_date IS 'Timestamp when the image was added';


--
-- TOC entry 276 (class 1259 OID 37328)
-- Name: product_images_product_image_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_product_image_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4460 (class 0 OID 0)
-- Dependencies: 276
-- Name: product_images_product_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_product_image_id_seq OWNED BY public.product_images.product_image_id;


--
-- TOC entry 238 (class 1259 OID 28243)
-- Name: product_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_option (
    product_option_id integer NOT NULL,
    product_id integer NOT NULL,
    option_value_id integer NOT NULL,
    option_required integer NOT NULL,
    option_price numeric(15,4) NOT NULL,
    option_price_prefix character varying(1) DEFAULT '+'::character varying NOT NULL,
    default_discount_percentage numeric(5,2) DEFAULT 0.00,
    CONSTRAINT product_option_default_discount_percentage_check CHECK (((default_discount_percentage >= (0)::numeric) AND (default_discount_percentage <= (100)::numeric)))
);


--
-- TOC entry 237 (class 1259 OID 28242)
-- Name: product_option_product_option_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_option_product_option_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4461 (class 0 OID 0)
-- Dependencies: 237
-- Name: product_option_product_option_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_option_product_option_id_seq OWNED BY public.product_option.product_option_id;


--
-- TOC entry 229 (class 1259 OID 28170)
-- Name: product_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4462 (class 0 OID 0)
-- Dependencies: 229
-- Name: product_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_product_id_seq OWNED BY public.product.product_id;


--
-- TOC entry 248 (class 1259 OID 28353)
-- Name: quote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote (
    order_id integer NOT NULL,
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
    customer_order_email character varying(55),
    location_id integer,
    mark_paid_comment character varying(500),
    customer_company_name character varying(500),
    customer_company_addr character varying(500),
    customer_department_name character varying(500),
    express_order_products text,
    express_order character varying(100),
    customer_order_telephone character varying(30),
    my_ob character varying(10) DEFAULT 'No'::character varying,
    uid character varying(1000) DEFAULT (public.uuid_generate_v4())::text NOT NULL,
    customer_uid character varying(1000) DEFAULT ''::character varying NOT NULL,
    cancel_comment text,
    late_fee integer DEFAULT 0,
    surcharge integer,
    order_image character varying(200),
    gst_status integer DEFAULT 0 NOT NULL,
    updatedafterapproved boolean DEFAULT false,
    is_catering_checklist_added integer,
    is_completed character varying(2),
    customer_from character varying(100),
    accounts_email character varying(50)
);


--
-- TOC entry 4463 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE quote; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.quote IS 'Customer quotes (pre-orders)';


--
-- TOC entry 247 (class 1259 OID 28352)
-- Name: quote_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quote_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4464 (class 0 OID 0)
-- Dependencies: 247
-- Name: quote_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quote_order_id_seq OWNED BY public.quote.order_id;


--
-- TOC entry 270 (class 1259 OID 35169)
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    setting_id integer NOT NULL,
    setting_key character varying(255) NOT NULL,
    setting_value text,
    setting_category character varying(100) DEFAULT 'general'::character varying NOT NULL,
    setting_type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 269 (class 1259 OID 35168)
-- Name: settings_setting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_setting_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4465 (class 0 OID 0)
-- Dependencies: 269
-- Name: settings_setting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_setting_id_seq OWNED BY public.settings.setting_id;


--
-- TOC entry 220 (class 1259 OID 28114)
-- Name: store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store (
    location_id integer NOT NULL,
    location_name character varying(255) NOT NULL,
    subdomain character varying(255) NOT NULL,
    status integer NOT NULL,
    state integer NOT NULL,
    postalcode integer,
    user_id integer NOT NULL,
    is_delivery boolean DEFAULT true,
    address character varying(200)
);


--
-- TOC entry 219 (class 1259 OID 28113)
-- Name: store_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.store_location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4466 (class 0 OID 0)
-- Dependencies: 219
-- Name: store_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.store_location_id_seq OWNED BY public.store.location_id;


--
-- TOC entry 256 (class 1259 OID 28458)
-- Name: survey; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey (
    id integer NOT NULL,
    location_id integer,
    person_name character varying(100),
    person_email character varying(100),
    patronage character varying(300),
    dietry character varying(300),
    dietry_feedback character varying(300),
    quality_of_food character varying(11),
    variety_of_food character varying(11),
    food_portion_size character varying(11),
    food_label character varying(11),
    value_for_money character varying(11),
    staff_helpfulness character varying(11),
    staff_courtesy character varying(11),
    staff_presentation character varying(11),
    staff_knowledge character varying(11),
    biodegradable_package character varying(11),
    coffee_quality character varying(11),
    outlet_ambience character varying(11),
    outlet_cleanliness character varying(11),
    dietry_requirement character varying(11),
    ordering_online character varying(11),
    catering character varying(11),
    age character varying(11),
    sex character varying(11),
    are_you character varying(11),
    date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 255 (class 1259 OID 28457)
-- Name: survey_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.survey_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4467 (class 0 OID 0)
-- Dependencies: 255
-- Name: survey_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.survey_id_seq OWNED BY public.survey.id;


--
-- TOC entry 212 (class 1259 OID 28030)
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    user_id integer NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(50) NOT NULL,
    login_username character varying(100),
    password character varying(255) NOT NULL,
    auth_level integer DEFAULT 3 NOT NULL,
    merchant_id text,
    merchant_pass text,
    abn text,
    company_name text,
    account_name character varying(1000),
    account_number character varying(1000),
    bsb character varying(100),
    user_com_addr text,
    account_email character varying(150),
    account_uid character varying(1000) DEFAULT (public.uuid_generate_v4())::text NOT NULL,
    guid character varying(1000) DEFAULT (public.uuid_generate_v4())::text NOT NULL,
    is_customer integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4468 (class 0 OID 0)
-- Dependencies: 212
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."user" IS 'System users including admins, staff, and customers';


--
-- TOC entry 4469 (class 0 OID 0)
-- Dependencies: 212
-- Name: COLUMN "user".auth_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".auth_level IS '1=super_admin, 2=admin, 3=staff, 4=customer';


--
-- TOC entry 224 (class 1259 OID 28137)
-- Name: user_postcode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_postcode (
    id integer NOT NULL,
    user_id integer NOT NULL,
    postal_code integer NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 28136)
-- Name: user_postcode_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_postcode_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4470 (class 0 OID 0)
-- Dependencies: 223
-- Name: user_postcode_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_postcode_id_seq OWNED BY public.user_postcode.id;


--
-- TOC entry 211 (class 1259 OID 28029)
-- Name: user_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4471 (class 0 OID 0)
-- Dependencies: 211
-- Name: user_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_user_id_seq OWNED BY public."user".user_id;


--
-- TOC entry 281 (class 1259 OID 37371)
-- Name: wholesale_enquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wholesale_enquiries (
    id integer NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    business_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(50),
    business_address character varying(500) NOT NULL,
    suburb character varying(255) NOT NULL,
    state character varying(100) NOT NULL,
    postcode character varying(20) NOT NULL,
    business_license character varying(255),
    business_website character varying(500),
    weekly_volume character varying(255) NOT NULL,
    start_month character varying(50) NOT NULL,
    start_year character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'new'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 4472 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE wholesale_enquiries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.wholesale_enquiries IS 'Stores wholesale partnership enquiry submissions from the storefront';


--
-- TOC entry 4473 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN wholesale_enquiries.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wholesale_enquiries.status IS 'Enquiry status: new, reviewed, contacted, approved, rejected, archived';


--
-- TOC entry 4474 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN wholesale_enquiries.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wholesale_enquiries.created_at IS 'When the enquiry was submitted';


--
-- TOC entry 4475 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN wholesale_enquiries.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.wholesale_enquiries.updated_at IS 'When the enquiry was last updated';


--
-- TOC entry 280 (class 1259 OID 37370)
-- Name: wholesale_enquiries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wholesale_enquiries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4476 (class 0 OID 0)
-- Dependencies: 280
-- Name: wholesale_enquiries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wholesale_enquiries_id_seq OWNED BY public.wholesale_enquiries.id;


--
-- TOC entry 3792 (class 2604 OID 28153)
-- Name: category category_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category ALTER COLUMN category_id SET DEFAULT nextval('public.category_category_id_seq'::regclass);


--
-- TOC entry 3848 (class 2604 OID 28406)
-- Name: catering_checklist catering_checklist_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catering_checklist ALTER COLUMN catering_checklist_id SET DEFAULT nextval('public.catering_checklist_catering_checklist_id_seq'::regclass);


--
-- TOC entry 3774 (class 2604 OID 28054)
-- Name: company company_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company ALTER COLUMN company_id SET DEFAULT nextval('public.company_company_id_seq'::regclass);


--
-- TOC entry 3936 (class 2604 OID 37359)
-- Name: contact_inquiries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_inquiries ALTER COLUMN id SET DEFAULT nextval('public.contact_inquiries_id_seq'::regclass);


--
-- TOC entry 3847 (class 2604 OID 28394)
-- Name: coupon coupon_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon ALTER COLUMN coupon_id SET DEFAULT nextval('public.coupon_coupon_id_seq'::regclass);


--
-- TOC entry 3779 (class 2604 OID 28091)
-- Name: customer customer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer ALTER COLUMN customer_id SET DEFAULT nextval('public.customer_customer_id_seq'::regclass);


--
-- TOC entry 3866 (class 2604 OID 28435)
-- Name: customer_feedback feedback_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback ALTER COLUMN feedback_id SET DEFAULT nextval('public.customer_feedback_feedback_id_seq'::regclass);


--
-- TOC entry 3928 (class 2604 OID 35721)
-- Name: customer_product_option_discount customer_product_option_discount_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_option_discount ALTER COLUMN customer_product_option_discount_id SET DEFAULT nextval('public.customer_product_option_disco_customer_product_option_disco_seq'::regclass);


--
-- TOC entry 3912 (class 2604 OID 29751)
-- Name: customer_type customer_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_type ALTER COLUMN customer_type_id SET DEFAULT nextval('public.customer_type_customer_type_id_seq'::regclass);


--
-- TOC entry 3777 (class 2604 OID 28072)
-- Name: department department_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department ALTER COLUMN department_id SET DEFAULT nextval('public.department_department_id_seq'::regclass);


--
-- TOC entry 3789 (class 2604 OID 28132)
-- Name: locations location_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN location_id SET DEFAULT nextval('public.locations_location_id_seq'::regclass);


--
-- TOC entry 3881 (class 2604 OID 28524)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 3876 (class 2604 OID 28476)
-- Name: notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification ALTER COLUMN id SET DEFAULT nextval('public.notification_id_seq'::regclass);


--
-- TOC entry 3805 (class 2604 OID 28234)
-- Name: option_value option_value_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option_value ALTER COLUMN option_value_id SET DEFAULT nextval('public.option_value_option_value_id_seq'::regclass);


--
-- TOC entry 3804 (class 2604 OID 28227)
-- Name: options option_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options ALTER COLUMN option_id SET DEFAULT nextval('public.options_option_id_seq'::regclass);


--
-- TOC entry 3882 (class 2604 OID 29149)
-- Name: order_checklist checklist_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_checklist ALTER COLUMN checklist_id SET DEFAULT nextval('public.order_checklist_checklist_id_seq'::regclass);


--
-- TOC entry 3832 (class 2604 OID 28344)
-- Name: order_images order_image_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_images ALTER COLUMN order_image_id SET DEFAULT nextval('public.order_images_order_image_id_seq'::regclass);


--
-- TOC entry 3829 (class 2604 OID 28303)
-- Name: order_product order_product_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product ALTER COLUMN order_product_id SET DEFAULT nextval('public.order_product_order_product_id_seq'::regclass);


--
-- TOC entry 3831 (class 2604 OID 28325)
-- Name: order_product_option order_product_option_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product_option ALTER COLUMN order_product_option_id SET DEFAULT nextval('public.order_product_option_order_product_option_id_seq'::regclass);


--
-- TOC entry 3879 (class 2604 OID 28499)
-- Name: ordercompanyinfo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordercompanyinfo ALTER COLUMN id SET DEFAULT nextval('public.ordercompanyinfo_id_seq'::regclass);


--
-- TOC entry 3810 (class 2604 OID 28264)
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- TOC entry 3947 (class 2604 OID 37411)
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- TOC entry 3950 (class 2604 OID 37468)
-- Name: payment_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_log ALTER COLUMN id SET DEFAULT nextval('public.payment_audit_log_id_seq'::regclass);


--
-- TOC entry 3920 (class 2604 OID 35214)
-- Name: payment_history payment_history_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history ALTER COLUMN payment_history_id SET DEFAULT nextval('public.payment_history_payment_history_id_seq'::regclass);


--
-- TOC entry 3944 (class 2604 OID 37392)
-- Name: payment_transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.payment_transactions_transaction_id_seq'::regclass);


--
-- TOC entry 3794 (class 2604 OID 28174)
-- Name: product product_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN product_id SET DEFAULT nextval('public.product_product_id_seq'::regclass);


--
-- TOC entry 3793 (class 2604 OID 28165)
-- Name: product_header heading_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_header ALTER COLUMN heading_id SET DEFAULT nextval('public.product_header_heading_id_seq'::regclass);


--
-- TOC entry 3933 (class 2604 OID 37332)
-- Name: product_images product_image_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN product_image_id SET DEFAULT nextval('public.product_images_product_image_id_seq'::regclass);


--
-- TOC entry 3806 (class 2604 OID 28246)
-- Name: product_option product_option_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option ALTER COLUMN product_option_id SET DEFAULT nextval('public.product_option_product_option_id_seq'::regclass);


--
-- TOC entry 3834 (class 2604 OID 28356)
-- Name: quote order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote ALTER COLUMN order_id SET DEFAULT nextval('public.quote_order_id_seq'::regclass);


--
-- TOC entry 3915 (class 2604 OID 35172)
-- Name: settings setting_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN setting_id SET DEFAULT nextval('public.settings_setting_id_seq'::regclass);


--
-- TOC entry 3787 (class 2604 OID 28117)
-- Name: store location_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store ALTER COLUMN location_id SET DEFAULT nextval('public.store_location_id_seq'::regclass);


--
-- TOC entry 3874 (class 2604 OID 28461)
-- Name: survey id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey ALTER COLUMN id SET DEFAULT nextval('public.survey_id_seq'::regclass);


--
-- TOC entry 3767 (class 2604 OID 28033)
-- Name: user user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN user_id SET DEFAULT nextval('public.user_user_id_seq'::regclass);


--
-- TOC entry 3791 (class 2604 OID 28140)
-- Name: user_postcode id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_postcode ALTER COLUMN id SET DEFAULT nextval('public.user_postcode_id_seq'::regclass);


--
-- TOC entry 3940 (class 2604 OID 37374)
-- Name: wholesale_enquiries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wholesale_enquiries ALTER COLUMN id SET DEFAULT nextval('public.wholesale_enquiries_id_seq'::regclass);


--
-- TOC entry 4327 (class 0 OID 28150)
-- Dependencies: 226
-- Data for Name: category; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.category VALUES (1, NULL, 'Main Courses');
INSERT INTO public.category VALUES (2, NULL, 'Appetizers');
INSERT INTO public.category VALUES (3, NULL, 'Desserts');
INSERT INTO public.category VALUES (4, NULL, 'Beverages');
INSERT INTO public.category VALUES (5, NULL, 'Salads');
INSERT INTO public.category VALUES (6, NULL, 'Breakfast');
INSERT INTO public.category VALUES (7, NULL, 'Lunch Packages');
INSERT INTO public.category VALUES (8, NULL, 'Catering Packages');
INSERT INTO public.category VALUES (10, NULL, 'Tea');
INSERT INTO public.category VALUES (11, NULL, 'Choc/Chai/Matcha');
INSERT INTO public.category VALUES (12, NULL, 'Coffee');
INSERT INTO public.category VALUES (13, NULL, 'Packaging');
INSERT INTO public.category VALUES (14, NULL, 'Syrups');
INSERT INTO public.category VALUES (15, NULL, 'Ancillaries');


--
-- TOC entry 4353 (class 0 OID 28403)
-- Dependencies: 252
-- Data for Name: catering_checklist; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4315 (class 0 OID 28051)
-- Dependencies: 214
-- Data for Name: company; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.company VALUES (1, NULL, 'Tech Solutions Pty Ltd', '12 345 678 901', '03 9123 4567', '456 Bourke St, Melbourne VIC 3000', 1, NULL, '2025-11-05 09:05:10.318066');
INSERT INTO public.company VALUES (2, NULL, 'Marketing Pro Agency', '23 456 789 012', '03 9234 5678', '789 Flinders St, Melbourne VIC 3000', 1, NULL, '2025-11-05 09:05:10.318066');
INSERT INTO public.company VALUES (3, NULL, 'vasu', 'dsf', '0445454545', 'sds ds fs', 1, NULL, '2025-11-30 08:36:55.880082');
INSERT INTO public.company VALUES (4, 11, 'mt', NULL, NULL, 'sds ds fssss, sadasd, d s, ap, 531085', 1, 'storefront_registration', '2025-12-01 22:59:16.165905');


--
-- TOC entry 4379 (class 0 OID 37356)
-- Dependencies: 279
-- Data for Name: contact_inquiries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contact_inquiries VALUES (1, 'Test', 'User', 'test@test.com', NULL, 'Test message', 'new', '2025-12-02 14:41:44.845092', '2025-12-02 14:41:44.845092');
INSERT INTO public.contact_inquiries VALUES (2, 'sdf', 'dfd', 'vv@gg.com', '07995481219', 'cv', 'new', '2025-12-02 14:43:58.285037', '2025-12-02 14:43:58.285037');
INSERT INTO public.contact_inquiries VALUES (3, 'vassbj', 'dfvdf', 'vddddv@gg.com', 'dfd', 'sdsfdf', 'new', '2025-12-02 17:55:31.255601', '2025-12-02 17:55:31.255601');


--
-- TOC entry 4351 (class 0 OID 28391)
-- Dependencies: 250
-- Data for Name: coupon; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.coupon VALUES (1, 'WELCOME10', '10% off first order', 10.00, 'P', 1);
INSERT INTO public.coupon VALUES (2, 'FEEDBACK5', '$5 off with feedback', 5.00, 'F', 1);
INSERT INTO public.coupon VALUES (3, 'CORPORATE15', '15% off corporate orders over $500', 15.00, 'P', 1);
INSERT INTO public.coupon VALUES (4, 'FIRSTSTDRX', 'first time customer', 26.00, 'F', 1);


--
-- TOC entry 4319 (class 0 OID 28088)
-- Dependencies: 218
-- Data for Name: customer; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customer VALUES (1, NULL, 'John', 'Smith', 'john.smith@techsolutions.com', '0412 345 678', NULL, '2025-11-05 09:05:10.318066', 1, '1', NULL, false, 1, true, '2025-11-05', 'Retail', NULL, NULL, NULL, NULL, false, 1, '2025-11-17 08:22:54.284695');
INSERT INTO public.customer VALUES (3, NULL, 'Mike', 'Williams', 'mike.w@techsolutions.com', '0434 567 890', NULL, '2025-11-05 09:05:10.318066', 1, '2', NULL, false, 1, true, '2025-11-05', 'Retail', NULL, NULL, NULL, NULL, false, 2, '2025-11-17 08:22:54.284695');
INSERT INTO public.customer VALUES (5, NULL, 'vasu new', 'll', 'vv@gg.com', '0788966666', NULL, '2025-11-11 08:55:07.59397', NULL, NULL, 'fff', false, 1, false, NULL, 'Retail', '', 'fff', NULL, NULL, false, NULL, '2025-11-17 08:22:54.284695');
INSERT INTO public.customer VALUES (4, NULL, 'test', 'ff', 'vv@g.com', '6677766665', NULL, '2025-11-11 08:52:40.702787', NULL, NULL, 'ffg', false, 1, false, NULL, 'Retail', NULL, 'dfgdf', NULL, NULL, false, NULL, '2025-11-17 08:22:54.284695');
INSERT INTO public.customer VALUES (6, NULL, 'club1', 'mem', 'vv@gg.com', '0978666653', NULL, '2025-11-11 09:13:04.537873', NULL, NULL, 'fdfd', false, 1, false, NULL, 'Club Members', NULL, 'dff', NULL, NULL, false, NULL, '2025-11-17 08:22:54.284695');
INSERT INTO public.customer VALUES (8, NULL, 'sdfsd', 'sdsd', 'ee@gg.com', '453534533', NULL, '2025-11-16 23:53:44.429174', 1, NULL, 'sdfsd', false, 1, false, NULL, 'Full Service Wholesale', 'dfds', 'ddfs', NULL, '2025-11-19', false, NULL, '2025-11-17 11:35:59.605193');
INSERT INTO public.customer VALUES (11, NULL, 'fff', 'ggg', 'vv@g.com', '5656566666', NULL, '2025-11-17 08:41:26.492114', 1, NULL, 'rretret', false, 1, false, NULL, 'Full Service Wholesale', 'yjj', NULL, NULL, '2025-11-18', false, NULL, '2025-11-17 11:35:59.605193');
INSERT INTO public.customer VALUES (9, NULL, 'test', 'vvv', 'vvv@g.com', '655555555', NULL, '2025-11-17 08:09:33.640013', 1, NULL, 'dfdsf', false, 1, false, NULL, 'Partial Service Wholesale', 'fd', 'df', NULL, '2025-11-18', false, NULL, '2025-11-17 11:35:59.619953');
INSERT INTO public.customer VALUES (10, NULL, 'vasu', 'sig', 'vv@g.com', '564564565', NULL, '2025-11-17 08:39:48.363534', 1, NULL, 'dfgdfgd', false, 1, false, NULL, 'Partial Service Wholesale', '234', 'gg', NULL, '2025-11-19', false, NULL, '2025-11-17 11:35:59.619953');
INSERT INTO public.customer VALUES (12, NULL, 'vasu`', 'hbjhb', 'vv@gggg.com', '4555455344', NULL, '2025-11-17 08:43:49.423075', 2, NULL, 'dfg', false, 1, false, NULL, 'Partial Service Wholesale', 'dfs', 'sdas', NULL, '2025-11-20', false, NULL, '2025-11-17 11:35:59.619953');
INSERT INTO public.customer VALUES (7, NULL, 'retail1', 'dd', 'vasu.singampalli@gmail.com', '0948444444', NULL, '2025-11-11 09:47:55.283241', NULL, NULL, 'dffd', false, 1, false, NULL, 'Retail', NULL, 'dfffg', NULL, NULL, false, NULL, '2025-11-17 22:52:45.869541');
INSERT INTO public.customer VALUES (2, NULL, 'Sarah', 'Johnson', 'vasu.singampalli@gmail.com', '0423 456 789', NULL, '2025-11-05 09:05:10.318066', 2, '3', NULL, false, 1, true, '2025-11-05', 'Retail', NULL, NULL, NULL, NULL, false, 3, '2025-11-17 23:02:03.33177');
INSERT INTO public.customer VALUES (13, 9, 'vasu', 'vasu', 'test@test.com', '7995481219', NULL, '2025-11-23 15:14:52.28992', NULL, NULL, 'sds ds fs, d s, ap, 531085', false, 1, true, NULL, 'Retail', NULL, NULL, NULL, NULL, false, NULL, '2025-11-23 15:14:52.28992');
INSERT INTO public.customer VALUES (14, 10, 'vasu', 'dsd', 'vv@gg.com', '07995481219', NULL, '2025-11-23 15:17:37.337319', NULL, NULL, 'sds ds fs, d s, ap, 531085', false, 1, true, NULL, 'Retail', NULL, NULL, NULL, NULL, false, NULL, '2025-11-23 15:17:37.337319');
INSERT INTO public.customer VALUES (15, NULL, 'vasu new1', 'cv', 'vv@gyhg.com', '0433333343', NULL, '2025-11-30 08:48:29.13355', NULL, NULL, 'sds ds fs', false, 1, false, NULL, 'Retail', NULL, NULL, NULL, NULL, false, NULL, '2025-11-30 08:48:29.13355');
INSERT INTO public.customer VALUES (16, NULL, 'dfsdfsdf', 'sdfsdf', 'aaa@ssss.com', '0464564554', NULL, '2025-11-30 10:15:26.863272', NULL, NULL, 'sdfsdfsdf f sdf sdfdsfs', false, 1, false, NULL, 'Retail', NULL, NULL, NULL, NULL, false, NULL, '2025-11-30 10:15:26.863272');
INSERT INTO public.customer VALUES (17, 11, 'vasuvvd', 'vasuvvd', 'vvddffdd@gg.com', '0434534532', NULL, '2025-12-01 22:59:16.16998', 4, NULL, 'sds ds fssss, sadasd, d s, ap, 531085', false, 1, false, NULL, 'Full Service Wholesale', NULL, NULL, NULL, NULL, false, NULL, '2025-12-02 14:02:08.451805');


--
-- TOC entry 4355 (class 0 OID 28432)
-- Dependencies: 254
-- Data for Name: customer_feedback; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4362 (class 0 OID 28507)
-- Dependencies: 261
-- Data for Name: customer_id_count; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4375 (class 0 OID 35718)
-- Dependencies: 275
-- Data for Name: customer_product_option_discount; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customer_product_option_discount VALUES (35, 17, 51, 26, 12.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (36, 17, 33, 27, 22.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (37, 17, 16, 22, 13.73, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (38, 17, 22, 25, 23.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (39, 17, 35, 24, 12.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (40, 17, 17, 23, 4.19, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (41, 17, 19, 22, 5.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (42, 17, 25, 25, 8.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (43, 17, 27, 25, 7.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (44, 17, 34, 28, 23.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (45, 17, 53, 26, 12.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (46, 17, 56, 29, 3.00, '2025-12-02 11:36:12.434571', '2025-12-02 11:36:12.434571');
INSERT INTO public.customer_product_option_discount VALUES (47, 16, 51, 26, 12.00, '2025-12-02 16:43:14.539084', '2025-12-02 16:43:14.539084');


--
-- TOC entry 4369 (class 0 OID 29748)
-- Dependencies: 268
-- Data for Name: customer_type; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customer_type VALUES (1, 'Retail', 'Regular retail customers', true, '2025-11-11 08:43:37.70482');
INSERT INTO public.customer_type VALUES (2, 'Club Members', 'Members of the coffee club', true, '2025-11-11 08:43:37.70482');
INSERT INTO public.customer_type VALUES (3, 'Full Service Wholesale', 'Full service wholesale partners', true, '2025-11-11 08:43:37.70482');
INSERT INTO public.customer_type VALUES (4, 'Partial Service Wholesale', 'Partial service wholesale partners', true, '2025-11-11 08:43:37.70482');


--
-- TOC entry 4317 (class 0 OID 28069)
-- Dependencies: 216
-- Data for Name: department; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.department VALUES (1, 1, NULL, 'Engineering', 1, NULL, NULL);
INSERT INTO public.department VALUES (2, 1, NULL, 'Sales', 1, NULL, NULL);
INSERT INTO public.department VALUES (3, 2, NULL, 'Marketing', 1, NULL, NULL);
INSERT INTO public.department VALUES (4, 2, NULL, 'Creative', 1, NULL, NULL);


--
-- TOC entry 4333 (class 0 OID 28208)
-- Dependencies: 232
-- Data for Name: heading_product; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4323 (class 0 OID 28129)
-- Dependencies: 222
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.locations VALUES (1, 'Melbourne CBD', '3000,3001,3002,3003', 1, '2025-11-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.locations VALUES (2, 'St Kilda', '3182,3183', 1, '2025-11-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.locations VALUES (3, 'Richmond', '3121', 1, '2025-11-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.locations VALUES (4, 'Box Hill', NULL, 1, '2025-11-11', 'boxhill@stdreuxcoffee.com', 'St Dreux Coffee Box Hill', '12345678', '0412345678', '12345678901', 'St Dreux Coffee', '063000', '123 Main St, Box Hill, VIC 3128');
INSERT INTO public.locations VALUES (5, 'Maroondah', NULL, 1, '2025-11-11', 'maroondah@stdreuxcoffee.com', 'St Dreux Coffee Maroondah', '23456789', '0423456789', '12345678901', 'St Dreux Coffee', '063000', '456 Shopping Centre Dr, Ringwood, VIC 3134');
INSERT INTO public.locations VALUES (6, 'Brighton', NULL, 1, '2025-11-11', 'brighton@stdreuxcoffee.com', 'St Dreux Coffee Brighton', '34567890', '0434567890', '12345678901', 'St Dreux Coffee', '063000', '789 Bay St, Brighton, VIC 3186');


--
-- TOC entry 4365 (class 0 OID 28521)
-- Dependencies: 264
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.migrations VALUES (1, 1611063162649, 'initialSchema1611063162649');


--
-- TOC entry 4359 (class 0 OID 28473)
-- Dependencies: 258
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4337 (class 0 OID 28231)
-- Dependencies: 236
-- Data for Name: option_value; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.option_value VALUES (1, 1, 'Small (10 people)', 1);
INSERT INTO public.option_value VALUES (2, 1, 'Medium (20 people)', 2);
INSERT INTO public.option_value VALUES (3, 1, 'Large (50 people)', 3);
INSERT INTO public.option_value VALUES (4, 2, 'Vegetarian', 1);
INSERT INTO public.option_value VALUES (5, 2, 'Vegan', 2);
INSERT INTO public.option_value VALUES (6, 2, 'Gluten Free', 3);
INSERT INTO public.option_value VALUES (7, 2, 'Dairy Free', 4);
INSERT INTO public.option_value VALUES (8, 3, 'Extra Cutlery', 1);
INSERT INTO public.option_value VALUES (9, 3, 'Plates & Napkins', 2);
INSERT INTO public.option_value VALUES (10, 3, 'Setup Service', 3);
INSERT INTO public.option_value VALUES (14, 4, 'Tea', 1);
INSERT INTO public.option_value VALUES (15, 4, 'Soft Drinks', 2);
INSERT INTO public.option_value VALUES (22, 1, '250g', 1);
INSERT INTO public.option_value VALUES (23, 1, '500g', 2);
INSERT INTO public.option_value VALUES (24, 1, '1kg', 3);
INSERT INTO public.option_value VALUES (25, 1, '100 count', 4);
INSERT INTO public.option_value VALUES (26, 1, '1 Litre', 5);
INSERT INTO public.option_value VALUES (27, 1, '30g', 6);
INSERT INTO public.option_value VALUES (28, 1, '100g', 7);
INSERT INTO public.option_value VALUES (29, 7, 'Retail Standard', 1);
INSERT INTO public.option_value VALUES (30, 7, 'Retail Club', 2);
INSERT INTO public.option_value VALUES (31, 7, 'Wholesale Basic', 3);
INSERT INTO public.option_value VALUES (32, 7, 'Wholesale Premium', 4);


--
-- TOC entry 4335 (class 0 OID 28224)
-- Dependencies: 234
-- Data for Name: options; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.options VALUES (1, 'Size');
INSERT INTO public.options VALUES (2, 'Dietary Requirements');
INSERT INTO public.options VALUES (3, 'Add-ons');
INSERT INTO public.options VALUES (4, 'Beverages');
INSERT INTO public.options VALUES (6, 'Size/Weight');
INSERT INTO public.options VALUES (7, 'Pricing Tier');


--
-- TOC entry 4367 (class 0 OID 29146)
-- Dependencies: 266
-- Data for Name: order_checklist; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.order_checklist VALUES (1, 19, true, true, false, false, false, false, false, false, false, false, false, '2025-11-17 16:54:14.018409', '2025-11-17 16:56:29.61419', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.order_checklist VALUES (2, 25, true, true, true, false, false, false, false, false, false, false, false, '2025-11-30 10:08:58.408613', '2025-11-30 22:46:58.577512', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);


--
-- TOC entry 4347 (class 0 OID 28341)
-- Dependencies: 246
-- Data for Name: order_images; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4343 (class 0 OID 28300)
-- Dependencies: 242
-- Data for Name: order_product; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4345 (class 0 OID 28322)
-- Dependencies: 244
-- Data for Name: order_product_option; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4361 (class 0 OID 28496)
-- Dependencies: 260
-- Data for Name: ordercompanyinfo; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4363 (class 0 OID 28513)
-- Dependencies: 262
-- Data for Name: orderids_count; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4341 (class 0 OID 28261)
-- Dependencies: 240
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.orders VALUES (4, 3, 1, 1, NULL, 670.0000, 1, '2025-11-11 20:56:36.607304', '2025-11-11 20:56:36.607304', '2025-11-14 12:00:00', NULL, 0, NULL, NULL, NULL, 120.0000, NULL, 'fsfd sf sdsf', NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', 'bd6632fa-352e-446f-abeb-3d29bce9673b', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (3, 3, 1, 1, NULL, 160.7000, 1, '2025-11-11 20:28:09.181409', '2025-11-11 22:22:52.354157', '2025-11-14 12:00:00', NULL, 0, NULL, 'Test quote from API', NULL, 120.0000, NULL, '123 Test Street', NULL, NULL, 1, 0, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '74389106-2365-444c-9545-986b154c26e4', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (6, 2, 1, 1, NULL, 670.0000, 1, '2025-11-11 20:58:34.042315', '2025-11-12 10:41:44.072313', '2025-11-15 14:30:00', NULL, 0, NULL, 'Updated comments', NULL, 150.0000, NULL, 'Updated Address', NULL, NULL, 1, 0, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', 'b0f6b742-d7a8-43a6-b3f1-624eda6215d9', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (10, 3, 1, 1, NULL, 670.0000, 1, '2025-11-16 22:39:25.415575', '2025-11-16 22:40:42.879004', '2025-11-16 10:00:00', NULL, 0, NULL, NULL, NULL, 120.0000, NULL, NULL, NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '5969ea8c-130f-4daf-ac74-b3bec9cb9c95', '', NULL, 0, NULL, NULL, 0, false, NULL, '1', NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (17, 2, 1, 1, NULL, 199.4750, 1, '2025-11-17 15:14:47.541804', '2025-11-17 15:14:47.541804', '2025-11-19 14:00:00', NULL, 14, NULL, 'dsfsd', 3, 120.0000, NULL, 'dfsdfsfdfs', NULL, NULL, 1, 0, NULL, NULL, NULL, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '59c7c3d4-6697-467d-a2c0-a3d8a248b95c', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (18, 1, 1, 1, NULL, 47.2000, 1, '2025-11-17 15:24:33.955033', '2025-11-17 15:24:33.955033', '2025-11-19 13:00:00', NULL, 30, NULL, 'wdsfsd', NULL, 12.0000, NULL, 'sdf sdf', NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', 'af5509cd-62e7-4b9d-8f01-042ae73f8dd9', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (19, 2, 1, 1, NULL, 1235.2000, 1, '2025-11-17 16:53:50.784199', '2025-11-17 16:53:50.784199', '2025-11-18 11:00:00', NULL, 0, NULL, NULL, NULL, 1200.0000, NULL, ',n ,', NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '5513f3fb-b46b-4ac4-acc2-e8d3d7d007f4', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (11, 2, 1, 1, NULL, 1750.0000, 1, '2025-11-16 22:59:16.23025', '2025-11-16 22:59:16.23025', '2025-11-17 12:00:00', NULL, 0, NULL, 'x', NULL, 1200.0000, NULL, NULL, NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '167c986d-f915-4293-88cd-51e356883824', '', NULL, 0, NULL, NULL, 0, false, NULL, '1', NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (20, 12, 1, 1, NULL, 615.0000, 1, '2025-11-17 22:54:11.266391', '2025-11-17 22:54:11.266391', '2025-11-19 13:00:00', NULL, 0, NULL, 'dfefgf', NULL, 120.0000, NULL, 'sdfsd fsdfs', NULL, NULL, 1, 0, NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', 'cb903cf5-cebe-4f68-96c6-42093f159dd9', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (12, 10, 1, 1, NULL, 615.0000, 1, '2025-11-17 11:37:14.880664', '2025-11-17 23:00:48.333885', '2025-11-19 13:00:00', NULL, 0, NULL, 'fgfb', 4, 120.0000, NULL, 'cvxcv', NULL, NULL, 1, 0, NULL, NULL, NULL, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '58709c41-be75-47d7-980a-9dcd1154e6c8', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (21, 2, 1, 1, NULL, 47.2000, 0, '2025-11-30 08:28:11.314904', '2025-11-30 08:28:11.314904', '2025-12-01 11:00:00', NULL, 0, NULL, 'dfsdf', NULL, 12.0000, NULL, 'csd sds sdfdsf s', NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', 'a03acc39-8971-438d-85ce-830614108c78', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (27, 15, 1, 1, NULL, 84.6000, 1, '2025-11-30 08:50:17.223648', '2025-11-30 09:12:15.232565', '2025-11-30 10:00:00', NULL, 0, NULL, NULL, NULL, 12.0000, NULL, 'dfsdfsdfdsffsdf', NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '969e858a-09c4-47c3-af32-467f66aba62b', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (25, 12, 1, 1, NULL, 864.8652, 1, '2025-11-30 08:39:59.895811', '2025-11-30 11:42:01.775949', '2025-12-01 11:00:00', NULL, 0, NULL, NULL, NULL, 12.0000, NULL, 'jsd sjdbsjk fbskf', NULL, NULL, 1, 0, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '6bd4afcf-a13b-4ecc-bd38-9d4135c6c967', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'pickup');
INSERT INTO public.orders VALUES (23, 2, 1, 1, NULL, 161.8000, 2, '2025-11-30 08:29:35.12773', '2025-12-03 07:36:23.994343', '2025-12-03 12:00:00', NULL, 0, NULL, NULL, NULL, 120.0000, NULL, 'fj sdfksjdfb ', NULL, NULL, 1, 0, NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '2a9951be-8f17-4e78-8e8c-3fb212845ba3', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'succeeded', 'manual', '{"processed_at": "2025-12-03T02:06:23.994Z", "payment_method": "card", "transaction_id": "manual_23_1764727583972"}', '2025-12-03 07:36:23.994343', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.orders VALUES (28, 16, 1, 1, NULL, 273.8000, 4, '2025-11-30 10:17:07.863847', '2025-12-03 14:10:03.4545', '2025-12-01 12:00:00', NULL, 0, NULL, NULL, 2, 12.0000, NULL, 'f sddf dfdsfsdf sd', NULL, NULL, 1, 0, NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'No', '3ff31f23-cc2c-4cb3-98cd-123c261b2bd3', '', NULL, 0, NULL, NULL, 0, false, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', 'pinpayments', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'pickup');


--
-- TOC entry 4385 (class 0 OID 37408)
-- Dependencies: 285
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4387 (class 0 OID 37465)
-- Dependencies: 287
-- Data for Name: payment_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4373 (class 0 OID 35211)
-- Dependencies: 272
-- Data for Name: payment_history; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.payment_history VALUES (1, 23, 'manual_23_1764727583972', 'charge', 'succeeded', 'manual', 161.80, 'AUD', 0.00, 'vasu.singampalli@gmail.com', 2, '4242', NULL, NULL, NULL, NULL, 'card', '{"processed_at": "2025-12-03T02:06:23.974Z", "card_provided": true, "payment_method": "card", "manual_processing": true, "payment_completed": {"success": true, "completed_at": "2025-12-03T02:06:24.002Z", "order_status": 2}}', NULL, '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', 'bf1c3bd0-5f7a-42ca-958f-cf2d6e728335', 'order_23_1764727583972', '2025-12-03 07:36:23.974827', '2025-12-03 07:36:24.002553', '2025-12-03 07:36:24.002553', '{"order_id": 23, "customer_id": 2}', NULL);


--
-- TOC entry 4383 (class 0 OID 37389)
-- Dependencies: 283
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4331 (class 0 OID 28171)
-- Dependencies: 230
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product VALUES (39, '8oz St Dreux Cups', '8oz branded St Dreux cups, 1,000 pcs per carton. Premium quality disposable cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 65.9900, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 39.59, 40.00);
INSERT INTO public.product VALUES (40, '8oz Lids (White)', '8oz white cup lids, 1,000 pcs per carton. Secure fit for 8oz cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 37.3900, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 22.43, 40.00);
INSERT INTO public.product VALUES (16, 'Chamomile Blossoms', 'Premium loose leaf chamomile blossoms, 250g. Perfect for relaxation and calming moments.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 47.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 28.50, 40.00);
INSERT INTO public.product VALUES (17, 'English Breakfast', 'Classic English breakfast tea, 500g loose leaf. Rich and robust blend perfect for mornings.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 57.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 34.50, 40.00);
INSERT INTO public.product VALUES (18, 'Lemongrass Ginger', 'Aromatic lemongrass and ginger blend, 250g loose leaf. Warming and invigorating.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 47.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 28.50, 40.00);
INSERT INTO public.product VALUES (19, 'Peppermint', 'Refreshing peppermint tea, 250g loose leaf. Natural digestive aid and refreshing taste.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 47.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 28.50, 40.00);
INSERT INTO public.product VALUES (20, 'Oriental Jasmine Green', 'Delicate jasmine-scented green tea, 250g loose leaf. Fragrant and elegant.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 45.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 27.00, 40.00);
INSERT INTO public.product VALUES (21, 'Supreme Earl Grey', 'Premium Earl Grey tea with bergamot, 500g loose leaf. Classic and sophisticated.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 57.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 34.50, 40.00);
INSERT INTO public.product VALUES (22, 'Chamomile Blossoms - Pyramid Bags', 'Premium chamomile blossoms in pyramid tea bags, 100 count. Convenient single-serve format.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 62.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 37.20, 40.00);
INSERT INTO public.product VALUES (23, 'English Breakfast - Pyramid Bags', 'Classic English breakfast tea in pyramid bags, 100 count. Rich and robust blend.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 62.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 37.20, 40.00);
INSERT INTO public.product VALUES (45, '8oz Cups', '8oz generic cups, 1,000 pcs per carton. Standard quality disposable cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 63.7800, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 38.27, 40.00);
INSERT INTO public.product VALUES (46, '8oz Lids (Generic)', '8oz generic cup lids, 1,000 pcs per carton. Standard quality lids.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 37.3900, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 22.43, 40.00);
INSERT INTO public.product VALUES (47, '12oz Cups', '12oz generic cups, 1,000 pcs per carton. Standard quality disposable cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 90.2200, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 54.13, 40.00);
INSERT INTO public.product VALUES (48, '12oz Lids (Generic)', '12oz generic cup lids, 1,000 pcs per carton. Standard quality lids.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 43.9800, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 26.39, 40.00);
INSERT INTO public.product VALUES (49, '4 Cup Carry Tray', '4 cup carry tray, 200 pcs per carton. Convenient multi-cup carrier.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 32.9900, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 19.79, 40.00);
INSERT INTO public.product VALUES (50, '2 Cup Carry Tray', '2 cup carry tray, 200 pcs per carton. Convenient dual-cup carrier.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 20.9000, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 12.54, 40.00);
INSERT INTO public.product VALUES (51, 'Caramel Syrup', 'Rich caramel flavored syrup, 1 litre. Perfect for coffee and beverage flavoring.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 24.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 14.40, 40.00);
INSERT INTO public.product VALUES (24, 'Lemongrass Ginger - Pyramid Bags', 'Aromatic lemongrass and ginger blend in pyramid bags, 100 count. Warming and invigorating.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 62.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 37.20, 40.00);
INSERT INTO public.product VALUES (25, 'Peppermint - Pyramid Bags', 'Refreshing peppermint tea in pyramid bags, 100 count. Natural digestive aid.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 62.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 37.20, 40.00);
INSERT INTO public.product VALUES (26, 'Oriental Jasmine Green - Pyramid Bags', 'Delicate jasmine-scented green tea in pyramid bags, 100 count. Fragrant and elegant.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 62.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 37.20, 40.00);
INSERT INTO public.product VALUES (27, 'Supreme Earl Grey - Pyramid Bags', 'Premium Earl Grey tea with bergamot in pyramid bags, 100 count. Classic and sophisticated.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 62.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 37.20, 40.00);
INSERT INTO public.product VALUES (28, 'Drinking Chocolate', 'Rich and creamy drinking chocolate powder, 1kg. Perfect for hot chocolate drinks.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 23.1000, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 13.86, 40.00);
INSERT INTO public.product VALUES (29, 'Traditional Spice Chai Latte Powder', 'Authentic spiced chai latte powder, 1kg. Warming blend of spices and tea.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 37.3900, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 22.43, 40.00);
INSERT INTO public.product VALUES (30, 'Honey Spice Sticky Chai', 'Honey-infused sticky chai blend, 500g. Sweet and spicy with natural honey.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 45.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 27.00, 40.00);
INSERT INTO public.product VALUES (31, 'Culinary Matcha Latte', 'Premium culinary grade matcha powder for lattes, 1kg. Smooth and vibrant green.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 165.0500, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 99.03, 40.00);
INSERT INTO public.product VALUES (32, 'Organic Matcha Latte', 'Organic matcha powder for lattes, 100g. Certified organic and premium quality.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 32.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 19.50, 40.00);
INSERT INTO public.product VALUES (33, 'Ceremonial Original Green Matcha', 'Premium ceremonial grade matcha, 30g tin. Highest quality for traditional tea ceremony.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 35.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 21.00, 40.00);
INSERT INTO public.product VALUES (34, 'Turmeric Latte', 'Golden turmeric latte powder, 100g. Anti-inflammatory and warming spice blend.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 22.5000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 13.50, 40.00);
INSERT INTO public.product VALUES (35, 'Decaf Coffee', 'Smooth decaffeinated coffee beans, 1kg. Full flavor without the caffeine.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 65.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 39.00, 40.00);
INSERT INTO public.product VALUES (36, 'Single Origin Coffee', 'Premium single origin coffee beans. Please contact for specific origin pricing and availability.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 0.00, 40.00);
INSERT INTO public.product VALUES (37, '4oz St Dreux Cups', '4oz branded St Dreux cups, 1,000 pcs per carton. Premium quality disposable cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 31.9000, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 19.14, 40.00);
INSERT INTO public.product VALUES (38, '4oz Lids', '4oz cup lids, 1,000 pcs per carton. Secure fit for 4oz cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 28.5900, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 17.15, 40.00);
INSERT INTO public.product VALUES (41, '12oz St Dreux Cups', '12oz branded St Dreux cups, 1,000 pcs per carton. Premium quality disposable cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 83.5700, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 50.14, 40.00);
INSERT INTO public.product VALUES (42, '12oz Lids (White)', '12oz white cup lids, 1,000 pcs per carton. Secure fit for 12oz cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 43.9800, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 26.39, 40.00);
INSERT INTO public.product VALUES (43, '4oz Cups', '4oz generic cups, 1,000 pcs per carton. Standard quality disposable cups.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 36.3100, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 21.79, 40.00);
INSERT INTO public.product VALUES (52, 'Hazelnut Syrup', 'Smooth hazelnut flavored syrup, 1 litre. Classic coffee flavoring.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 24.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 14.40, 40.00);
INSERT INTO public.product VALUES (53, 'Vanilla Syrup', 'Classic vanilla flavored syrup, 1 litre. Versatile flavoring for beverages.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 24.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 14.40, 40.00);
INSERT INTO public.product VALUES (54, 'Liquid Sugar', 'Liquid sugar syrup, 1 litre. Easy-to-use sweetener for beverages.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 14.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-02 07:52:18.717689', 0, 1, NULL, 1, NULL, 'all', 8.40, 40.00);
INSERT INTO public.product VALUES (44, '4oz Lids (Generic)', '4oz generic cup lids, 1,000 pcs per carton. Standard quality lids.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 30.8100, '2025-12-01 19:02:23.036061', 1, 0, '2025-12-01 19:02:23.036061', '2025-12-01 19:02:23.036061', 0, 1, NULL, 1, NULL, 'all', 18.49, 40.00);
INSERT INTO public.product VALUES (55, 'Coffee Machine Cleaner', 'Professional coffee machine cleaning solution. Keeps your equipment in optimal condition.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'https://caterly-uploads-unique-id.s3.ap-southeast-2.amazonaws.com/stn_assets/product-55-1764599163978.png', 31.0000, '2025-12-01 19:02:23.036061', 1, 1, '2025-12-01 19:02:23.036061', '2025-12-02 10:36:35.451425', 0, 1, NULL, 1, NULL, 'all', 18.60, 40.00);
INSERT INTO public.product VALUES (56, 'vasu g', 'test', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 23.0000, '2025-12-02 10:50:09.101305', 1, 1, '2025-12-02 10:50:09.101305', '2025-12-02 13:31:32.441625', 0, 1, NULL, 0, NULL, 'wholesalers', 13.80, 40.00);


--
-- TOC entry 4332 (class 0 OID 28193)
-- Dependencies: 231
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_category VALUES (16, 10);
INSERT INTO public.product_category VALUES (17, 10);
INSERT INTO public.product_category VALUES (18, 10);
INSERT INTO public.product_category VALUES (19, 10);
INSERT INTO public.product_category VALUES (20, 10);
INSERT INTO public.product_category VALUES (21, 10);
INSERT INTO public.product_category VALUES (22, 10);
INSERT INTO public.product_category VALUES (23, 10);
INSERT INTO public.product_category VALUES (24, 10);
INSERT INTO public.product_category VALUES (25, 10);
INSERT INTO public.product_category VALUES (26, 10);
INSERT INTO public.product_category VALUES (27, 10);
INSERT INTO public.product_category VALUES (28, 11);
INSERT INTO public.product_category VALUES (29, 11);
INSERT INTO public.product_category VALUES (30, 11);
INSERT INTO public.product_category VALUES (31, 11);
INSERT INTO public.product_category VALUES (32, 11);
INSERT INTO public.product_category VALUES (33, 11);
INSERT INTO public.product_category VALUES (34, 11);
INSERT INTO public.product_category VALUES (35, 12);
INSERT INTO public.product_category VALUES (36, 12);
INSERT INTO public.product_category VALUES (37, 13);
INSERT INTO public.product_category VALUES (38, 13);
INSERT INTO public.product_category VALUES (39, 13);
INSERT INTO public.product_category VALUES (40, 13);
INSERT INTO public.product_category VALUES (41, 13);
INSERT INTO public.product_category VALUES (42, 13);
INSERT INTO public.product_category VALUES (43, 13);
INSERT INTO public.product_category VALUES (44, 13);
INSERT INTO public.product_category VALUES (45, 13);
INSERT INTO public.product_category VALUES (46, 13);
INSERT INTO public.product_category VALUES (47, 13);
INSERT INTO public.product_category VALUES (48, 13);
INSERT INTO public.product_category VALUES (49, 13);
INSERT INTO public.product_category VALUES (50, 13);
INSERT INTO public.product_category VALUES (51, 14);
INSERT INTO public.product_category VALUES (52, 14);
INSERT INTO public.product_category VALUES (53, 14);
INSERT INTO public.product_category VALUES (54, 14);
INSERT INTO public.product_category VALUES (55, 15);
INSERT INTO public.product_category VALUES (56, 15);


--
-- TOC entry 4329 (class 0 OID 28162)
-- Dependencies: 228
-- Data for Name: product_header; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_header VALUES (1, 'Breakfast Packages', NULL);
INSERT INTO public.product_header VALUES (2, 'Lunch Packages', NULL);
INSERT INTO public.product_header VALUES (3, 'Catering Platters', NULL);
INSERT INTO public.product_header VALUES (4, 'Add-ons', NULL);
INSERT INTO public.product_header VALUES (5, 'Beverages', NULL);


--
-- TOC entry 4377 (class 0 OID 37329)
-- Dependencies: 277
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_images VALUES (6, 54, 'https://caterly-uploads-unique-id.s3.ap-southeast-2.amazonaws.com/stn_assets/product-54-1764642136233.png', 0, '2025-12-02 07:52:18.717689');
INSERT INTO public.product_images VALUES (7, 54, 'https://caterly-uploads-unique-id.s3.ap-southeast-2.amazonaws.com/stn_assets/product-54-1764642137775.png', 1, '2025-12-02 07:52:18.717689');
INSERT INTO public.product_images VALUES (11, 55, 'https://caterly-uploads-unique-id.s3.ap-southeast-2.amazonaws.com/stn_assets/product-55-1764599163978.png', 0, '2025-12-02 10:36:35.451425');
INSERT INTO public.product_images VALUES (12, 55, 'https://caterly-uploads-unique-id.s3.ap-southeast-2.amazonaws.com/stn_assets/product-55-1764599168488.png', 1, '2025-12-02 10:36:35.451425');
INSERT INTO public.product_images VALUES (13, 55, 'https://caterly-uploads-unique-id.s3.ap-southeast-2.amazonaws.com/stn_assets/product-55-1764598732494.png', 2, '2025-12-02 10:36:35.451425');


--
-- TOC entry 4339 (class 0 OID 28243)
-- Dependencies: 238
-- Data for Name: product_option; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_option VALUES (28, 16, 22, 0, 47.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (29, 18, 22, 0, 47.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (30, 19, 22, 0, 47.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (31, 20, 22, 0, 45.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (32, 17, 23, 0, 57.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (33, 21, 23, 0, 57.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (34, 22, 25, 0, 62.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (35, 23, 25, 0, 62.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (36, 24, 25, 0, 62.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (37, 25, 25, 0, 62.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (38, 26, 25, 0, 62.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (39, 27, 25, 0, 62.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (40, 28, 24, 0, 23.1000, '+', 0.00);
INSERT INTO public.product_option VALUES (41, 29, 24, 0, 37.3900, '+', 0.00);
INSERT INTO public.product_option VALUES (42, 31, 24, 0, 165.0500, '+', 0.00);
INSERT INTO public.product_option VALUES (43, 30, 23, 0, 45.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (44, 32, 28, 0, 32.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (45, 34, 28, 0, 22.5000, '+', 0.00);
INSERT INTO public.product_option VALUES (46, 33, 27, 0, 35.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (47, 35, 24, 0, 65.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (48, 51, 26, 0, 24.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (49, 52, 26, 0, 24.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (50, 53, 26, 0, 24.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (52, 54, 26, 0, 14.0000, '+', 0.00);
INSERT INTO public.product_option VALUES (55, 56, 29, 0, 13.0000, '+', 0.00);


--
-- TOC entry 4349 (class 0 OID 28353)
-- Dependencies: 248
-- Data for Name: quote; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4371 (class 0 OID 35169)
-- Dependencies: 270
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings VALUES (39, 'pinpayments_test_mode', 'true', 'system', 'boolean', 'Use PinPayments test mode', '2025-11-16 00:50:53.188042', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (40, 'pinpayments_webhook_secret', '', 'system', 'string', 'PinPayments webhook secret', '2025-11-16 00:50:53.188042', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (15, 'language', 'en', 'appearance', 'string', 'Application language', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (14, 'primary_color', '#fd0d55', 'appearance', 'string', 'Primary color', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (13, 'theme', 'light', 'appearance', 'string', 'Application theme', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (2, 'company_email', 'admin@stdreuxcoffee.com', 'general', 'string', 'Company email address', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (1, 'company_name', 'St. Dreux Coffee', 'general', 'string', 'Company name', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (3, 'company_phone', '+1 (555) 123-4567', 'general', 'string', 'Company phone number', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (5, 'currency', 'USD', 'general', 'string', 'Default currency', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (4, 'timezone', 'America/New_York', 'general', 'string', 'Application timezone', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (9, 'customer_notifications', 'true', 'notifications', 'boolean', 'Enable customer notifications', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (6, 'email_notifications', 'false', 'notifications', 'boolean', 'Enable email notifications', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (8, 'order_notifications', 'false', 'notifications', 'boolean', 'Enable order notifications', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (7, 'push_notifications', 'true', 'notifications', 'boolean', 'Enable push notifications', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (12, 'password_expiry', '90', 'security', 'number', 'Password expiry in days', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (11, 'session_timeout', '30', 'security', 'number', 'Session timeout in minutes', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (10, 'two_factor_auth', 'false', 'security', 'boolean', 'Enable two-factor authentication', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (17, 'cache_enabled', 'true', 'system', 'boolean', 'Enable caching', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (18, 'log_level', 'info', 'system', 'string', 'Logging level', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (16, 'maintenance_mode', 'false', 'system', 'boolean', 'Maintenance mode status', '2025-11-16 00:45:12.482435', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (38, 'pinpayments_publishable_key', '', 'system', 'string', 'PinPayments publishable key', '2025-11-16 00:50:53.188042', '2025-11-16 07:44:32.165871');
INSERT INTO public.settings VALUES (37, 'pinpayments_secret_key', '', 'system', 'string', 'PinPayments secret key', '2025-11-16 00:50:53.188042', '2025-11-16 07:44:32.165871');


--
-- TOC entry 4321 (class 0 OID 28114)
-- Dependencies: 220
-- Data for Name: store; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.store VALUES (1, 'Caterly Melbourne Central', 'melbourne', 1, 1, 3000, 1, true, '123 Collins Street, Melbourne VIC 3000');


--
-- TOC entry 4357 (class 0 OID 28458)
-- Dependencies: 256
-- Data for Name: survey; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 4313 (class 0 OID 28030)
-- Dependencies: 212
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."user" VALUES (4, 'john.doe@stdreuxcoffee.com', 'John Doe', NULL, '$2b$10$l3ZxL/WrN1Yl0.p8lcl5BO9OucfDPLQ7EYMQjjSoEs8CtmLZZzN/i', 3, NULL, NULL, NULL, 'St Dreux Coffee', NULL, NULL, NULL, NULL, NULL, '63fea445-d485-45f6-8743-cdccdd90f6e1', 'e0ffd2bf-27a5-460d-a998-d8a2579118e4', 0, '2025-11-11 11:40:55.343897', '2025-11-11 11:40:55.343897');
INSERT INTO public."user" VALUES (5, 'jane.smith@stdreuxcoffee.com', 'Jane Smith', NULL, '$2b$10$bSJZShSy6MUUNjHPaRZm4.83IXlqggPlQaN2uKUrP5A4Lmix4I5aW', 3, NULL, NULL, NULL, 'St Dreux Coffee', NULL, NULL, NULL, NULL, NULL, '8430dddb-7673-47af-b21e-1af46bba1c25', '6e693757-8ba9-4335-a13e-b501aeb95eb7', 0, '2025-11-11 11:41:05.451372', '2025-11-11 11:41:05.451372');
INSERT INTO public."user" VALUES (6, 'mike.johnson@stdreuxcoffee.com', 'Mike Johnson', NULL, '$2b$10$aND4M8/nwF.KiZMJ6CAEi.Pu7xcv.OCLFnq8t2XtnqTV.ydJ4USma', 2, NULL, NULL, NULL, 'St Dreux Coffee', NULL, NULL, NULL, NULL, NULL, '2ce11589-c26d-4653-9f51-f5bca2704599', 'c9d7c256-dfd6-4584-b489-c7dd2449aaf8', 0, '2025-11-11 11:41:05.507728', '2025-11-11 11:41:05.507728');
INSERT INTO public."user" VALUES (7, 'sarah.brown@stdreuxcoffee.com', 'Sarah Brown', NULL, '$2b$10$9Te5pUC9xNXUiLyKEf4RLudDzp3e/yQZvPk4pTuuH0SSejntEukCa', 3, NULL, NULL, NULL, 'St Dreux Coffee', NULL, NULL, NULL, NULL, NULL, 'ed340317-524a-4968-adcc-2bb7a9e3e7fb', 'c22c3071-b4a4-48ff-8ee8-cc57c865e692', 0, '2025-11-11 11:41:05.563026', '2025-11-11 11:41:05.563026');
INSERT INTO public."user" VALUES (1, 'superadmin@stdreux.com', 'Super Admin', 'superadmin', '$2b$10$8MAAwoiaUFIRhFuRvZ21ue3r7f1Cs/.mBpefeaBMKAkTwS5F.gS6K', 1, NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, '', '8272fc3f-4d50-459d-a280-7053a39bc964', 'aac51f48-adc4-40c5-9c0d-93061a023f77', 0, '2025-11-05 09:05:10.318066', '2025-11-11 11:52:39.380936');
INSERT INTO public."user" VALUES (8, 'vasu.singampalli@gmail.com', 'vasu', NULL, '$2b$10$m1EdEoJ/VawE6TzNIMMvoeGnrVtzHb/r/i5Vfo80dPkW6xxG7gTm2', 3, NULL, NULL, NULL, 'tttt', NULL, NULL, NULL, NULL, '', '43d5d0c6-248e-43c7-80d2-c021d69ff205', '72077856-dd1d-44b6-b9d8-fcd327ba096a', 0, '2025-11-11 11:53:11.471994', '2025-11-11 11:53:11.471994');
INSERT INTO public."user" VALUES (9, 'test@test.com', 'vasu vasu', 'test@test.com', '$2b$10$0XON3IokZsMcfNfW9NMruuTwxPCpqlYtsorGgqqM/0fiB30w6WBAm', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'c6240fd1-d98e-4cce-a2ad-c3ce82b4392b', 'ebd0d126-2b54-4cb7-bef9-7f5341b4e0ea', 1, '2025-11-23 15:14:52.257657', '2025-11-23 15:14:52.257657');
INSERT INTO public."user" VALUES (10, 'vv@gg.com', 'vasu dsd', 'vv@gg.com', '$2b$10$eieQ06600RU5WZGImNRZdehtKS8AQGL4cYl1qgPAjuLW.HkaXp4Pa', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '7ff6bc01-726a-4901-aa38-91fe8f1bfee7', 'b1e35d18-e6f1-4ca3-8c4d-1055413e69b8', 0, '2025-11-23 15:17:37.333831', '2025-11-23 15:17:37.333831');
INSERT INTO public."user" VALUES (11, 'vvddffdd@gg.com', 'vasuvvd vasuvvd', 'vvddffdd@gg.com', '$2b$10$N71se9QldRwLriaCDP0lROhD3UQ0tlB0AKTs2dK7ZzEKWDzDF6ab.', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '32d248f4-dcc5-4ed9-bbed-60e99a803b21', 'ff4cae72-0011-46bd-83eb-f00990eafc86', 0, '2025-12-01 22:59:16.14003', '2025-12-01 22:59:16.14003');


--
-- TOC entry 4325 (class 0 OID 28137)
-- Dependencies: 224
-- Data for Name: user_postcode; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_postcode VALUES (1, 1, 3000);
INSERT INTO public.user_postcode VALUES (2, 1, 3001);
INSERT INTO public.user_postcode VALUES (3, 1, 3002);
INSERT INTO public.user_postcode VALUES (4, 1, 3003);
INSERT INTO public.user_postcode VALUES (5, 1, 3121);
INSERT INTO public.user_postcode VALUES (6, 1, 3182);
INSERT INTO public.user_postcode VALUES (7, 1, 3183);


--
-- TOC entry 4381 (class 0 OID 37371)
-- Dependencies: 281
-- Data for Name: wholesale_enquiries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.wholesale_enquiries VALUES (1, 'sdfsd', 'dfdf', 'dfsd', 'vv@ggggg.com', '432342333', 'sds ds fs', 'd s', 'ap', '531085', 'dsfds', 'http://localhost:3006/wholesale', 'df', 'dsfdsf', '2009', 'new', '2025-12-02 16:31:57.551168', '2025-12-02 16:31:57.551168');


--
-- TOC entry 4477 (class 0 OID 0)
-- Dependencies: 225
-- Name: category_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.category_category_id_seq', 15, true);


--
-- TOC entry 4478 (class 0 OID 0)
-- Dependencies: 251
-- Name: catering_checklist_catering_checklist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.catering_checklist_catering_checklist_id_seq', 1, false);


--
-- TOC entry 4479 (class 0 OID 0)
-- Dependencies: 213
-- Name: company_company_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.company_company_id_seq', 4, true);


--
-- TOC entry 4480 (class 0 OID 0)
-- Dependencies: 278
-- Name: contact_inquiries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_inquiries_id_seq', 3, true);


--
-- TOC entry 4481 (class 0 OID 0)
-- Dependencies: 249
-- Name: coupon_coupon_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupon_coupon_id_seq', 4, true);


--
-- TOC entry 4482 (class 0 OID 0)
-- Dependencies: 217
-- Name: customer_customer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_customer_id_seq', 17, true);


--
-- TOC entry 4483 (class 0 OID 0)
-- Dependencies: 253
-- Name: customer_feedback_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_feedback_feedback_id_seq', 3, true);


--
-- TOC entry 4484 (class 0 OID 0)
-- Dependencies: 274
-- Name: customer_product_option_disco_customer_product_option_disco_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_product_option_disco_customer_product_option_disco_seq', 47, true);


--
-- TOC entry 4485 (class 0 OID 0)
-- Dependencies: 267
-- Name: customer_type_customer_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_type_customer_type_id_seq', 4, true);


--
-- TOC entry 4486 (class 0 OID 0)
-- Dependencies: 215
-- Name: department_department_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.department_department_id_seq', 4, true);


--
-- TOC entry 4487 (class 0 OID 0)
-- Dependencies: 221
-- Name: locations_location_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.locations_location_id_seq', 7, true);


--
-- TOC entry 4488 (class 0 OID 0)
-- Dependencies: 263
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 1, true);


--
-- TOC entry 4489 (class 0 OID 0)
-- Dependencies: 257
-- Name: notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notification_id_seq', 1, false);


--
-- TOC entry 4490 (class 0 OID 0)
-- Dependencies: 235
-- Name: option_value_option_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.option_value_option_value_id_seq', 32, true);


--
-- TOC entry 4491 (class 0 OID 0)
-- Dependencies: 233
-- Name: options_option_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.options_option_id_seq', 7, true);


--
-- TOC entry 4492 (class 0 OID 0)
-- Dependencies: 265
-- Name: order_checklist_checklist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_checklist_checklist_id_seq', 2, true);


--
-- TOC entry 4493 (class 0 OID 0)
-- Dependencies: 245
-- Name: order_images_order_image_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_images_order_image_id_seq', 1, false);


--
-- TOC entry 4494 (class 0 OID 0)
-- Dependencies: 243
-- Name: order_product_option_order_product_option_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_product_option_order_product_option_id_seq', 19, true);


--
-- TOC entry 4495 (class 0 OID 0)
-- Dependencies: 241
-- Name: order_product_order_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_product_order_product_id_seq', 89, true);


--
-- TOC entry 4496 (class 0 OID 0)
-- Dependencies: 259
-- Name: ordercompanyinfo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ordercompanyinfo_id_seq', 1, false);


--
-- TOC entry 4497 (class 0 OID 0)
-- Dependencies: 239
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 29, true);


--
-- TOC entry 4498 (class 0 OID 0)
-- Dependencies: 284
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- TOC entry 4499 (class 0 OID 0)
-- Dependencies: 286
-- Name: payment_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_audit_log_id_seq', 1, false);


--
-- TOC entry 4500 (class 0 OID 0)
-- Dependencies: 271
-- Name: payment_history_payment_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_history_payment_history_id_seq', 1, true);


--
-- TOC entry 4501 (class 0 OID 0)
-- Dependencies: 282
-- Name: payment_transactions_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_transactions_transaction_id_seq', 1, false);


--
-- TOC entry 4502 (class 0 OID 0)
-- Dependencies: 227
-- Name: product_header_heading_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_header_heading_id_seq', 5, true);


--
-- TOC entry 4503 (class 0 OID 0)
-- Dependencies: 276
-- Name: product_images_product_image_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_images_product_image_id_seq', 13, true);


--
-- TOC entry 4504 (class 0 OID 0)
-- Dependencies: 237
-- Name: product_option_product_option_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_option_product_option_id_seq', 55, true);


--
-- TOC entry 4505 (class 0 OID 0)
-- Dependencies: 229
-- Name: product_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_product_id_seq', 56, true);


--
-- TOC entry 4506 (class 0 OID 0)
-- Dependencies: 247
-- Name: quote_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quote_order_id_seq', 1, false);


--
-- TOC entry 4507 (class 0 OID 0)
-- Dependencies: 269
-- Name: settings_setting_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_setting_id_seq', 44, true);


--
-- TOC entry 4508 (class 0 OID 0)
-- Dependencies: 219
-- Name: store_location_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.store_location_id_seq', 1, false);


--
-- TOC entry 4509 (class 0 OID 0)
-- Dependencies: 255
-- Name: survey_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.survey_id_seq', 1, false);


--
-- TOC entry 4510 (class 0 OID 0)
-- Dependencies: 223
-- Name: user_postcode_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_postcode_id_seq', 7, true);


--
-- TOC entry 4511 (class 0 OID 0)
-- Dependencies: 211
-- Name: user_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_user_id_seq', 11, true);


--
-- TOC entry 4512 (class 0 OID 0)
-- Dependencies: 280
-- Name: wholesale_enquiries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wholesale_enquiries_id_seq', 1, true);


--
-- TOC entry 3985 (class 2606 OID 28155)
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (category_id);


--
-- TOC entry 4030 (class 2606 OID 28425)
-- Name: catering_checklist catering_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catering_checklist
    ADD CONSTRAINT catering_checklist_pkey PRIMARY KEY (catering_checklist_id);


--
-- TOC entry 3961 (class 2606 OID 28060)
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (company_id);


--
-- TOC entry 4089 (class 2606 OID 37366)
-- Name: contact_inquiries contact_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_inquiries
    ADD CONSTRAINT contact_inquiries_pkey PRIMARY KEY (id);


--
-- TOC entry 4026 (class 2606 OID 28401)
-- Name: coupon coupon_coupon_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon
    ADD CONSTRAINT coupon_coupon_code_key UNIQUE (coupon_code);


--
-- TOC entry 4028 (class 2606 OID 28399)
-- Name: coupon coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon
    ADD CONSTRAINT coupon_pkey PRIMARY KEY (coupon_id);


--
-- TOC entry 4032 (class 2606 OID 28446)
-- Name: customer_feedback customer_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_pkey PRIMARY KEY (feedback_id);


--
-- TOC entry 4042 (class 2606 OID 28512)
-- Name: customer_id_count customer_id_count_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_id_count
    ADD CONSTRAINT customer_id_count_pkey PRIMARY KEY (customer_id);


--
-- TOC entry 3968 (class 2606 OID 28099)
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (customer_id);


--
-- TOC entry 4075 (class 2606 OID 35729)
-- Name: customer_product_option_discount customer_product_option_disco_customer_id_product_id_option_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_option_discount
    ADD CONSTRAINT customer_product_option_disco_customer_id_product_id_option_key UNIQUE (customer_id, product_id, option_value_id);


--
-- TOC entry 4077 (class 2606 OID 35727)
-- Name: customer_product_option_discount customer_product_option_discount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_option_discount
    ADD CONSTRAINT customer_product_option_discount_pkey PRIMARY KEY (customer_product_option_discount_id);


--
-- TOC entry 4053 (class 2606 OID 29757)
-- Name: customer_type customer_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_type
    ADD CONSTRAINT customer_type_pkey PRIMARY KEY (customer_type_id);


--
-- TOC entry 4055 (class 2606 OID 29759)
-- Name: customer_type customer_type_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_type
    ADD CONSTRAINT customer_type_type_name_key UNIQUE (type_name);


--
-- TOC entry 3965 (class 2606 OID 28075)
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (department_id);


--
-- TOC entry 3997 (class 2606 OID 28212)
-- Name: heading_product heading_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heading_product
    ADD CONSTRAINT heading_product_pkey PRIMARY KEY (product_id, heading_id);


--
-- TOC entry 3980 (class 2606 OID 28135)
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (location_id);


--
-- TOC entry 4046 (class 2606 OID 28528)
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4038 (class 2606 OID 28482)
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- TOC entry 4001 (class 2606 OID 28236)
-- Name: option_value option_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option_value
    ADD CONSTRAINT option_value_pkey PRIMARY KEY (option_value_id);


--
-- TOC entry 3999 (class 2606 OID 28229)
-- Name: options options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.options
    ADD CONSTRAINT options_pkey PRIMARY KEY (option_id);


--
-- TOC entry 4049 (class 2606 OID 29170)
-- Name: order_checklist order_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_checklist
    ADD CONSTRAINT order_checklist_pkey PRIMARY KEY (checklist_id);


--
-- TOC entry 4020 (class 2606 OID 28346)
-- Name: order_images order_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_images
    ADD CONSTRAINT order_images_pkey PRIMARY KEY (order_image_id);


--
-- TOC entry 4018 (class 2606 OID 28329)
-- Name: order_product_option order_product_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product_option
    ADD CONSTRAINT order_product_option_pkey PRIMARY KEY (order_product_option_id);


--
-- TOC entry 4016 (class 2606 OID 28308)
-- Name: order_product order_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product
    ADD CONSTRAINT order_product_pkey PRIMARY KEY (order_product_id);


--
-- TOC entry 4040 (class 2606 OID 28501)
-- Name: ordercompanyinfo ordercompanyinfo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordercompanyinfo
    ADD CONSTRAINT ordercompanyinfo_pkey PRIMARY KEY (id);


--
-- TOC entry 4044 (class 2606 OID 28517)
-- Name: orderids_count orderids_count_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderids_count
    ADD CONSTRAINT orderids_count_pkey PRIMARY KEY (order_id);


--
-- TOC entry 4012 (class 2606 OID 28280)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 4108 (class 2606 OID 37415)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4110 (class 2606 OID 37417)
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- TOC entry 4118 (class 2606 OID 37473)
-- Name: payment_audit_log payment_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_log
    ADD CONSTRAINT payment_audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 4069 (class 2606 OID 35229)
-- Name: payment_history payment_history_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_idempotency_key_key UNIQUE (idempotency_key);


--
-- TOC entry 4071 (class 2606 OID 35227)
-- Name: payment_history payment_history_payment_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_payment_transaction_id_key UNIQUE (payment_transaction_id);


--
-- TOC entry 4073 (class 2606 OID 35225)
-- Name: payment_history payment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_pkey PRIMARY KEY (payment_history_id);


--
-- TOC entry 4103 (class 2606 OID 37398)
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (transaction_id);


--
-- TOC entry 3995 (class 2606 OID 28197)
-- Name: product_category product_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_pkey PRIMARY KEY (product_id, category_id);


--
-- TOC entry 3987 (class 2606 OID 28169)
-- Name: product_header product_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_header
    ADD CONSTRAINT product_header_pkey PRIMARY KEY (heading_id);


--
-- TOC entry 4085 (class 2606 OID 37338)
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (product_image_id);


--
-- TOC entry 4004 (class 2606 OID 28249)
-- Name: product_option product_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option
    ADD CONSTRAINT product_option_pkey PRIMARY KEY (product_option_id);


--
-- TOC entry 3993 (class 2606 OID 28185)
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (product_id);


--
-- TOC entry 4024 (class 2606 OID 28372)
-- Name: quote quote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_pkey PRIMARY KEY (order_id);


--
-- TOC entry 4059 (class 2606 OID 35180)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (setting_id);


--
-- TOC entry 4061 (class 2606 OID 35182)
-- Name: settings settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_setting_key_key UNIQUE (setting_key);


--
-- TOC entry 3976 (class 2606 OID 28122)
-- Name: store store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store
    ADD CONSTRAINT store_pkey PRIMARY KEY (location_id);


--
-- TOC entry 4034 (class 2606 OID 28466)
-- Name: survey survey_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey
    ADD CONSTRAINT survey_pkey PRIMARY KEY (id);


--
-- TOC entry 4051 (class 2606 OID 29178)
-- Name: order_checklist unique_order_checklist; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_checklist
    ADD CONSTRAINT unique_order_checklist UNIQUE (order_id);


--
-- TOC entry 4087 (class 2606 OID 37340)
-- Name: product_images unique_product_image_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT unique_product_image_order UNIQUE (product_id, image_order);


--
-- TOC entry 3955 (class 2606 OID 28045)
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- TOC entry 3957 (class 2606 OID 28047)
-- Name: user user_login_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_login_username_key UNIQUE (login_username);


--
-- TOC entry 3959 (class 2606 OID 28043)
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3983 (class 2606 OID 28142)
-- Name: user_postcode user_postcode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_postcode
    ADD CONSTRAINT user_postcode_pkey PRIMARY KEY (id);


--
-- TOC entry 4098 (class 2606 OID 37381)
-- Name: wholesale_enquiries wholesale_enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wholesale_enquiries
    ADD CONSTRAINT wholesale_enquiries_pkey PRIMARY KEY (id);


--
-- TOC entry 3962 (class 1259 OID 28067)
-- Name: idx_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_status ON public.company USING btree (company_status);


--
-- TOC entry 3963 (class 1259 OID 28066)
-- Name: idx_company_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_user ON public.company USING btree (user_id);


--
-- TOC entry 4090 (class 1259 OID 37368)
-- Name: idx_contact_inquiries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_inquiries_created_at ON public.contact_inquiries USING btree (created_at DESC);


--
-- TOC entry 4091 (class 1259 OID 37369)
-- Name: idx_contact_inquiries_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_inquiries_email ON public.contact_inquiries USING btree (email);


--
-- TOC entry 4092 (class 1259 OID 37367)
-- Name: idx_contact_inquiries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_inquiries_status ON public.contact_inquiries USING btree (status);


--
-- TOC entry 3969 (class 1259 OID 29745)
-- Name: idx_customer_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_archived ON public.customer USING btree (archived);


--
-- TOC entry 3970 (class 1259 OID 28111)
-- Name: idx_customer_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_company ON public.customer USING btree (company_id);


--
-- TOC entry 3971 (class 1259 OID 29746)
-- Name: idx_customer_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_department ON public.customer USING btree (department_id);


--
-- TOC entry 3972 (class 1259 OID 28110)
-- Name: idx_customer_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_email ON public.customer USING btree (email);


--
-- TOC entry 4078 (class 1259 OID 35748)
-- Name: idx_customer_product_option_discount_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_option_discount_composite ON public.customer_product_option_discount USING btree (customer_id, product_id, option_value_id);


--
-- TOC entry 4079 (class 1259 OID 35745)
-- Name: idx_customer_product_option_discount_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_option_discount_customer ON public.customer_product_option_discount USING btree (customer_id);


--
-- TOC entry 4080 (class 1259 OID 35747)
-- Name: idx_customer_product_option_discount_option; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_option_discount_option ON public.customer_product_option_discount USING btree (option_value_id);


--
-- TOC entry 4081 (class 1259 OID 35746)
-- Name: idx_customer_product_option_discount_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_option_discount_product ON public.customer_product_option_discount USING btree (product_id);


--
-- TOC entry 3973 (class 1259 OID 29744)
-- Name: idx_customer_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_type ON public.customer USING btree (customer_type);


--
-- TOC entry 3974 (class 1259 OID 28112)
-- Name: idx_customer_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_user ON public.customer USING btree (user_id);


--
-- TOC entry 3966 (class 1259 OID 28086)
-- Name: idx_department_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_company ON public.department USING btree (company_id);


--
-- TOC entry 3977 (class 1259 OID 29763)
-- Name: idx_locations_location_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_location_name ON public.locations USING btree (location_name);


--
-- TOC entry 3978 (class 1259 OID 29762)
-- Name: idx_locations_remittance_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_locations_remittance_email ON public.locations USING btree (remittance_email);


--
-- TOC entry 4035 (class 1259 OID 28494)
-- Name: idx_notification_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_order ON public.notification USING btree (orderid);


--
-- TOC entry 4036 (class 1259 OID 28493)
-- Name: idx_notification_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_user ON public.notification USING btree (userid);


--
-- TOC entry 4047 (class 1259 OID 29176)
-- Name: idx_order_checklist_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_checklist_order_id ON public.order_checklist USING btree (order_id);


--
-- TOC entry 4013 (class 1259 OID 28319)
-- Name: idx_order_product_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_product_order ON public.order_product USING btree (order_id);


--
-- TOC entry 4014 (class 1259 OID 28320)
-- Name: idx_order_product_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_product_product ON public.order_product USING btree (product_id);


--
-- TOC entry 4005 (class 1259 OID 28296)
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- TOC entry 4006 (class 1259 OID 28298)
-- Name: idx_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_date ON public.orders USING btree (delivery_date_time);


--
-- TOC entry 4007 (class 1259 OID 35752)
-- Name: idx_orders_invoice_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_invoice_url ON public.orders USING btree (invoice_url) WHERE (invoice_url IS NOT NULL);


--
-- TOC entry 4008 (class 1259 OID 35209)
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);


--
-- TOC entry 4009 (class 1259 OID 35208)
-- Name: idx_orders_payment_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_transaction_id ON public.orders USING btree (payment_transaction_id);


--
-- TOC entry 4010 (class 1259 OID 28297)
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);


--
-- TOC entry 4104 (class 1259 OID 37425)
-- Name: idx_password_reset_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_expires ON public.password_reset_tokens USING btree (expires_at);


--
-- TOC entry 4105 (class 1259 OID 37424)
-- Name: idx_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_token ON public.password_reset_tokens USING btree (token);


--
-- TOC entry 4106 (class 1259 OID 37423)
-- Name: idx_password_reset_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- TOC entry 4111 (class 1259 OID 37493)
-- Name: idx_payment_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_log_created_at ON public.payment_audit_log USING btree (created_at DESC);


--
-- TOC entry 4112 (class 1259 OID 37492)
-- Name: idx_payment_audit_log_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_log_event_type ON public.payment_audit_log USING btree (event_type);


--
-- TOC entry 4113 (class 1259 OID 37490)
-- Name: idx_payment_audit_log_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_log_order_id ON public.payment_audit_log USING btree (order_id);


--
-- TOC entry 4114 (class 1259 OID 37489)
-- Name: idx_payment_audit_log_payment_history_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_log_payment_history_id ON public.payment_audit_log USING btree (payment_history_id);


--
-- TOC entry 4115 (class 1259 OID 37494)
-- Name: idx_payment_audit_log_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_log_performed_by ON public.payment_audit_log USING btree (performed_by);


--
-- TOC entry 4116 (class 1259 OID 37491)
-- Name: idx_payment_audit_log_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_audit_log_transaction_id ON public.payment_audit_log USING btree (transaction_id);


--
-- TOC entry 4062 (class 1259 OID 35239)
-- Name: idx_payment_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_created_at ON public.payment_history USING btree (created_at DESC);


--
-- TOC entry 4063 (class 1259 OID 35238)
-- Name: idx_payment_history_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_customer_id ON public.payment_history USING btree (customer_id);


--
-- TOC entry 4064 (class 1259 OID 35240)
-- Name: idx_payment_history_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_idempotency_key ON public.payment_history USING btree (idempotency_key);


--
-- TOC entry 4065 (class 1259 OID 35235)
-- Name: idx_payment_history_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_order_id ON public.payment_history USING btree (order_id);


--
-- TOC entry 4066 (class 1259 OID 35237)
-- Name: idx_payment_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_status ON public.payment_history USING btree (payment_status);


--
-- TOC entry 4067 (class 1259 OID 35236)
-- Name: idx_payment_history_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_history_transaction_id ON public.payment_history USING btree (payment_transaction_id);


--
-- TOC entry 4099 (class 1259 OID 37406)
-- Name: idx_payment_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_created_at ON public.payment_transactions USING btree (created_at);


--
-- TOC entry 4100 (class 1259 OID 37404)
-- Name: idx_payment_transactions_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions USING btree (order_id);


--
-- TOC entry 4101 (class 1259 OID 37405)
-- Name: idx_payment_transactions_transaction_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_transaction_ref ON public.payment_transactions USING btree (transaction_ref);


--
-- TOC entry 3988 (class 1259 OID 37354)
-- Name: idx_product_customer_type_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_customer_type_visibility ON public.product USING btree (customer_type_visibility);


--
-- TOC entry 3989 (class 1259 OID 35751)
-- Name: idx_product_image_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_image_url ON public.product USING btree (product_image_url) WHERE (product_image_url IS NOT NULL);


--
-- TOC entry 4082 (class 1259 OID 37347)
-- Name: idx_product_images_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_images_order ON public.product_images USING btree (product_id, image_order);


--
-- TOC entry 4083 (class 1259 OID 37346)
-- Name: idx_product_images_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_images_product_id ON public.product_images USING btree (product_id);


--
-- TOC entry 4002 (class 1259 OID 35757)
-- Name: idx_product_option_default_discount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_option_default_discount ON public.product_option USING btree (default_discount_percentage);


--
-- TOC entry 3990 (class 1259 OID 28191)
-- Name: idx_product_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_status ON public.product USING btree (product_status);


--
-- TOC entry 3991 (class 1259 OID 28192)
-- Name: idx_product_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_user ON public.product USING btree (user_id);


--
-- TOC entry 4021 (class 1259 OID 28388)
-- Name: idx_quote_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_customer ON public.quote USING btree (customer_id);


--
-- TOC entry 4022 (class 1259 OID 28389)
-- Name: idx_quote_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_status ON public.quote USING btree (order_status);


--
-- TOC entry 4056 (class 1259 OID 35184)
-- Name: idx_settings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_category ON public.settings USING btree (setting_category);


--
-- TOC entry 4057 (class 1259 OID 35183)
-- Name: idx_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_key ON public.settings USING btree (setting_key);


--
-- TOC entry 3952 (class 1259 OID 28049)
-- Name: idx_user_auth_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_auth_level ON public."user" USING btree (auth_level);


--
-- TOC entry 3953 (class 1259 OID 28048)
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- TOC entry 3981 (class 1259 OID 28148)
-- Name: idx_user_postcode_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_postcode_user ON public.user_postcode USING btree (user_id);


--
-- TOC entry 4093 (class 1259 OID 37427)
-- Name: idx_wholesale_enquiries_business_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wholesale_enquiries_business_name ON public.wholesale_enquiries USING btree (business_name);


--
-- TOC entry 4094 (class 1259 OID 37383)
-- Name: idx_wholesale_enquiries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wholesale_enquiries_created_at ON public.wholesale_enquiries USING btree (created_at DESC);


--
-- TOC entry 4095 (class 1259 OID 37384)
-- Name: idx_wholesale_enquiries_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wholesale_enquiries_email ON public.wholesale_enquiries USING btree (email);


--
-- TOC entry 4096 (class 1259 OID 37382)
-- Name: idx_wholesale_enquiries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wholesale_enquiries_status ON public.wholesale_enquiries USING btree (status);


--
-- TOC entry 4170 (class 2620 OID 37387)
-- Name: contact_inquiries update_contact_inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contact_inquiries_updated_at BEFORE UPDATE ON public.contact_inquiries FOR EACH ROW EXECUTE FUNCTION public.update_contact_inquiries_updated_at();


--
-- TOC entry 4166 (class 2620 OID 35715)
-- Name: customer update_customer_date_modified_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customer_date_modified_trigger BEFORE UPDATE ON public.customer FOR EACH ROW EXECUTE FUNCTION public.update_customer_date_modified();


--
-- TOC entry 4169 (class 2620 OID 35754)
-- Name: customer_product_option_discount update_customer_product_option_discount_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customer_product_option_discount_updated_at_trigger BEFORE UPDATE ON public.customer_product_option_discount FOR EACH ROW EXECUTE FUNCTION public.update_customer_product_option_discount_updated_at();


--
-- TOC entry 4168 (class 2620 OID 35242)
-- Name: payment_history update_payment_history_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_history_timestamp BEFORE UPDATE ON public.payment_history FOR EACH ROW EXECUTE FUNCTION public.update_payment_history_updated_at();


--
-- TOC entry 4167 (class 2620 OID 35186)
-- Name: settings update_settings_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_settings_timestamp BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_settings_updated_at();


--
-- TOC entry 4165 (class 2620 OID 28519)
-- Name: user update_user_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4171 (class 2620 OID 37429)
-- Name: wholesale_enquiries update_wholesale_enquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_wholesale_enquiries_updated_at BEFORE UPDATE ON public.wholesale_enquiries FOR EACH ROW EXECUTE FUNCTION public.update_wholesale_enquiries_updated_at();


--
-- TOC entry 4127 (class 2606 OID 28156)
-- Name: category category_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.category(category_id) ON DELETE SET NULL;


--
-- TOC entry 4147 (class 2606 OID 28426)
-- Name: catering_checklist catering_checklist_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catering_checklist
    ADD CONSTRAINT catering_checklist_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4119 (class 2606 OID 28061)
-- Name: company company_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


--
-- TOC entry 4123 (class 2606 OID 28105)
-- Name: customer customer_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id) ON DELETE SET NULL;


--
-- TOC entry 4124 (class 2606 OID 29739)
-- Name: customer customer_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id) ON DELETE SET NULL;


--
-- TOC entry 4149 (class 2606 OID 28452)
-- Name: customer_feedback customer_feedback_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- TOC entry 4148 (class 2606 OID 28447)
-- Name: customer_feedback customer_feedback_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4156 (class 2606 OID 35730)
-- Name: customer_product_option_discount customer_product_option_discount_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_option_discount
    ADD CONSTRAINT customer_product_option_discount_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE CASCADE;


--
-- TOC entry 4157 (class 2606 OID 35740)
-- Name: customer_product_option_discount customer_product_option_discount_option_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_option_discount
    ADD CONSTRAINT customer_product_option_discount_option_value_id_fkey FOREIGN KEY (option_value_id) REFERENCES public.option_value(option_value_id) ON DELETE CASCADE;


--
-- TOC entry 4158 (class 2606 OID 35735)
-- Name: customer_product_option_discount customer_product_option_discount_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_option_discount
    ADD CONSTRAINT customer_product_option_discount_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON DELETE CASCADE;


--
-- TOC entry 4122 (class 2606 OID 28100)
-- Name: customer customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


--
-- TOC entry 4120 (class 2606 OID 28076)
-- Name: department department_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id) ON DELETE CASCADE;


--
-- TOC entry 4121 (class 2606 OID 28081)
-- Name: department department_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


--
-- TOC entry 4159 (class 2606 OID 37341)
-- Name: product_images fk_product_images_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON DELETE CASCADE;


--
-- TOC entry 4132 (class 2606 OID 28218)
-- Name: heading_product heading_product_heading_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heading_product
    ADD CONSTRAINT heading_product_heading_id_fkey FOREIGN KEY (heading_id) REFERENCES public.product_header(heading_id) ON DELETE CASCADE;


--
-- TOC entry 4131 (class 2606 OID 28213)
-- Name: heading_product heading_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heading_product
    ADD CONSTRAINT heading_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON DELETE CASCADE;


--
-- TOC entry 4151 (class 2606 OID 28483)
-- Name: notification notification_orderid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_orderid_fkey FOREIGN KEY (orderid) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4152 (class 2606 OID 28488)
-- Name: notification notification_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_userid_fkey FOREIGN KEY (userid) REFERENCES public."user"(user_id) ON DELETE CASCADE;


--
-- TOC entry 4133 (class 2606 OID 28237)
-- Name: option_value option_value_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.option_value
    ADD CONSTRAINT option_value_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.options(option_id) ON DELETE CASCADE;


--
-- TOC entry 4154 (class 2606 OID 29171)
-- Name: order_checklist order_checklist_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_checklist
    ADD CONSTRAINT order_checklist_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4143 (class 2606 OID 28347)
-- Name: order_images order_images_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_images
    ADD CONSTRAINT order_images_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4141 (class 2606 OID 28330)
-- Name: order_product_option order_product_option_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product_option
    ADD CONSTRAINT order_product_option_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4142 (class 2606 OID 28335)
-- Name: order_product_option order_product_option_order_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product_option
    ADD CONSTRAINT order_product_option_order_product_id_fkey FOREIGN KEY (order_product_id) REFERENCES public.order_product(order_product_id) ON DELETE CASCADE;


--
-- TOC entry 4139 (class 2606 OID 28309)
-- Name: order_product order_product_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product
    ADD CONSTRAINT order_product_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4140 (class 2606 OID 28314)
-- Name: order_product order_product_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_product
    ADD CONSTRAINT order_product_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON DELETE RESTRICT;


--
-- TOC entry 4153 (class 2606 OID 28502)
-- Name: ordercompanyinfo ordercompanyinfo_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordercompanyinfo
    ADD CONSTRAINT ordercompanyinfo_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4136 (class 2606 OID 28281)
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE RESTRICT;


--
-- TOC entry 4138 (class 2606 OID 28291)
-- Name: orders orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- TOC entry 4137 (class 2606 OID 28286)
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


--
-- TOC entry 4161 (class 2606 OID 37418)
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE;


--
-- TOC entry 4162 (class 2606 OID 37479)
-- Name: payment_audit_log payment_audit_log_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_log
    ADD CONSTRAINT payment_audit_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4163 (class 2606 OID 37474)
-- Name: payment_audit_log payment_audit_log_payment_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_log
    ADD CONSTRAINT payment_audit_log_payment_history_id_fkey FOREIGN KEY (payment_history_id) REFERENCES public.payment_history(payment_history_id) ON DELETE CASCADE;


--
-- TOC entry 4164 (class 2606 OID 37484)
-- Name: payment_audit_log payment_audit_log_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_log
    ADD CONSTRAINT payment_audit_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public."user"(user_id) ON DELETE SET NULL;


--
-- TOC entry 4155 (class 2606 OID 35230)
-- Name: payment_history payment_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_history
    ADD CONSTRAINT payment_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4160 (class 2606 OID 37399)
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 4130 (class 2606 OID 28203)
-- Name: product_category product_category_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(category_id) ON DELETE CASCADE;


--
-- TOC entry 4129 (class 2606 OID 28198)
-- Name: product_category product_category_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON DELETE CASCADE;


--
-- TOC entry 4135 (class 2606 OID 28255)
-- Name: product_option product_option_option_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option
    ADD CONSTRAINT product_option_option_value_id_fkey FOREIGN KEY (option_value_id) REFERENCES public.option_value(option_value_id) ON DELETE CASCADE;


--
-- TOC entry 4134 (class 2606 OID 28250)
-- Name: product_option product_option_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option
    ADD CONSTRAINT product_option_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id) ON DELETE CASCADE;


--
-- TOC entry 4128 (class 2606 OID 28186)
-- Name: product product_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 4144 (class 2606 OID 28373)
-- Name: quote quote_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE RESTRICT;


--
-- TOC entry 4146 (class 2606 OID 28383)
-- Name: quote quote_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- TOC entry 4145 (class 2606 OID 28378)
-- Name: quote quote_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


--
-- TOC entry 4125 (class 2606 OID 28123)
-- Name: store store_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store
    ADD CONSTRAINT store_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 4150 (class 2606 OID 28467)
-- Name: survey survey_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey
    ADD CONSTRAINT survey_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- TOC entry 4126 (class 2606 OID 28143)
-- Name: user_postcode user_postcode_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_postcode
    ADD CONSTRAINT user_postcode_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE;


-- Completed on 2025-12-03 17:27:56 IST

--
-- PostgreSQL database dump complete
--

