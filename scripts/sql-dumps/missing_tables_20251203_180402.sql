--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

-- Started on 2025-12-03 18:04:02 IST

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
-- TOC entry 3903 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.orders IS 'Customer orders';


--
-- TOC entry 3904 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.order_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.order_status IS '0=cancelled, 1=new, 2=paid, 4=awaiting_approval, 7=approved, 8=rejected, 9=modified';


--
-- TOC entry 3905 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.account_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.account_email IS 'Account email for delivery notifications';


--
-- TOC entry 3906 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.cost_center; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.cost_center IS 'Cost center code for order tracking';


--
-- TOC entry 3907 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.delivery_contact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_contact IS 'Contact person for delivery';


--
-- TOC entry 3908 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN orders.delivery_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_details IS 'Additional delivery details and instructions';


--
-- TOC entry 3909 (class 0 OID 0)
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
-- TOC entry 3910 (class 0 OID 0)
-- Dependencies: 239
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- TOC entry 3726 (class 2604 OID 28264)
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- TOC entry 3897 (class 0 OID 28261)
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
-- TOC entry 3911 (class 0 OID 0)
-- Dependencies: 239
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 29, true);


--
-- TOC entry 3752 (class 2606 OID 28280)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3745 (class 1259 OID 28296)
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- TOC entry 3746 (class 1259 OID 28298)
-- Name: idx_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_date ON public.orders USING btree (delivery_date_time);


--
-- TOC entry 3747 (class 1259 OID 35752)
-- Name: idx_orders_invoice_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_invoice_url ON public.orders USING btree (invoice_url) WHERE (invoice_url IS NOT NULL);


--
-- TOC entry 3748 (class 1259 OID 35209)
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);


--
-- TOC entry 3749 (class 1259 OID 35208)
-- Name: idx_orders_payment_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_transaction_id ON public.orders USING btree (payment_transaction_id);


--
-- TOC entry 3750 (class 1259 OID 28297)
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);


--
-- TOC entry 3753 (class 2606 OID 28281)
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id) ON DELETE RESTRICT;


--
-- TOC entry 3755 (class 2606 OID 28291)
-- Name: orders orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- TOC entry 3754 (class 2606 OID 28286)
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE SET NULL;


-- Completed on 2025-12-03 18:04:02 IST

--
-- PostgreSQL database dump complete
--

