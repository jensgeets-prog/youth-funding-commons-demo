var e=`-- Youth Funding Commons: core schema for the pilot (call board, status lifecycle, forecast).
-- No money moves through this app: calls describe money each funder manages itself.
-- Only title, funder, status and language are mandatory; every other field may stay empty.

create type public.call_status as enum (
  'planned', 'opening_soon', 'open', 'under_review', 'decided', 'paused', 'cancelled'
);
create type public.member_role as enum (
  'federation_admin', 'funder_director', 'funder_manager', 'funder_officer'
);
create type public.lang as enum ('nl', 'fr', 'en');
create type public.beneficiary as enum ('youth', 'organisations', 'both');
create type public.term_kind as enum (
  'theme', 'vulnerability', 'setting', 'resource', 'region', 'applicant', 'metric'
);
create type public.term_status as enum ('active', 'proposed', 'retired');
create type public.field_type as enum (
  'text', 'long_text', 'number', 'amount', 'date', 'boolean', 'select', 'multiselect', 'url'
);

create table public.funders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 200),
  kind text not null default 'foundation',
  website text,
  intake_url text,
  is_member boolean not null default true,
  created_at timestamptz not null default now()
);

-- A federation admin has no funder; every other role belongs to exactly one funder.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  funder_id uuid references public.funders (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  check ((role = 'federation_admin') = (funder_id is null)),
  unique nulls not distinct (user_id, funder_id)
);

-- One controlled vocabulary for every facet, so all funders tag with the same words.
-- Themes nest one level (theme > subtopic); regions use NIS codes with parent links.
-- SDGs are derived from themes, never entered by funders. Funders may propose a term
-- (usable on their own calls at once); the federation approves, merges or rejects it.
create table public.terms (
  id text primary key check (id ~ '^[a-z0-9_:]+$'),
  kind public.term_kind not null,
  label_nl text not null check (length(label_nl) between 2 and 120),
  label_fr text not null check (length(label_fr) between 2 and 120),
  parent_id text references public.terms (id),
  sdgs smallint[] not null default '{}',
  synonyms text[] not null default '{}',
  sort smallint not null default 0,
  status public.term_status not null default 'active',
  proposed_by uuid references auth.users (id) on delete set null,
  merged_into text references public.terms (id),
  created_at timestamptz not null default now()
);
create index terms_kind_idx on public.terms (kind, status);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.funders (id) on delete cascade,
  title text not null check (length(title) between 3 and 200),
  summary text not null default '' check (length(summary) <= 4000),
  problem text not null default '' check (length(problem) <= 2000),
  target_description text not null default '' check (length(target_description) <= 1000),
  image_url text check (image_url ~ '^https://'),
  language public.lang not null default 'nl',
  status public.call_status not null default 'planned',
  beneficiary public.beneficiary,
  opens_at timestamptz,
  deadline_at timestamptz,
  decision_at date,
  project_start date,
  project_end date,
  -- For planned calls this is the expected range, not a commitment. Euros.
  amount_min bigint check (amount_min >= 0),
  amount_max bigint check (amount_max >= 0),
  grants_count integer check (grants_count > 0),
  tranches smallint check (tranches > 0),
  cofunding_allowed boolean,
  age_min smallint check (age_min between 0 and 99),
  age_max smallint check (age_max between 0 and 99),
  eligibility jsonb not null default '[]' check (jsonb_typeof(eligibility) = 'array'),
  criteria jsonb not null default '[]' check (jsonb_typeof(criteria) = 'array'),
  custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object'),
  apply_url text check (apply_url ~ '^https?://'),
  contact_name text,
  contact_email text check (contact_email ~ '^[^@\\s]+@[^@\\s]+$'),
  contact_language public.lang,
  planned_public boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (amount_max is null or amount_min is null or amount_max >= amount_min),
  check (age_max is null or age_min is null or age_max >= age_min),
  check (deadline_at is null or opens_at is null or deadline_at >= opens_at)
);
create index calls_funder_idx on public.calls (funder_id);

create table public.call_terms (
  call_id uuid not null references public.calls (id) on delete cascade,
  term_id text not null references public.terms (id) on update cascade,
  primary key (call_id, term_id)
);
create index call_terms_term_idx on public.call_terms (term_id);

-- Every status change, who made it and why. Written by trigger only.
create table public.call_status_history (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.calls (id) on delete cascade,
  from_status public.call_status,
  to_status public.call_status not null,
  reason text,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index call_status_history_call_idx on public.call_status_history (call_id, changed_at);

-- Fields the federation adds for every funder without a schema change. Values live in
-- calls.custom keyed by \`key\`. A field in use is archived (active = false), never dropped.
create table public.custom_fields (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label_nl text not null,
  label_fr text not null,
  help_nl text not null default '',
  help_fr text not null default '',
  type public.field_type not null,
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  filterable boolean not null default false,
  show_on_card boolean not null default false,
  sort smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (not filterable or type in ('select', 'multiselect', 'boolean')),
  check (type not in ('select', 'multiselect') or jsonb_array_length(options) > 0)
);
`;export{e as default};