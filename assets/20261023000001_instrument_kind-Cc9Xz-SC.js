var e=`-- A new vocabulary kind for how money flows (financing instrument), next to what is
-- supported (resource). Its own migration: a new enum value cannot be used in the
-- transaction that adds it.
alter type public.term_kind add value if not exists 'instrument';
`;export{e as default};