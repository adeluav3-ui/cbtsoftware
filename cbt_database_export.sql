--
-- PostgreSQL database dump
--

\restrict 3bLqiFMnDQw9Xd6fuMpSKIcPXV0YECyebz9xN2iegVai6PsAjWOddIdo2Fr0bPA

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    title text NOT NULL,
    subject text NOT NULL,
    class text NOT NULL,
    duration_minutes integer NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    school_code text NOT NULL,
    teacher_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    exam_id integer NOT NULL,
    text text NOT NULL,
    option_a text NOT NULL,
    option_b text NOT NULL,
    option_c text NOT NULL,
    option_d text NOT NULL,
    correct_option text NOT NULL,
    school_code text NOT NULL
);


--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: result_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.result_answers (
    id integer NOT NULL,
    result_id integer NOT NULL,
    question_id integer NOT NULL,
    question_text text NOT NULL,
    option_a text NOT NULL,
    option_b text NOT NULL,
    option_c text NOT NULL,
    option_d text NOT NULL,
    correct_option text NOT NULL,
    selected_option text,
    is_correct boolean DEFAULT false NOT NULL,
    school_code text NOT NULL
);


--
-- Name: result_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.result_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: result_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.result_answers_id_seq OWNED BY public.result_answers.id;


--
-- Name: results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.results (
    id integer NOT NULL,
    exam_id integer NOT NULL,
    student_id integer NOT NULL,
    full_name text NOT NULL,
    class text NOT NULL,
    score integer NOT NULL,
    total_questions integer NOT NULL,
    percentage real NOT NULL,
    school_code text NOT NULL,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.results_id_seq OWNED BY public.results.id;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schools (
    id integer NOT NULL,
    code text NOT NULL,
    name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: schools_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schools_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schools_id_seq OWNED BY public.schools.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    role text NOT NULL,
    full_name text NOT NULL,
    school_code text,
    class text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
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
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: result_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_answers ALTER COLUMN id SET DEFAULT nextval('public.result_answers_id_seq'::regclass);


--
-- Name: results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results ALTER COLUMN id SET DEFAULT nextval('public.results_id_seq'::regclass);


--
-- Name: schools id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools ALTER COLUMN id SET DEFAULT nextval('public.schools_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exams (id, title, subject, class, duration_minutes, is_active, school_code, teacher_id, created_at) FROM stdin;
1	Exam	Economics	JSS1	30	t	NEW-1001	3	2026-03-18 06:56:54.633369
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.questions (id, exam_id, text, option_a, option_b, option_c, option_d, correct_option, school_code) FROM stdin;
1	1	Who is your dad	Dangote	Otedola	I no sabi	God	D	NEW-1001
2	1	You sure?	Yes	No	Maybe	Eh	A	NEW-1001
3	1	What is your name	Victor	Emma	I am fire	I am light	C	NEW-1001
4	1	O sure?	What's your issue?	Why?	Getat	No	B	NEW-1001
\.


--
-- Data for Name: result_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.result_answers (id, result_id, question_id, question_text, option_a, option_b, option_c, option_d, correct_option, selected_option, is_correct, school_code) FROM stdin;
\.


--
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.results (id, exam_id, student_id, full_name, class, score, total_questions, percentage, school_code, submitted_at) FROM stdin;
1	1	4	John Doe	JSS1	3	4	75	NEW-1001	2026-03-18 07:01:52.217226
\.


--
-- Data for Name: schools; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schools (id, code, name, created_at) FROM stdin;
1	NEW-1001	Newbridge Academy	2026-03-18 06:40:46.539966
2	BDG-4002	\N	2026-03-18 06:40:46.539966
3	CSE-6782	\N	2026-03-18 06:40:46.539966
4	WER-5673	\N	2026-03-18 06:40:46.539966
5	YUE-0978	\N	2026-03-18 06:40:46.539966
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password, role, full_name, school_code, class, created_at) FROM stdin;
1	Phenomenal	REDACTED	super_admin	Super Administrator	\N	\N	2026-03-18 06:40:50.485298
2	Newbridge	REDACTED	school_admin	School Admin	NEW-1001	\N	2026-03-18 06:40:54.314342
3	Phenomenal	12345	teacher	Adelua Victor	NEW-1001	\N	2026-03-18 06:55:11.913489
4	john.doe	12345	student	John Doe	NEW-1001	JSS1	2026-03-18 06:55:40.951212
\.


--
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.exams_id_seq', 1, true);


--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.questions_id_seq', 4, true);


--
-- Name: result_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.result_answers_id_seq', 1, false);


--
-- Name: results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.results_id_seq', 1, true);


--
-- Name: schools_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schools_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: result_answers result_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_answers
    ADD CONSTRAINT result_answers_pkey PRIMARY KEY (id);


--
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- Name: schools schools_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_code_unique UNIQUE (code);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict 3bLqiFMnDQw9Xd6fuMpSKIcPXV0YECyebz9xN2iegVai6PsAjWOddIdo2Fr0bPA

