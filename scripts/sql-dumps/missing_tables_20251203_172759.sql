--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

-- Started on 2025-12-03 17:27:59 IST

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


-- Completed on 2025-12-03 17:27:59 IST

--
-- PostgreSQL database dump complete
--

