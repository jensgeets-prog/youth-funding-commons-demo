var e=`-- B1: drafts. On its own because Postgres cannot use a new enum value in the same
-- transaction that adds it.
alter type public.call_status add value 'draft' before 'planned';
`;export{e as default};