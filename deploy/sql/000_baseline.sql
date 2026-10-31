--
-- PostgreSQL database dump
--

\restrict tZVBzKCcVTEPXwXgVETLYv0d6JX6mdK2idbPpvpwwvN1NzmnSQ6NrSdj0CS65ai

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg12+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: competition_officials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competition_officials (
    id bigint NOT NULL,
    competition_id bigint,
    official_id bigint,
    role text,
    hours real,
    notes text,
    kilometers real DEFAULT 0,
    discipline text DEFAULT ''::text,
    znesek_sodnik numeric(10,2) DEFAULT 0,
    znesek_racun numeric(10,2) DEFAULT 0
);


--
-- Name: competition_officials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competition_officials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competition_officials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competition_officials_id_seq OWNED BY public.competition_officials.id;


--
-- Name: competitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitions (
    id bigint NOT NULL,
    name text NOT NULL,
    date text,
    location text,
    type text,
    status text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: competitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competitions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competitions_id_seq OWNED BY public.competitions.id;


--
-- Name: officials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.officials (
    id bigint NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    rank text,
    active integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    notes text DEFAULT ''::text,
    additional_exams text DEFAULT ''::text
);


--
-- Name: COLUMN officials.additional_exams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.officials.additional_exams IS 'Dodatni izpiti sodnika (npr: Atletika, Gimnastika)';


--
-- Name: officials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.officials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: officials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.officials_id_seq OWNED BY public.officials.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    official_id bigint,
    competition_id bigint,
    amount real,
    date text,
    method text,
    status text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    date_paid text,
    remarks text DEFAULT ''::text,
    znesek_sodnik numeric(10,2) DEFAULT 0,
    znesek_racun numeric(10,2) DEFAULT 0
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value jsonb
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: competition_officials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_officials ALTER COLUMN id SET DEFAULT nextval('public.competition_officials_id_seq'::regclass);


--
-- Name: competitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions ALTER COLUMN id SET DEFAULT nextval('public.competitions_id_seq'::regclass);


--
-- Name: officials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.officials ALTER COLUMN id SET DEFAULT nextval('public.officials_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: competition_officials competition_officials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_officials
    ADD CONSTRAINT competition_officials_pkey PRIMARY KEY (id);


--
-- Name: competitions competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_pkey PRIMARY KEY (id);


--
-- Name: officials officials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.officials
    ADD CONSTRAINT officials_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_competition_officials_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_officials_comp ON public.competition_officials USING btree (competition_id);


--
-- Name: idx_competition_officials_official; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_officials_official ON public.competition_officials USING btree (official_id);


--
-- Name: idx_payments_competition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_competition ON public.payments USING btree (competition_id);


--
-- Name: idx_payments_official; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_official ON public.payments USING btree (official_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: competition_officials competition_officials_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_officials
    ADD CONSTRAINT competition_officials_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;


--
-- Name: competition_officials competition_officials_official_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_officials
    ADD CONSTRAINT competition_officials_official_id_fkey FOREIGN KEY (official_id) REFERENCES public.officials(id) ON DELETE CASCADE;


--
-- Name: payments payments_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE SET NULL;


--
-- Name: payments payments_official_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_official_id_fkey FOREIGN KEY (official_id) REFERENCES public.officials(id) ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO zas_sodniki_api;


--
-- Name: TABLE competition_officials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.competition_officials TO zas_sodniki_api;


--
-- Name: SEQUENCE competition_officials_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.competition_officials_id_seq TO zas_sodniki_api;


--
-- Name: TABLE competitions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.competitions TO zas_sodniki_api;


--
-- Name: SEQUENCE competitions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.competitions_id_seq TO zas_sodniki_api;


--
-- Name: TABLE officials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.officials TO zas_sodniki_api;


--
-- Name: SEQUENCE officials_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.officials_id_seq TO zas_sodniki_api;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payments TO zas_sodniki_api;


--
-- Name: SEQUENCE payments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.payments_id_seq TO zas_sodniki_api;


--
-- Name: TABLE settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.settings TO zas_sodniki_api;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO zas_sodniki_api;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.users_id_seq TO zas_sodniki_api;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE zas_sodniki_admin IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO zas_sodniki_api;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE zas_sodniki_admin IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO zas_sodniki_api;


--
-- PostgreSQL database dump complete
--

\unrestrict tZVBzKCcVTEPXwXgVETLYv0d6JX6mdK2idbPpvpwwvN1NzmnSQ6NrSdj0CS65ai

