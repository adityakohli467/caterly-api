--
-- Enable required extensions
--
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

-- Started on 2025-12-03 18:05:59 IST

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

SET default_tablespace = '';

SET default_table_access_method = heap;

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
-- TOC entry 3893 (class 0 OID 0)
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
-- TOC entry 3894 (class 0 OID 0)
-- Dependencies: 247
-- Name: quote_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quote_order_id_seq OWNED BY public.quote.order_id;


--
-- TOC entry 3727 (class 2604 OID 28356)
-- Name: quote order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote ALTER COLUMN order_id SET DEFAULT nextval('public.quote_order_id_seq'::regclass);


--
-- TOC entry 3887 (class 0 OID 28353)
-- Dependencies: 248
-- Data for Name: quote; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- TOC entry 3895 (class 0 OID 0)
-- Dependencies: 247
-- Name: quote_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quote_order_id_seq', 1, false);


--
-- TOC entry 3742 (class 2606 OID 28372)
-- Name: quote quote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3739 (class 1259 OID 28388)
-- Name: idx_quote_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_customer ON public.quote USING btree (customer_id);


--
-- TOC entry 3740 (class 1259 OID 28389)
-- Name: idx_quote_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_status ON public.quote USING btree (order_status);


--
-- TOC entry 3743 (class 2606 OID 28373)
-- Name: quote quote_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE RESTRICT;


--
-- TOC entry 3745 (class 2606 OID 28383)
-- Name: quote quote_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- TOC entry 3744 (class 2606 OID 28378)
-- Name: quote quote_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote
    ADD CONSTRAINT quote_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


-- Completed on 2025-12-03 18:05:59 IST

--
-- PostgreSQL database dump complete
--

