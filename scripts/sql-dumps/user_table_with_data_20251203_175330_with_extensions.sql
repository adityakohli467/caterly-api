--
-- Enable required extensions for user table
-- These must be created BEFORE the table creation
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

-- Started on 2025-12-03 17:53:30 IST

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
-- TOC entry 3889 (class 0 OID 0)
-- Dependencies: 212
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."user" IS 'System users including admins, staff, and customers';


--
-- TOC entry 3890 (class 0 OID 0)
-- Dependencies: 212
-- Name: COLUMN "user".auth_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."user".auth_level IS '1=super_admin, 2=admin, 3=staff, 4=customer';


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
-- TOC entry 3891 (class 0 OID 0)
-- Dependencies: 211
-- Name: user_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_user_id_seq OWNED BY public."user".user_id;


--
-- TOC entry 3726 (class 2604 OID 28033)
-- Name: user user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN user_id SET DEFAULT nextval('public.user_user_id_seq'::regclass);


--
-- TOC entry 3883 (class 0 OID 28030)
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
-- TOC entry 3892 (class 0 OID 0)
-- Dependencies: 211
-- Name: user_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_user_id_seq', 11, true);


--
-- TOC entry 3736 (class 2606 OID 28045)
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- TOC entry 3738 (class 2606 OID 28047)
-- Name: user user_login_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_login_username_key UNIQUE (login_username);


--
-- TOC entry 3740 (class 2606 OID 28043)
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3733 (class 1259 OID 28049)
-- Name: idx_user_auth_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_auth_level ON public."user" USING btree (auth_level);


--
-- TOC entry 3734 (class 1259 OID 28048)
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- TOC entry 3741 (class 2620 OID 28519)
-- Name: user update_user_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Completed on 2025-12-03 17:53:30 IST

--
-- PostgreSQL database dump complete
--

