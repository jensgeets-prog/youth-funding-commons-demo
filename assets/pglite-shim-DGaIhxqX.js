var e=`-- The minimum of Supabase that the migrations rely on, for running them in PGlite
-- (in-browser demo mode and the db tests). Never applied to a real Supabase project.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (id uuid primary key, email text unique);

-- Same contract as Supabase: the caller's id comes from the request's JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;export{e as default};