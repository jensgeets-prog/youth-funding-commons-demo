var e=`-- 1. Financing instruments: how a call pays out, from a classic grant to payment by
--    results and repayable finance. Sources: OECD results-based financing, the
--    Government Outcomes Lab (social impact bonds, outcomes funds), Impact Europe
--    (venture philanthropy, financial instruments), GIIN / Tideline (recoverable grants,
--    programme-related investment, impact-linked finance), Trust-Based Philanthropy
--    Project and participatory grantmaking practice.
-- 2. A call can be used as a template by any member, also another member's call.
-- 3. A shared organisation profile base (contract v1) that ImpactMatch organisations
--    can adopt as is.

-- ---------- 1. financing instruments ----------
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort, description_nl, description_fr) values
  ('inst:g_gift', 'instrument', 'Schenking', 'Don', null, '{gift,subsidie,grant,don}', 1,
   'Geld dat niet terugbetaald wordt.', 'Argent qui n''est pas remboursé.'),
  ('inst:g_outcome', 'instrument', 'Betaling bij resultaat', 'Paiement aux résultats', null,
   '{resultaatgericht,outcome based,results based,paiement au résultat}', 2,
   'De uitbetaling hangt af van behaalde, gemeten resultaten.',
   'Le paiement dépend de résultats atteints et mesurés.'),
  ('inst:g_repayable', 'instrument', 'Terugbetaalbaar en investering', 'Remboursable et investissement', null,
   '{impactinvestering,impact investment,investissement d''impact}', 3,
   'Financiering die (deels) terugkomt of rendement kan geven.',
   'Financement qui revient (en partie) ou peut rapporter.'),

  ('inst:grant', 'instrument', 'Klassieke gift', 'Don classique', 'inst:g_gift',
   '{projectsubsidie,toelage,subside}', 1,
   'Bedrag vooraf toegekend, verantwoording achteraf.', 'Montant accordé d''avance, justifié après.'),
  ('inst:staged', 'instrument', 'Gefaseerd per mijlpaal', 'Par étapes', 'inst:g_gift',
   '{mijlpaal,tranches,milestone,jalons}', 2,
   'Uitbetaling in schijven telkens een afgesproken mijlpaal gehaald is.',
   'Versements par tranches à chaque étape convenue.'),
  ('inst:trust_based', 'instrument', 'Vertrouwensgebaseerd', 'Fondé sur la confiance', 'inst:g_gift',
   '{trust based,ongebonden,unrestricted,non affecté}', 3,
   'Ongebonden, meerjarig, met lichte rapportering.', 'Non affecté, pluriannuel, rapportage légère.'),
  ('inst:participatory', 'instrument', 'Participatieve toekenning', 'Octroi participatif', 'inst:g_gift',
   '{participatief,jongerenjury,participatory grantmaking,jury de jeunes}', 4,
   'Jongeren of de gemeenschap beslissen mee wie steun krijgt.',
   'Les jeunes ou la communauté décident qui est soutenu.'),
  ('inst:prize', 'instrument', 'Prijs of challenge', 'Prix ou défi', 'inst:g_gift',
   '{prijs,award,prix,laureaat,challenge,wedstrijd,concours}', 5,
   'Een beloning voor de beste oplossing of prestatie.', 'Une récompense pour la meilleure solution.'),
  ('inst:matchfunding', 'instrument', 'Matchfunding en cofinanciering', 'Abondement et cofinancement', 'inst:g_gift',
   '{matching,cofinanciering,verdubbeling,crowdfunding,cofinancement,abondement}', 6,
   'Het fonds legt bij wat anderen geven, bv. bij crowdfunding.',
   'Le fonds complète ce que d''autres donnent, p. ex. un crowdfunding.'),
  ('inst:pooled', 'instrument', 'Samenwerkingsfonds', 'Fonds commun', 'inst:g_gift',
   '{pooled fund,gepoold,collectief fonds,fonds mutualisé}', 7,
   'Meerdere fondsen leggen samen in één pot met één beslissing.',
   'Plusieurs fonds mettent en commun avec une seule décision.'),
  ('inst:venture_philanthropy', 'instrument', 'Venture philanthropy', 'Venture philanthropy', 'inst:g_gift',
   '{durfcapitaal,begeleiding,accompagnement}', 8,
   'Meerjarige financiering samen met intensieve begeleiding.',
   'Financement pluriannuel avec accompagnement intensif.'),

  ('inst:outcome_payment', 'instrument', 'Resultaatfinanciering', 'Financement aux résultats', 'inst:g_outcome',
   '{payment by results,results based financing,outcome based funding}', 1,
   'Het fonds betaalt per behaald resultaat, bv. per jongere die een diploma haalt.',
   'Le fonds paie par résultat atteint, p. ex. par jeune diplômé.'),
  ('inst:sib', 'instrument', 'Social impact bond', 'Contrat à impact social', 'inst:g_outcome',
   '{sib,impact bond,cis}', 2,
   'Investeerders financieren vooraf; een overheid of fonds betaalt terug bij resultaat.',
   'Des investisseurs préfinancent ; un pouvoir public ou un fonds rembourse selon les résultats.'),
  ('inst:outcomes_fund', 'instrument', 'Resultatenfonds', 'Fonds de résultats', 'inst:g_outcome',
   '{outcomes fund,fonds de résultats}', 3,
   'Een gedeelde pot die meerdere resultaatcontracten betaalt.',
   'Un fonds commun qui paie plusieurs contrats à résultats.'),
  ('inst:impact_incentive', 'instrument', 'Impactpremie', 'Prime à l''impact', 'inst:g_outcome',
   '{siinc,impact linked,impact-linked finance}', 4,
   'Een bonus bovenop financiering wanneer de impact hoger uitvalt.',
   'Un bonus en plus du financement quand l''impact est plus élevé.'),

  ('inst:recoverable', 'instrument', 'Terugvorderbare gift', 'Don récupérable', 'inst:g_repayable',
   '{recoverable grant,terugbetaalbaar bij succes}', 1,
   'Een gift die terugbetaald wordt als het project lukt.', 'Un don remboursé si le projet réussit.'),
  ('inst:loan', 'instrument', 'Lening aan zachte voorwaarden', 'Prêt à conditions douces', 'inst:g_repayable',
   '{lening,prêt,pri,renteloos,programme related investment}', 2,
   'Lage of geen rente, soepele terugbetaling.', 'Taux faible ou nul, remboursement souple.'),
  ('inst:convertible', 'instrument', 'Converteerbare financiering', 'Financement convertible', 'inst:g_repayable',
   '{converteerbaar,convertible}', 3,
   'Begint als gift of lening en kan omgezet worden.', 'Commence comme don ou prêt, peut être converti.'),
  ('inst:quasi_equity', 'instrument', 'Achtergestelde lening', 'Prêt subordonné', 'inst:g_repayable',
   '{quasi equity,achtergesteld,subordonné}', 4,
   'Terugbetaling na andere schuldeisers, vaak gekoppeld aan inkomsten.',
   'Remboursé après les autres créanciers, souvent lié aux revenus.'),
  ('inst:revenue_based', 'instrument', 'Inkomstengebonden financiering', 'Financement basé sur les revenus', 'inst:g_repayable',
   '{revenue based,royalty}', 5,
   'Terugbetaling als percentage van de toekomstige inkomsten.',
   'Remboursement en pourcentage des revenus futurs.'),
  ('inst:guarantee', 'instrument', 'Garantie', 'Garantie', 'inst:g_repayable',
   '{waarborg,borg}', 6,
   'Het fonds staat borg zodat een bank leent.', 'Le fonds se porte garant pour qu''une banque prête.'),
  ('inst:equity', 'instrument', 'Kapitaalparticipatie', 'Prise de participation', 'inst:g_repayable',
   '{equity,aandelen,mission related investment,participation}', 7,
   'Het fonds wordt mede-eigenaar van een sociale onderneming.',
   'Le fonds devient copropriétaire d''une entreprise sociale.'),
  ('inst:blended', 'instrument', 'Gemengde financiering', 'Financement mixte', 'inst:g_repayable',
   '{blended finance,first loss,eerste verlies}', 8,
   'Filantropisch geld neemt het eerste risico zodat investeerders volgen.',
   'L''argent philanthropique prend le premier risque pour attirer des investisseurs.');

-- The old support types that were really instruments move over; calls keep them.
insert into public.call_terms (call_id, term_id)
select call_id, case term_id when 'res:loan' then 'inst:loan'
                             when 'res:matching' then 'inst:matchfunding'
                             else 'inst:prize' end
from public.call_terms where term_id in ('res:loan', 'res:matching', 'res:prize')
on conflict do nothing;
delete from public.call_terms where term_id in ('res:loan', 'res:matching', 'res:prize');
update public.terms set status = 'retired', merged_into = 'inst:loan' where id = 'res:loan';
update public.terms set status = 'retired', merged_into = 'inst:matchfunding' where id = 'res:matching';
update public.terms set status = 'retired', merged_into = 'inst:prize' where id = 'res:prize';
update public.terms set status = 'retired' where id = 'res:g_repayable';

-- ---------- 2. any call as a template ----------
alter table public.calls add column template_of uuid references public.calls (id) on delete set null;
grant select (template_of) on public.calls to authenticated;

-- Copies a call the caller can see into a draft of the caller's fund (or p_funder).
-- Years in the title and the dates move forward to the next cycle, so a yearly call
-- needs minimal edits. Another member's contact details, apply link and image are
-- left out: they belong to that member.
drop function public.duplicate_call(uuid);
create function public.duplicate_call(p_id uuid, p_funder uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.calls;
  v_funder uuid;
  v_same boolean;
  v_shift int := 0;
  v_title text;
  v_year text;
  v_new uuid;
begin
  select * into s from public.calls where id = p_id;
  if not found or not public.can_see_call(p_id) then
    raise exception 'Call not found' using errcode = '42501';
  end if;
  v_funder := coalesce(p_funder,
    case when public.can_edit_call(s.funder_id) then s.funder_id end,
    (select m.funder_id from public.memberships m
     where m.user_id = auth.uid() and m.role in ('funder_director', 'funder_manager')
     order by m.created_at limit 1));
  if v_funder is null or not public.can_edit_call(v_funder) then
    raise exception 'Call not found or you may not change it' using errcode = '42501';
  end if;
  v_same := v_funder = s.funder_id;

  -- Whole years forward until the deadline (or opening) lies ahead.
  if coalesce(s.deadline_at, s.opens_at) is not null then
    while coalesce(s.deadline_at, s.opens_at) + make_interval(years => v_shift) < now() loop
      v_shift := v_shift + 1;
    end loop;
  end if;
  v_title := regexp_replace(left(s.title, 190), ' \\(kopie\\)$', '');
  for v_year in select distinct m[1] from regexp_matches(v_title, '\\m(20[0-9]{2})\\M', 'g') m loop
    v_title := regexp_replace(v_title, '\\m' || v_year || '\\M',
      greatest(v_year::int + 1, extract(year from now())::int)::text, 'g');
  end loop;
  if v_title = regexp_replace(left(s.title, 190), ' \\(kopie\\)$', '') then
    v_title := v_title || ' (kopie)';
  end if;

  insert into public.calls (funder_id, title, summary, problem, target_description, image_url,
    language, status, beneficiary, deadline_type, opens_at, deadline_at, decision_at,
    amount_min, amount_max, total_budget, grants_count, tranches, cofunding_allowed, age_min,
    age_max, eligibility, criteria, custom, apply_url, contact_name, contact_email,
    contact_language, template_of)
  values (v_funder, v_title, s.summary, s.problem, s.target_description,
    case when v_same then s.image_url end, s.language, 'draft', s.beneficiary, s.deadline_type,
    s.opens_at + make_interval(years => v_shift), s.deadline_at + make_interval(years => v_shift),
    s.decision_at + make_interval(years => v_shift),
    s.amount_min, s.amount_max, s.total_budget, s.grants_count, s.tranches, s.cofunding_allowed,
    s.age_min, s.age_max, s.eligibility, s.criteria, s.custom,
    case when v_same then s.apply_url end, case when v_same then s.contact_name end,
    case when v_same then s.contact_email end, s.contact_language, s.id)
  returning id into v_new;
  insert into public.call_terms (call_id, term_id)
  select v_new, term_id from public.call_terms where call_id = p_id;
  insert into public.call_metrics (call_id, term_id, target, unit)
  select v_new, term_id, target, unit from public.call_metrics where call_id = p_id;
  return v_new;
end;
$$;
revoke execute on function public.duplicate_call(uuid, uuid) from public, anon;
grant execute on function public.duplicate_call(uuid, uuid) to authenticated;

create or replace function public.call_detail(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'funder_id', c.funder_id, 'title', c.title, 'summary', c.summary,
    'problem', c.problem, 'target_description', c.target_description, 'image_url', c.image_url,
    'language', c.language, 'status', c.status, 'beneficiary', c.beneficiary,
    'opens_at', c.opens_at, 'deadline_at', c.deadline_at, 'deadline_type', c.deadline_type,
    'decision_at', c.decision_at, 'project_start', c.project_start, 'project_end', c.project_end,
    'amount_min', c.amount_min, 'amount_max', c.amount_max, 'total_budget', c.total_budget,
    'grants_count', c.grants_count, 'tranches', c.tranches,
    'cofunding_allowed', c.cofunding_allowed, 'age_min', c.age_min, 'age_max', c.age_max,
    'eligibility', c.eligibility, 'criteria', c.criteria, 'custom', c.custom,
    'apply_url', c.apply_url, 'contact_language', c.contact_language,
    'planned_public', c.planned_public, 'is_sample', c.is_sample, 'updated_at', c.updated_at,
    'contact', public.call_contact(c.id),
    'funder', (select jsonb_build_object('id', f.id, 'name', f.name, 'website', f.website,
                 'intake_url', f.intake_url) from public.funders f where f.id = c.funder_id),
    'terms', coalesce((select jsonb_agg(t.term_id order by t.term_id)
                       from public.call_terms t where t.call_id = c.id), '[]'::jsonb),
    'history', public.call_history(c.id),
    'can_edit', public.can_edit_call(c.funder_id),
    'can_set_status', public.can_set_status(c.funder_id),
    'template_of', (select jsonb_build_object('id', s.id, 'title', s.title, 'funder', f.name)
                    from public.calls s join public.funders f on f.id = s.funder_id
                    where s.id = c.template_of and public.can_see_call(s.id))
  ) || public.call_learning(c.id)
  from public.calls c
  where c.id = p_id;
$$;

-- ---------- 3. shared organisation profile base ----------
alter table public.funders
  add column mission text not null default '' check (length(mission) <= 300),
  add column founded_year int check (founded_year between 1800 and 2100),
  add column staff_band text check (staff_band in ('1-9', '10-49', '50-249', '250+')),
  add column giving_band text check (giving_band in ('<100k', '100k-1m', '1m-10m', '10m+')),
  add column languages text[] not null default '{nl}'
    check (languages <@ array['nl', 'fr', 'en', 'de']),
  add column core_values text[] not null default '{}' check (cardinality(core_values) <= 5);

-- What a member declares it funds, in the shared vocabulary (themes, target groups,
-- regions, instruments, support types), next to what its calls show.
create table public.funder_focus (
  funder_id uuid not null references public.funders (id) on delete cascade,
  term_id text not null references public.terms (id),
  primary key (funder_id, term_id)
);
alter table public.funder_focus enable row level security;
create policy funder_focus_read on public.funder_focus for select using (public.is_member());
create policy funder_focus_write on public.funder_focus for all
  using (public.can_edit_call(funder_id)) with check (public.can_edit_call(funder_id));
grant select, insert, delete on public.funder_focus to authenticated;

create or replace function public.member_profile(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(f) || jsonb_build_object(
    'contacts', coalesce((select jsonb_agg(to_jsonb(k) - 'funder_id' order by k.is_primary desc, k.name)
                          from public.funder_contacts k where k.funder_id = f.id), '[]'::jsonb),
    'focus', coalesce((select jsonb_agg(x.term_id order by x.term_id)
                       from public.funder_focus x where x.funder_id = f.id), '[]'::jsonb),
    'can_edit', public.can_edit_call(f.id))
  from public.funders f where f.id = p_id;
$$;

create or replace function public.save_member(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  r public.funders := jsonb_populate_record(null::public.funders, p);
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.funders (name, kind, website, intake_url, is_member, legal_name,
      enterprise_number, description, street, postal_code, city, country, general_email, phone,
      logo_url, member_since, mission, founded_year, staff_band, giving_band, languages, core_values)
    values (r.name, coalesce(r.kind, 'foundation'), r.website, r.intake_url, coalesce(r.is_member, true),
      r.legal_name, r.enterprise_number, coalesce(r.description, ''), r.street, r.postal_code, r.city,
      coalesce(r.country, 'BE'), r.general_email, r.phone, r.logo_url, coalesce(r.member_since, current_date),
      coalesce(r.mission, ''), r.founded_year, r.staff_band, r.giving_band,
      coalesce(r.languages, '{nl}'), coalesce(r.core_values, '{}'))
    returning id into v_id;
  else
    update public.funders set name = r.name, kind = coalesce(r.kind, 'foundation'),
      website = r.website, intake_url = r.intake_url, legal_name = r.legal_name,
      enterprise_number = r.enterprise_number, description = coalesce(r.description, ''),
      street = r.street, postal_code = r.postal_code, city = r.city,
      country = coalesce(r.country, 'BE'), general_email = r.general_email, phone = r.phone,
      logo_url = r.logo_url, member_since = r.member_since, mission = coalesce(r.mission, ''),
      founded_year = r.founded_year, staff_band = r.staff_band, giving_band = r.giving_band,
      languages = coalesce(r.languages, '{nl}'), core_values = coalesce(r.core_values, '{}')
    where id = v_id;
    if not found then
      raise exception 'Member not found or you may not change it' using errcode = '42501';
    end if;
  end if;
  -- Focus is replaced as a whole when sent; only active vocabulary terms are kept.
  if jsonb_typeof(p -> 'focus') = 'array' then
    delete from public.funder_focus where funder_id = v_id;
    insert into public.funder_focus (funder_id, term_id)
    select v_id, t.id from public.terms t
    where t.status = 'active' and t.kind <> 'metric'
      and t.id in (select jsonb_array_elements_text(p -> 'focus'));
  end if;
  return v_id;
end;
$$;

-- Contract v1: the organisation profile both apps share (docs/initiative-model.md §4).
-- Field names are neutral, ids are vocabulary ids, identifiers use org-id.guide
-- schemes. No personal data. ImpactMatch organisations can return the same shape with
-- roles ['implementer'] and their own focus.
create function public.organisation_profile(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'schema', 'org-profile/1',
    'id', f.id,
    'name', f.name,
    'legal_name', f.legal_name,
    'type', f.kind,
    'roles', jsonb_build_array('funder'),
    'identifiers', case when f.enterprise_number is not null then jsonb_build_array(
        jsonb_build_object('scheme', 'BE-BCE_KBO',
                           'value', regexp_replace(f.enterprise_number, '[^0-9]', '', 'g')))
      else '[]'::jsonb end,
    'website', f.website, 'logo_url', f.logo_url,
    'country', f.country, 'city', f.city,
    'description', f.description, 'mission', f.mission,
    'founded_year', f.founded_year, 'staff_band', f.staff_band, 'giving_band', f.giving_band,
    'languages', to_jsonb(f.languages), 'core_values', to_jsonb(f.core_values),
    'focus', jsonb_build_object(
      'themes', coalesce((select jsonb_agg(t.id order by t.id) from public.funder_focus x
                 join public.terms t on t.id = x.term_id
                 where x.funder_id = f.id and t.kind = 'theme'), '[]'::jsonb),
      'target_groups', coalesce((select jsonb_agg(t.id order by t.id) from public.funder_focus x
                 join public.terms t on t.id = x.term_id
                 where x.funder_id = f.id and t.kind = 'vulnerability'), '[]'::jsonb),
      'regions', coalesce((select jsonb_agg(t.id order by t.id) from public.funder_focus x
                 join public.terms t on t.id = x.term_id
                 where x.funder_id = f.id and t.kind = 'region'), '[]'::jsonb),
      'instruments', coalesce((select jsonb_agg(t.id order by t.id) from public.funder_focus x
                 join public.terms t on t.id = x.term_id
                 where x.funder_id = f.id and t.kind = 'instrument'), '[]'::jsonb),
      'support', coalesce((select jsonb_agg(t.id order by t.id) from public.funder_focus x
                 join public.terms t on t.id = x.term_id
                 where x.funder_id = f.id and t.kind = 'resource'), '[]'::jsonb)),
    'sdg_focus', coalesce((select jsonb_agg(distinct s order by s) from public.funder_focus x
                 join public.terms t on t.id = x.term_id, unnest(t.sdgs) s
                 where x.funder_id = f.id), '[]'::jsonb),
    'created_at', f.created_at)
  from public.funders f
  where f.id = p_id and public.is_member();
$$;
revoke execute on function public.organisation_profile(uuid) from public, anon;
grant execute on function public.organisation_profile(uuid) to authenticated;

comment on function public.organisation_profile(uuid) is
  'Contract org-profile/1: the organisation profile shared with ImpactMatch. Vocabulary ids from taxonomy(); identifiers use org-id.guide schemes.';
`;export{e as default};