var e=`-- Demo data: local development and the in-browser demo only. Never run in production.
-- Devenir grands carries the facts from the market analysis (amount, audience, region);
-- every call marked is_sample is invented to show the range of real calls.
-- Dates are relative to now() so the demo never goes stale.

do $$
begin
  if exists (select 1 from auth.users where email not like '%.test') then
    raise exception 'seed.sql is demo data: refusing to run on a database with real accounts';
  end if;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@federation.test'),
  ('00000000-0000-4000-8000-000000000002', 'manager@kbs-frb.test'),
  ('00000000-0000-4000-8000-000000000003', 'officer@kbs-frb.test'),
  ('00000000-0000-4000-8000-000000000004', 'director@streekfonds.test'),
  ('00000000-0000-4000-8000-000000000005', 'visitor@example.test');

insert into public.funders (name, kind, website, intake_url) values
  ('Koning Boudewijnstichting', 'public_benefit_foundation', 'https://kbs-frb.be', 'https://kbs-frb.be/nl/oproepen'),
  ('Streekfonds West-Vlaanderen', 'regional_fund', null, null),
  ('Koningin Paola Stichting', 'foundation', null, null),
  ('Colruyt Group Foundation', 'corporate_foundation', null, null),
  ('Euroclear Foundation', 'corporate_foundation', null, null),
  ('Stichting Jeugdkansen (voorbeeld)', 'foundation', null, null),
  ('Fondation Horizon Jeunes (exemple)', 'foundation', null, null),
  ('Limburgs Jongerenfonds (voorbeeld)', 'regional_fund', null, null),
  ('Brussels Youth Fund (sample)', 'foundation', null, null);

insert into public.memberships (user_id, funder_id, role)
select '00000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'federation_admin'::public.member_role
union all
select '00000000-0000-4000-8000-000000000002', id, 'funder_manager' from public.funders where name = 'Koning Boudewijnstichting'
union all
select '00000000-0000-4000-8000-000000000003', id, 'funder_officer' from public.funders where name = 'Koning Boudewijnstichting'
union all
select '00000000-0000-4000-8000-000000000004', id, 'funder_director' from public.funders where name = 'Streekfonds West-Vlaanderen';

insert into public.custom_fields (key, label_nl, label_fr, help_nl, help_fr, type, options, filterable, show_on_card, sort) values
  ('selection_method', 'Selectiewijze', 'Mode de sélection', 'Hoe worden aanvragen gekozen?', 'Comment les demandes sont-elles choisies ?',
   'select', '["Jury", "Doorlopend / En continu", "Wie eerst komt / Premier arrivé"]', true, true, 1),
  ('kbo_required', 'Ondernemingsnummer vereist', 'Numéro d''entreprise requis', '', '', 'boolean', '[]', true, false, 2);

-- Status reason for the seeded paused/cancelled calls (the trigger requires one).
select set_config('app.status_reason', 'Voorbeelddata', false);

create temp table seed_calls (
  funder text, title text, lang public.lang, status public.call_status, beneficiary public.beneficiary,
  opens_in int, deadline_in int, amount_min bigint, amount_max bigint, grants int, tranches smallint,
  age_min smallint, age_max smallint, planned_public boolean, sample boolean,
  problem text, summary text, terms text[], custom jsonb
);

insert into seed_calls values
  ('Koning Boudewijnstichting', 'Devenir grands', 'fr', 'open', 'organisations', -9, 89, null, 15000, null, null, 6, 18, false, false,
   'Les garçons en situation de vulnérabilité décrochent plus souvent et manquent de modèles positifs.',
   'Soutien aux projets qui accompagnent des garçons en situation de vulnérabilité en Wallonie et à Bruxelles vers une vie d''adulte épanouie. Jusqu''à 15 000 € par projet.',
   '{theme:gender,theme:dropout,vuln:poverty,setting:leisure,nis:03000,nis:04000,res:project_grant,applicant:npo,metric:youth_reached}',
   '{"selection_method": "Jury", "kbo_required": true}'),
  ('Koning Boudewijnstichting', 'Fonds Een Hart voor Limburg — meerjarige steun', 'nl', 'opening_soon', 'organisations', 20, 80, 5000, 50000, 12, 3, 0, 18, false, true,
   'Te veel Limburgse kinderen groeien op in armoede en missen kansen op school en in de vrije tijd.',
   'Meerjarige steun (max. 3 jaar) aan organisaties die werken met kinderen en jongeren van 0 tot 18 in Limburg. Eén goedkeuring per cyclus.',
   '{theme:child_poverty,theme:homework,vuln:poverty,setting:school,setting:leisure,nis:70000,res:multi_year,applicant:npo,applicant:school,metric:youth_reached}',
   '{"selection_method": "Jury"}'),
  ('Koning Boudewijnstichting', 'Let''s Breathe #2 — Fonds Koningin Mathilde', 'nl', 'open', 'organisations', -40, 10, 5000, 25000, 20, null, 12, 25, false, true,
   'Het mentaal welzijn van jongeren staat onder druk; jongeren worden te weinig betrokken bij oplossingen.',
   'Projecten door jongeren voor jongeren rond mentaal welzijn. Steun omvat een subsidie, een begeleidingstraject en een netwerkevent.',
   '{theme:mh_prevention,theme:youth_voice,vuln:mental_health,setting:school,setting:community,nis:be,res:project_grant,res:coaching,res:network,applicant:npo,applicant:informal,metric:wellbeing_change,metric:youth_led}',
   '{"selection_method": "Jury"}'),
  ('Koning Boudewijnstichting', 'Ethias Solidarity — jongeren in armoede', 'nl', 'open', 'organisations', -20, 45, 2500, 20000, null, null, 16, 30, false, true,
   'Jongvolwassenen in armoede vallen tussen de mazen van het net bij de overgang naar zelfstandigheid.',
   'Projecten voor jongeren onder 30 in armoede. Wie eerder steun kreeg, moet daarover gerapporteerd hebben.',
   '{theme:poverty,theme:housing,vuln:poverty,vuln:homeless,setting:community,nis:be,res:project_grant,applicant:npo,applicant:ocmw,metric:youth_reached}',
   '{"selection_method": "Jury", "kbo_required": true}'),
  ('Koning Boudewijnstichting', 'BNP Paribas Fortis Foundation Fund — schoolsucces', 'nl', 'planned', 'organisations', 120, 180, 50000, 50000, 2, 2, 6, 18, true, true,
   'Leerlingen uit kwetsbare gezinnen halen minder vaak een diploma.',
   'Twee keer 25 000 euro; de tweede schijf volgt na evaluatie. Voor projecten die schoolsucces van kwetsbare leerlingen versterken.',
   '{theme:dropout,theme:homework,vuln:dropout_risk,setting:school,nis:be,res:multi_year,applicant:npo,applicant:school,metric:school_completion}',
   '{}'),
  ('Koning Boudewijnstichting', 'Digital for Youth', 'fr', 'opening_soon', 'organisations', 12, 70, 3000, 15000, 30, null, 6, 25, false, true,
   'Trop de jeunes n''ont pas d''ordinateur ou de compétences numériques pour l''école et l''emploi.',
   'Matériel et formation numérique pour les jeunes de 6 à 25 ans. Les frais de démarrage sont acceptés.',
   '{theme:devices,theme:digital_skills,vuln:poverty,setting:school,setting:leisure,nis:be,res:investment,res:experimental,applicant:npo,applicant:school,metric:skills_gained}',
   '{"selection_method": "Doorlopend / En continu"}'),
  ('Koning Boudewijnstichting', 'Fonds Strandschelp — individuele beurzen', 'nl', 'open', 'youth', -30, 30, 500, 2500, null, null, 16, 25, false, true,
   'Jongeren uit kwetsbare gezinnen laten opleidingen of talentontwikkeling liggen omdat ze die niet kunnen betalen.',
   'Individuele beurzen vanaf 500 euro voor jongeren van 16 tot 25 in West-Vlaanderen.',
   '{theme:talent_work,vuln:poverty,setting:work,nis:30000,res:individual,applicant:individual,metric:skills_gained}',
   '{"selection_method": "Doorlopend / En continu"}'),
  ('Koning Boudewijnstichting', 'Kinderarmoede — structurele partnerschappen 2027–2031', 'nl', 'planned', 'organisations', 200, 260, 1000000, 3000000, 3, 5, 0, 12, false, true,
   'Kinderarmoede blijft hardnekkig hoog in de grootsteden ondanks versnipperde projecten.',
   'Vijfjarige partnerschappen met consortia die kinderarmoede structureel aanpakken in een stad of regio.',
   '{theme:child_poverty,theme:parenting,vuln:poverty,vuln:single_parent,setting:family,setting:community,nis:be,res:multi_year,res:operating,applicant:npo,applicant:local_gov,metric:youth_reached}',
   '{}'),
  ('Koning Boudewijnstichting', 'Pleegzorg en jeugdhulp — oproep 2026', 'nl', 'decided', 'organisations', -200, -120, 5000, 30000, 15, null, 0, 21, false, true,
   'Jongeren in de jeugdhulp verliezen hun netwerk bij het verlaten van de zorg.',
   'Steun voor initiatieven die jongeren in jeugdhulp en pleegzorg begeleiden naar zelfstandigheid.',
   '{theme:youth_care,vuln:youth_care,setting:care,nis:02000,res:project_grant,applicant:npo,metric:youth_reached}',
   '{"selection_method": "Jury"}'),
  ('Koning Boudewijnstichting', 'Jeunes pour le climat', 'fr', 'under_review', 'organisations', -90, -15, 2000, 10000, 25, null, 12, 25, false, true,
   'Les jeunes veulent agir pour le climat mais manquent de moyens pour lancer des projets locaux.',
   'Petits projets climat portés par des jeunes en Wallonie et à Bruxelles.',
   '{theme:climate_action,theme:youth_voice,setting:community,nis:03000,nis:04000,res:project_grant,applicant:informal,applicant:npo,metric:youth_led}',
   '{"selection_method": "Jury"}'),

  ('Streekfonds West-Vlaanderen', 'Een Hart voor West-Vlaanderen', 'nl', 'open', 'organisations', -15, 60, 1000, 5000, 40, null, 0, 18, false, true,
   'Lokale initiatieven voor kwetsbare kinderen hebben weinig toegang tot kleine, snelle steun.',
   'Kleine projectsteun van 1 000 tot 5 000 euro voor initiatieven met kinderen en jongeren van 0 tot 18 in West-Vlaanderen.',
   '{theme:poverty,theme:sport_participation,vuln:poverty,setting:leisure,nis:30000,res:project_grant,applicant:npo,applicant:informal,metric:youth_reached}',
   '{"selection_method": "Jury"}'),
  ('Streekfonds West-Vlaanderen', 'Kust en jongeren — vrijetijdsfonds 2027', 'nl', 'planned', 'organisations', 150, 210, 1000, 7500, null, null, 6, 18, false, true,
   'Kinderen aan de kust uit kwetsbare gezinnen nemen weinig deel aan jeugdwerk.',
   'Verwachte oproep voor vrijetijdsparticipatie aan de kust.',
   '{theme:sport_participation,theme:arts_participation,vuln:poverty,setting:leisure,nis:30000,res:project_grant,applicant:npo}',
   '{}'),

  ('Koningin Paola Stichting', 'Prijs Koningin Paola voor het Onderwijs', 'nl', 'open', 'organisations', -60, 25, 10000, 10000, 6, null, 3, 25, false, true,
   'Inspirerende onderwijsprojecten blijven vaak lokaal en onzichtbaar.',
   'Prijzen voor scholen en leerkrachten met projecten die leerlingen kansen geven. Met de steun van Belfius.',
   '{theme:education,theme:transitions,setting:school,nis:be,res:project_grant,applicant:school,metric:youth_reached}',
   '{"selection_method": "Jury"}'),

  ('Colruyt Group Foundation', 'Youth Incubator', 'nl', 'opening_soon', 'youth', 30, 75, null, null, 34, null, 16, 25, false, true,
   'Jongeren zonder netwerk vinden moeilijk de weg naar ondernemen of werk.',
   'Vijfjarig coachingtraject (met Enabel) voor zo''n 90 jongeren in ongeveer 34 projecten. Geen geldsteun maar begeleiding.',
   '{theme:entrepreneurship,theme:orientation,vuln:neet,setting:work,nis:be,res:coaching,res:network,applicant:individual,metric:jobs_internships}',
   '{"selection_method": "Jury"}'),

  ('Euroclear Foundation', 'Financiële geletterdheid — meerjarige partnerschappen', 'nl', 'planned', 'organisations', 240, 300, 100000, 500000, 3, 3, 12, 25, false, true,
   'Jongeren maken financiële keuzes zonder basiskennis over budget en schulden.',
   'Meerjarige partnerschappen met organisaties die financiële geletterdheid bij jongeren versterken.',
   '{theme:financial_literacy,setting:school,nis:be,res:multi_year,applicant:npo,metric:skills_gained}',
   '{}'),

  ('Stichting Jeugdkansen (voorbeeld)', 'Huiswerkklassen in Antwerpen', 'nl', 'open', 'organisations', -50, 5, 2000, 12000, 15, null, 10, 16, false, true,
   'Leerlingen zonder rustige studieplek thuis lopen achterstand op.',
   'Steun voor huiswerkklassen en studieplekken in Antwerpse wijken.',
   '{theme:homework,vuln:poverty,vuln:migration,setting:school,setting:community,nis:10000,res:project_grant,applicant:npo,applicant:school,metric:support_hours}',
   '{"selection_method": "Wie eerst komt / Premier arrivé"}'),
  ('Stichting Jeugdkansen (voorbeeld)', 'Veerkracht op school', 'nl', 'planned', 'organisations', 90, 150, 10000, 60000, 8, 2, 12, 18, false, true,
   'Leerkrachten zien meer psychische klachten bij leerlingen maar missen tools.',
   'Programma''s die veerkracht van leerlingen in het secundair versterken.',
   '{theme:mh_prevention,vuln:mental_health,setting:school,nis:02000,res:multi_year,applicant:school,metric:wellbeing_change}',
   '{}'),
  ('Stichting Jeugdkansen (voorbeeld)', 'Lezen met vrijwilligers', 'nl', 'paused', 'organisations', -10, 50, 1000, 5000, 20, null, 6, 12, false, true,
   'Kinderen die thuis geen Nederlands spreken lezen minder.',
   'Voorleesprojecten met vrijwilligers. Tijdelijk gepauzeerd in afwachting van budget.',
   '{theme:literacy,vuln:migration,setting:leisure,nis:40000,res:project_grant,applicant:npo,metric:volunteers}',
   '{}'),

  ('Fondation Horizon Jeunes (exemple)', 'Sport pour tous à Bruxelles', 'fr', 'open', 'organisations', -25, 35, 2000, 15000, 12, null, 8, 18, false, true,
   'Les jeunes des quartiers populaires bruxellois pratiquent moins de sport encadré.',
   'Soutien aux clubs et associations qui rendent le sport accessible aux jeunes bruxellois.',
   '{theme:sport_participation,vuln:poverty,setting:leisure,setting:community,nis:04000,res:project_grant,applicant:npo,metric:youth_reached}',
   '{"selection_method": "Jury"}'),
  ('Fondation Horizon Jeunes (exemple)', 'Ateliers théâtre en Hainaut', 'fr', 'cancelled', 'organisations', -30, 20, 1500, 8000, null, null, 12, 18, false, true,
   'Peu d''offres culturelles pour les adolescents en zone rurale.',
   'Appel annulé : le budget a été réaffecté.',
   '{theme:arts_participation,setting:leisure,nis:50000,res:project_grant,applicant:npo}',
   '{}'),
  ('Fondation Horizon Jeunes (exemple)', 'Accueil des MENA', 'fr', 'opening_soon', 'organisations', 8, 60, 5000, 40000, 6, null, 14, 18, false, true,
   'Les mineurs étrangers non accompagnés manquent d''accompagnement vers l''autonomie.',
   'Projets d''accompagnement, de logement et de scolarisation pour les MENA.',
   '{theme:newcomers,vuln:newcomer,setting:care,nis:03000,nis:04000,res:project_grant,res:coaching,applicant:npo,metric:youth_reached}',
   '{}'),

  ('Limburgs Jongerenfonds (voorbeeld)', 'Eerste job in Limburg', 'nl', 'open', 'youth', -35, 40, 500, 3000, 50, null, 18, 26, false, true,
   'Jongeren zonder diploma vinden in Limburg moeilijk een eerste job.',
   'Beurzen voor rijbewijs, werkkledij of opleiding die een eerste job mogelijk maken.',
   '{theme:internships,vuln:neet,setting:work,nis:70000,res:individual,applicant:individual,metric:jobs_internships}',
   '{"selection_method": "Doorlopend / En continu"}'),
  ('Limburgs Jongerenfonds (voorbeeld)', 'Jeugdwerk in de mijnstreek', 'nl', 'open', 'organisations', -80, 30, 2000, 10000, null, null, 6, 18, false, true,
   'Jeugdwerkingen in de mijnstreek bereiken niet alle kinderen.',
   'Steun voor toegankelijk jeugdwerk. Deze oproep werd al lang niet bijgewerkt.',
   '{theme:sport_participation,vuln:migration,setting:leisure,nis:70000,res:operating,applicant:npo}',
   '{}'),

  ('Brussels Youth Fund (sample)', 'Digital Brussels — laptops and skills', 'en', 'open', 'organisations', -14, 18, 5000, 30000, 10, null, 12, 25, false, true,
   'Many Brussels teenagers share one device per family and lack digital skills for school.',
   'Devices and digital skills programmes for Brussels teenagers.',
   '{theme:devices,theme:digital_skills,theme:online_safety,vuln:poverty,setting:school,nis:04000,res:investment,applicant:npo,applicant:school,metric:skills_gained}',
   '{}'),
  ('Brussels Youth Fund (sample)', 'Culture in the city', 'en', 'under_review', 'organisations', -100, -20, 3000, 20000, 10, null, 12, 25, false, true,
   'Young Bruxellois rarely visit cultural venues outside their neighbourhood.',
   'Projects that bring young people into cultural venues across Brussels.',
   '{theme:arts_participation,theme:heritage,setting:community,nis:04000,res:project_grant,applicant:npo}',
   '{"selection_method": "Jury"}'),
  ('Brussels Youth Fund (sample)', 'Green Brussels youth coalition', 'en', 'planned', 'organisations', 100, 160, 500000, 2000000, 1, 4, 14, 30, true, true,
   'Climate action by young people in Brussels is fragmented across many small groups.',
   'A four-year grant for one coalition that connects youth climate initiatives across Brussels.',
   '{theme:climate_action,theme:env_education,setting:community,nis:04000,res:multi_year,applicant:npo,metric:youth_led}',
   '{}'),

  -- Beyond Belgium, and place-agnostic but topic-specific.
  ('Koning Boudewijnstichting', 'Jongeren aan het werk in Kinshasa', 'nl', 'open', 'organisations', -20, 70, 10000, 60000, 5, 2, 16, 30, false, true,
   'Jonge Congolezen vinden zonder netwerk of opleiding moeilijk werk.',
   'Steun aan Congolese en Belgische partners die jongeren in Kinshasa opleiden en naar werk begeleiden.',
   '{theme:internships,theme:entrepreneurship,vuln:neet,setting:work,geo:cd,res:multi_year,res:coaching,applicant:npo,metric:jobs_internships}',
   '{"selection_method": "Jury"}'),
  ('Euroclear Foundation', 'Europese jongerenuitwisseling rond financiële geletterdheid', 'nl', 'opening_soon', 'organisations', 15, 90, 20000, 80000, 4, null, 15, 25, false, true,
   'Jongeren in Europa leren weinig over geld, en grensoverschrijdende uitwisseling ontbreekt.',
   'Uitwisselingsprojecten tussen jongerenorganisaties in België, Nederland, Frankrijk en Luxemburg.',
   '{theme:financial_literacy,theme:volunteering,setting:leisure,geo:europe,res:project_grant,applicant:npo,metric:skills_gained}',
   '{}'),
  ('Brussels Youth Fund (sample)', 'Youth mental health: what works — open to any location', 'en', 'open', 'organisations', -10, 120, 25000, 150000, 3, null, 12, 25, false, true,
   'Evidence on what helps young people''s mental health is scattered and rarely shared between countries.',
   'Funding for practice-based research and pilots on youth mental health, wherever the project runs.',
   '{theme:mh_prevention,vuln:mental_health,setting:school,geo:world,res:project_grant,applicant:npo,applicant:foundation,metric:wellbeing_change}',
   '{}'),

  -- Earlier rounds, decided, with results to learn from.
  ('Stichting Jeugdkansen (voorbeeld)', 'Huiswerkklassen in Antwerpen — ronde 2025', 'nl', 'decided', 'organisations', -400, -330, 2000, 12000, 12, null, 10, 16, false, true,
   'Leerlingen zonder rustige studieplek thuis lopen achterstand op.',
   'Vorige ronde van de huiswerkklassen.',
   '{theme:homework,vuln:poverty,vuln:migration,setting:school,nis:10000,res:project_grant,applicant:npo,metric:support_hours,metric:youth_reached}',
   '{"selection_method": "Wie eerst komt / Premier arrivé"}'),
  ('Fondation Horizon Jeunes (exemple)', 'Sport pour tous à Bruxelles — édition 2025', 'fr', 'decided', 'organisations', -390, -320, 2000, 15000, 10, null, 8, 18, false, true,
   'Les jeunes des quartiers populaires bruxellois pratiquent moins de sport encadré.',
   'Édition précédente.',
   '{theme:sport_participation,vuln:poverty,setting:leisure,nis:04000,res:project_grant,applicant:npo,metric:youth_reached}',
   '{"selection_method": "Jury"}'),
  ('Brussels Youth Fund (sample)', 'Laptops for school — 2025', 'en', 'decided', 'organisations', -380, -300, 5000, 25000, 8, null, 12, 18, false, true,
   'Many Brussels teenagers share one device per family.',
   'Previous round of device support.',
   '{theme:devices,vuln:poverty,setting:school,nis:04000,res:investment,applicant:school,metric:youth_reached,metric:skills_gained}',
   '{}');

insert into public.calls (
  funder_id, title, summary, problem, language, status, beneficiary, opens_at, deadline_at,
  decision_at, amount_min, amount_max, grants_count, tranches, age_min, age_max,
  planned_public, is_sample, custom, apply_url, contact_name, contact_email, contact_language
)
select f.id, s.title, s.summary, s.problem, s.lang,
  -- New calls start planned/announced/open; later states are reached by updates below.
  case when s.status in ('planned', 'opening_soon', 'open') then s.status else 'open' end,
  s.beneficiary,
  date_trunc('day', now()) + make_interval(days => s.opens_in) + interval '9 hours',
  date_trunc('day', now()) + make_interval(days => s.deadline_in) + interval '13 hours',
  (date_trunc('day', now()) + make_interval(days => s.deadline_in + 60))::date,
  s.amount_min, s.amount_max, s.grants, s.tranches, s.age_min, s.age_max,
  s.planned_public, s.sample, s.custom,
  coalesce(f.intake_url, 'https://example.org/apply'),
  'Contactpersoon ' || left(f.name, 20), 'calls@' || lower(regexp_replace(left(f.name, 12), '[^a-zA-Z]', '', 'g')) || '.test',
  s.lang
from seed_calls s join public.funders f on f.name = s.funder;

insert into public.call_terms (call_id, term_id)
select c.id, unnest(s.terms) from seed_calls s join public.calls c on c.title = s.title;

-- Walk the later states through the lifecycle, so their history is realistic.
update public.calls c set status = 'under_review' from seed_calls s
where s.title = c.title and s.status in ('under_review', 'decided');
update public.calls c set status = 'decided' from seed_calls s
where s.title = c.title and s.status = 'decided';
update public.calls c set status = s.status from seed_calls s
where s.title = c.title and s.status in ('paused', 'cancelled');

-- Member profiles and representatives. Fictional people; .test addresses only.
update public.funders set legal_name = 'Koning Boudewijnstichting, stichting van openbaar nut',
  description = 'Steunt projecten en burgers die zich inzetten voor een betere samenleving, met tientallen fondsen voor kinderen en jongeren.',
  street = 'Brederodestraat 21', postal_code = '1000', city = 'Brussel', member_since = '2005-01-01'
where name = 'Koning Boudewijnstichting';
update public.funders set description = 'Regionaal fonds voor projecten in West-Vlaanderen.', city = 'Brugge', member_since = '2012-03-01'
where name = 'Streekfonds West-Vlaanderen';
update public.funders set description = 'Fondation fictive pour la démo : sport, culture et accueil des jeunes à Bruxelles et en Wallonie.', city = 'Namur', member_since = '2019-09-01'
where name = 'Fondation Horizon Jeunes (exemple)';
update public.funders set description = 'Sample foundation for the demo: digital inclusion and climate in Brussels.', city = 'Brussel', member_since = '2021-01-15'
where name = 'Brussels Youth Fund (sample)';

insert into public.funder_contacts (funder_id, name, job_title, email, is_primary)
select f.id, v.name, v.title, v.email, v.prim from (values
  ('Koning Boudewijnstichting', 'An Peeters', 'Programmaverantwoordelijke jeugd', 'an.peeters@kbs-frb.test', true),
  ('Koning Boudewijnstichting', 'Marc Dubois', 'Coördinator oproepen', 'marc.dubois@kbs-frb.test', false),
  ('Streekfonds West-Vlaanderen', 'Lien Vandamme', 'Directeur', 'lien@streekfonds.test', true),
  ('Fondation Horizon Jeunes (exemple)', 'Samira El Amrani', 'Directrice', 'samira@horizon.test', true),
  ('Brussels Youth Fund (sample)', 'Tom Janssens', 'Programme lead', 'tom@byf.test', true)
) v(funder, name, title, email, prim)
join public.funders f on f.name = v.funder;

-- Someone who signed in but has no role yet, asking for access (admin dashboard).
insert into public.access_requests (user_id, organisation, job_title, message)
values ('00000000-0000-4000-8000-000000000005', 'Stichting Jeugdkansen', 'Programmamedewerker',
        'Ik volg de oproepen rond schooluitval op voor onze stichting.');

-- Collaboration (B5): a thread, a reply, and a co-funding interest, with notifications.
with c as (select id from public.calls where title = 'Fonds Een Hart voor Limburg — meerjarige steun'),
top as (
  insert into public.call_comments (call_id, author_id, body, created_at)
  select id, '00000000-0000-4000-8000-000000000004',
    'Wij steunen in West-Vlaanderen gelijkaardige huiswerkprojecten. Zouden jullie meerjarige trajecten openstellen voor cofinanciering?',
    now() - interval '2 days'
  from c returning id, call_id
)
insert into public.call_comments (call_id, parent_id, author_id, body, created_at)
select call_id, id, '00000000-0000-4000-8000-000000000002',
  'Ja, graag. We bekijken een gedeeld traject voor de tweede schijf. Laten we volgende week afspreken.',
  now() - interval '1 day'
from top;

insert into public.cofund_interests (call_id, funder_id, user_id, amount_min, amount_max, note, visibility)
select c.id, f.id, '00000000-0000-4000-8000-000000000004', 10000, 25000,
  'Interesse voor projecten die ook in de Westhoek actief zijn.', 'members'
from public.calls c, public.funders f
where c.title = 'Fonds Een Hart voor Limburg — meerjarige steun' and f.name = 'Streekfonds West-Vlaanderen';

insert into public.notifications (user_id, kind, call_id, actor_id, created_at)
select '00000000-0000-4000-8000-000000000002', k, c.id, '00000000-0000-4000-8000-000000000004', now() - interval '2 days'
from public.calls c, unnest(array['comment', 'interest']) k
where c.title = 'Fonds Een Hart voor Limburg — meerjarige steun';

-- A draft only KBF and the federation can see (B1).
insert into public.calls (funder_id, title, problem, language, status, is_sample)
select id, 'Zomerscholen 2027 (concept)', 'Kinderen uit kwetsbare gezinnen verliezen leerwinst tijdens de zomer.', 'nl', 'draft', true
from public.funders where name = 'Koning Boudewijnstichting';
insert into public.call_terms (call_id, term_id)
select c.id, t from public.calls c, unnest(array['theme:homework', 'res:experimental']) t
where c.title = 'Zomerscholen 2027 (concept)';

-- A rolling call: no deadline, always open.
update public.calls set deadline_type = 'rolling', deadline_at = null
where title = 'Fonds Strandschelp — individuele beurzen';

-- Metric targets for every call that picked a metric; actuals and lessons on decided ones.
insert into public.call_metrics (call_id, term_id, target, unit)
select t.call_id, t.term_id,
  case t.term_id when 'metric:youth_reached' then 200 when 'metric:support_hours' then 1500
                 when 'metric:jobs_internships' then 40 else 50 end,
  case t.term_id when 'metric:support_hours' then 'uur' when 'metric:wellbeing_change' then '% verbeterd'
                 else 'jongeren' end
from public.call_terms t join public.terms x on x.id = t.term_id where x.kind = 'metric';

update public.call_metrics m set actual = v.actual
from (values
  ('Huiswerkklassen in Antwerpen — ronde 2025', 'metric:support_hours', 1720),
  ('Huiswerkklassen in Antwerpen — ronde 2025', 'metric:youth_reached', 168),
  ('Sport pour tous à Bruxelles — édition 2025', 'metric:youth_reached', 410),
  ('Laptops for school — 2025', 'metric:youth_reached', 240),
  ('Laptops for school — 2025', 'metric:skills_gained', 31),
  ('Pleegzorg en jeugdhulp — oproep 2026', 'metric:youth_reached', 95)
) v(title, term_id, actual)
join public.calls c on c.title = v.title
where m.call_id = c.id and m.term_id = v.term_id;

insert into public.call_results (call_id, applications_received, grants_awarded, amount_awarded,
  youth_reached, what_worked, what_to_improve, advice)
select c.id, v.apps, v.grants, v.amount, v.reach, v.worked, v.improve, v.advice
from (values
  ('Huiswerkklassen in Antwerpen — ronde 2025', 46, 12, 118000, 168,
   'Samenwerking met scholen voor de doorverwijzing; vrijwilligers uit de buurt.',
   'Wie eerst komt was niet eerlijk: kleine vzw''s misten de eerste dag.',
   'Gebruik een jury of loting in plaats van wie eerst komt.'),
  ('Sport pour tous à Bruxelles — édition 2025', 31, 10, 121000, 410,
   'Les clubs qui ont réduit la cotisation ont doublé leurs inscriptions.',
   'Peu de demandes de clubs féminins.',
   'Prévoir un volet dédié aux filles et le communiquer via les écoles.'),
  ('Laptops for school — 2025', 22, 8, 160000, 240,
   'Pairing devices with a short digital-skills course.',
   'Devices without a support plan broke or were left unused.',
   'Fund maintenance and training together with the hardware.'),
  ('Pleegzorg en jeugdhulp — oproep 2026', 28, 15, 290000, 95,
   'Mentoren uit de eigen leefwereld van de jongeren.',
   'Projecten van één jaar zijn te kort voor jongeren die de jeugdhulp verlaten.',
   'Overweeg meerjarige steun met een tussentijdse evaluatie.')
) v(title, apps, grants, amount, reach, worked, improve, advice)
join public.calls c on c.title = v.title;

-- One call that has not been touched for 45 days, to show the "check status" nudge.
alter table public.calls disable trigger calls_before_write;
update public.calls set updated_at = now() - interval '45 days' where title = 'Jeugdwerk in de mijnstreek';
alter table public.calls enable trigger calls_before_write;

-- A pending proposal from the KBF manager, to show the federation review queue.
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, status, proposed_by)
values ('theme:x_young_carers', 'theme', 'Jonge mantelzorgers', 'Jeunes aidants proches', 'theme:safety',
        '{mantelzorg}', 'proposed', '00000000-0000-4000-8000-000000000002');
insert into public.call_terms (call_id, term_id)
select id, 'theme:x_young_carers' from public.calls where title = 'Ethias Solidarity — jongeren in armoede';

-- The reason above was only needed for the paused/cancelled inserts.
update public.call_status_history set reason = null where to_status not in ('paused', 'cancelled');
select set_config('app.status_reason', '', false);
drop table seed_calls;

-- Financing forms on some calls, so the facet and the match criterion have data.
alter table public.calls disable trigger calls_before_write;
insert into public.call_terms (call_id, term_id)
select c.id, v.term from (values
  ('Prijs Koningin Paola voor het Onderwijs', 'inst:prize'),
  ('Huiswerkklassen in Antwerpen', 'inst:grant'),
  ('Een Hart voor West-Vlaanderen', 'inst:grant'),
  ('Fonds Strandschelp — individuele beurzen', 'inst:grant'),
  ('Eerste job in Limburg', 'inst:outcome_payment'),
  ('Youth Incubator', 'inst:venture_philanthropy'),
  ('Financiële geletterdheid — meerjarige partnerschappen', 'inst:trust_based'),
  ('Kinderarmoede — structurele partnerschappen 2027–2031', 'inst:grant'),
  ('Eerste job in Limburg', 'inst:micro_grant'),
  ('Digital for Youth', 'inst:matchfunding'),
  ('Jeunes pour le climat', 'inst:participatory')
) v(title, term)
join public.calls c on c.title = v.title
on conflict do nothing;
alter table public.calls enable trigger calls_before_write;

-- SDG targets on a few calls, so the picker, the call page and matching have data.
insert into public.call_sdg_targets (call_id, target)
select c.id, v.target from (values
  ('Huiswerkklassen in Antwerpen', '4.1'),
  ('Huiswerkklassen in Antwerpen', '4.5'),
  ('Huiswerkklassen in Antwerpen — ronde 2025', '4.1'),
  ('Eerste job in Limburg', '8.5'),
  ('Eerste job in Limburg', '8.6'),
  ('Prijs Koningin Paola voor het Onderwijs', '4.c'),
  ('Digital for Youth', '4.4')
) v(title, target)
join public.calls c on c.title = v.title
on conflict do nothing;

-- Shared organisation profile fields for two members (contract org-profile/1).
update public.funders set
  mission = 'Bijdragen aan een betere samenleving, met aandacht voor kansen van kinderen en jongeren.',
  founded_year = 1976, staff_band = '250+', giving_band = '10m+', languages = '{nl,fr,en}',
  core_values = '{onafhankelijk,pluralistisch,nabij}', city = coalesce(city, 'Brussel')
where name = 'Koning Boudewijnstichting';
update public.funders set
  mission = 'Kansen voor jongeren in West-Vlaanderen, dicht bij huis.',
  founded_year = 2001, staff_band = '1-9', giving_band = '100k-1m', languages = '{nl}',
  core_values = '{nabijheid,vertrouwen}'
where name = 'Streekfonds West-Vlaanderen';
insert into public.funder_focus (funder_id, term_id)
select f.id, v.term from (values
  ('Koning Boudewijnstichting', 'theme:poverty'),
  ('Koning Boudewijnstichting', 'theme:education'),
  ('Koning Boudewijnstichting', 'inst:grant'),
  ('Koning Boudewijnstichting', 'inst:outcome_payment'),
  ('Streekfonds West-Vlaanderen', 'theme:leisure'),
  ('Streekfonds West-Vlaanderen', 'inst:grant')
) v(name, term)
join public.funders f on f.name = v.name
join public.terms t on t.id = v.term
on conflict do nothing;
`;export{e as default};