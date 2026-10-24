var e=`-- The federation's 14 youth themes (docs/analyse-thema-doelgroep.md), term descriptions,
-- and admin functions to manage the vocabulary directly (tab "Woordenlijst").
-- Existing ids are kept, so every tagged call keeps its tags: themes are renamed, merged
-- themes become subtopics of a new parent, and subtopics move by changing parent_id.

alter table public.terms
  add column description_nl text not null default '' check (length(description_nl) <= 1000),
  add column description_fr text not null default '' check (length(description_fr) <= 1000);

-- ---------- new top-level themes ----------
insert into public.terms (id, kind, label_nl, label_fr, parent_id, sdgs, synonyms, sort) values
  ('theme:health', 'theme', 'Gezondheid en welzijn', 'Santé et bien-être', null, '{3}',
   '{gezondheid,welzijn,santé,bien-être,health,wellbeing}', 3),
  ('theme:housing_independence', 'theme', 'Wonen en zelfstandigheid', 'Logement et autonomie', null, '{1,11}',
   '{wonen,zelfstandigheid,huisvesting,logement,autonomie,housing}', 8),
  ('theme:leisure', 'theme', 'Vrije tijd, jeugdwerk, sport en cultuur', 'Loisirs, animation jeunesse, sport et culture', null, '{3,4,11}',
   '{vrije tijd,jeugdwerk,sport,cultuur,loisirs,culture,leisure}', 9),
  ('theme:migration', 'theme', 'Migratie, vluchtelingen en integratie', 'Migration, réfugiés et intégration', null, '{10,16}',
   '{migratie,vluchtelingen,integratie,inburgering,migration,réfugiés,intégration}', 13),
  ('theme:mobility', 'theme', 'Mobiliteit en bereikbaarheid', 'Mobilité et accessibilité', null, '{9,11}',
   '{mobiliteit,bereikbaarheid,vervoer,mobilité,accessibilité,transport,mobility}', 14);

-- ---------- renamed top-level themes, in the federation's order ----------
update public.terms t set label_nl = v.nl, label_fr = v.fr, sort = v.sort
from (values
  ('theme:early_childhood', 'Vroege kindontwikkeling en opvoedingsondersteuning', 'Petite enfance et soutien à la parentalité', 1),
  ('theme:education', 'Onderwijs en leren', 'Éducation et apprentissage', 2),
  ('theme:safety', 'Jeugdhulp, veiligheid en kinderbescherming', 'Aide à la jeunesse, sécurité et protection de l''enfance', 4),
  ('theme:poverty', 'Armoede en basisbehoeften', 'Pauvreté et besoins de base', 5),
  ('theme:diversity', 'Gelijke kansen, diversiteit en inclusie', 'Égalité des chances, diversité et inclusion', 6),
  ('theme:talent_work', 'Werk, vaardigheden en ondernemerschap', 'Emploi, compétences et entrepreneuriat', 7),
  ('theme:participation', 'Participatie, burgerschap en leiderschap', 'Participation, citoyenneté et leadership', 10),
  ('theme:digital', 'Digitale vaardigheden en media', 'Compétences numériques et médias', 11),
  ('theme:climate', 'Klimaat, natuur en leefomgeving', 'Climat, nature et cadre de vie', 12)
) v(id, nl, fr, sort)
where t.id = v.id;

-- ---------- merged: health, and leisure/sport/culture ----------
-- The former top-level themes become subtopics, so calls tagged with them roll up.
update public.terms set parent_id = 'theme:health', sdgs = '{}', sort = 1,
  label_nl = 'Mentale gezondheid', label_fr = 'Santé mentale' where id = 'theme:mental_health';
update public.terms set parent_id = 'theme:health', sdgs = '{}', sort = 2,
  label_nl = 'Fysieke gezondheid', label_fr = 'Santé physique' where id = 'theme:health_sport';
update public.terms set parent_id = 'theme:health', sort = 3,
  label_nl = 'Preventie en veerkracht' where id = 'theme:mh_prevention';
update public.terms set parent_id = 'theme:health', sort = 5 where id in ('theme:loneliness', 'theme:addiction');
update public.terms set parent_id = 'theme:health', sort = 6,
  label_nl = 'Gezonde voeding en leefstijl', label_fr = 'Alimentation et mode de vie sains' where id = 'theme:healthy_living';

update public.terms set parent_id = 'theme:leisure', sdgs = '{}', sort = 3,
  label_nl = 'Kunst en cultuur', label_fr = 'Art et culture' where id = 'theme:culture';
update public.terms set parent_id = 'theme:leisure', sort = 2,
  label_nl = 'Sport en beweging', label_fr = 'Sport et mouvement' where id = 'theme:sport_participation';
update public.terms set parent_id = 'theme:leisure', sort = 4 where id in ('theme:arts_participation', 'theme:heritage');

-- ---------- moved subtopics ----------
update public.terms set parent_id = 'theme:housing_independence', sort = 2,
  label_nl = 'Betaalbare huisvesting en dakloosheid', label_fr = 'Logement abordable et sans-abrisme' where id = 'theme:housing';
update public.terms set parent_id = 'theme:migration', sort = 1,
  label_nl = 'Begeleiding en bescherming van jonge nieuwkomers', label_fr = 'Accompagnement et protection des jeunes primo-arrivants' where id = 'theme:newcomers';
update public.terms set parent_id = 'theme:digital', sort = 4,
  label_nl = 'Mediawijsheid en desinformatie', label_fr = 'Éducation aux médias et désinformation',
  synonyms = synonyms || '{desinformatie,désinformation}' where id = 'theme:media_literacy';
update public.terms set synonyms = synonyms || '{verwaarlozing,misbruik,négligence,maltraitance}' where id = 'theme:violence';

-- ---------- new subtopics ----------
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('theme:early_nutrition', 'theme', 'Voeding in de eerste levensjaren', 'Alimentation des jeunes enfants', 'theme:early_childhood', '{borstvoeding,voeding kinderen,alimentation}', 4),
  ('theme:school_readiness', 'theme', 'Voorbereiding op school', 'Préparation à l''école', 'theme:early_childhood', '{schoolrijpheid,kleuterschool,préparation scolaire}', 5),
  ('theme:preschool', 'theme', 'Voorschoolse educatie', 'Éducation préscolaire', 'theme:education', '{voorschools,kleuteronderwijs,préscolaire,maternelle}', 0),
  ('theme:learning_gap', 'theme', 'Leerachterstand', 'Retard d''apprentissage', 'theme:education', '{leerachterstand,achterstand,retard scolaire,remédiation}', 6),
  ('theme:vocational_education', 'theme', 'Beroepsonderwijs', 'Enseignement professionnel', 'theme:education', '{beroepsonderwijs,tso,bso,dbso,enseignement qualifiant}', 7),
  ('theme:lifelong_learning', 'theme', 'Levenslang en niet-formeel leren', 'Apprentissage tout au long de la vie et non formel', 'theme:education', '{niet-formeel,levenslang leren,non formel,tout au long de la vie}', 8),
  ('theme:sexual_health', 'theme', 'Seksuele gezondheid', 'Santé sexuelle', 'theme:health', '{seksuele gezondheid,relaties,santé sexuelle,evras}', 7),
  ('theme:neglect', 'theme', 'Verwaarlozing en misbruik', 'Négligence et maltraitance', 'theme:safety', '{verwaarlozing,misbruik,kindermishandeling,négligence,maltraitance}', 3),
  ('theme:crisis_care', 'theme', 'Crisisopvang', 'Accueil de crise', 'theme:safety', '{crisisopvang,noodopvang,accueil d''urgence}', 5),
  ('theme:access_services', 'theme', 'Toegang tot zorg en voorzieningen', 'Accès aux soins et aux services', 'theme:poverty', '{toegang,zorg,voorzieningen,kleding,accès aux soins}', 4),
  ('theme:vocational_skills', 'theme', 'Beroepsvaardigheden', 'Compétences professionnelles', 'theme:talent_work', '{beroepsvaardigheden,vakmanschap,compétences professionnelles}', 5),
  ('theme:school_to_work', 'theme', 'Overgang van opleiding naar werk', 'Transition de la formation à l''emploi', 'theme:talent_work', '{overgang naar werk,begeleiding naar werk,insertion,transition}', 6),
  ('theme:supported_living', 'theme', 'Begeleid wonen', 'Logement accompagné', 'theme:housing_independence', '{begeleid wonen,kamertraining,logement accompagné}', 1),
  ('theme:independent_living', 'theme', 'Zelfstandig leven en overgang naar volwassenheid', 'Autonomie et passage à l''âge adulte', 'theme:housing_independence', '{zelfstandig wonen,18+,meerderjarigheid,autonomie,passage à l''âge adulte}', 3),
  ('theme:youth_work', 'theme', 'Jeugdwerk en jeugdbewegingen', 'Animation jeunesse et mouvements de jeunesse', 'theme:leisure', '{jeugdwerk,jeugdbeweging,chiro,scouts,mouvement de jeunesse,maison de jeunes}', 1),
  ('theme:holiday', 'theme', 'Vakantiewerking en ontmoeting', 'Activités de vacances et rencontres', 'theme:leisure', '{vakantiewerking,speelpleinwerking,kamp,plaine de jeux,stage}', 5),
  ('theme:leadership', 'theme', 'Leiderschap', 'Leadership', 'theme:participation', '{leiderschap,leadership,jongerenbestuur}', 4),
  ('theme:living_environment', 'theme', 'Duurzame en gezonde leefomgeving', 'Cadre de vie durable et sain', 'theme:climate', '{leefomgeving,publieke ruimte,buurt,espace public,cadre de vie}', 3),
  ('theme:language', 'theme', 'Taal en onderwijs voor nieuwkomers', 'Langue et scolarité des primo-arrivants', 'theme:migration', '{okan,taalles,nederlands leren,daspa,fle}', 2),
  ('theme:social_contacts', 'theme', 'Sociale contacten en netwerk', 'Liens sociaux et réseau', 'theme:migration', '{buddy,netwerk,sociale contacten,parrainage}', 3),
  ('theme:safe_travel', 'theme', 'Veilige verplaatsingen', 'Déplacements sûrs', 'theme:mobility', '{verkeersveiligheid,schoolroute,sécurité routière}', 1),
  ('theme:public_transport', 'theme', 'Openbaar vervoer en bereikbaarheid', 'Transports publics et accessibilité', 'theme:mobility', '{openbaar vervoer,bus,tram,bereikbaarheid,transports en commun}', 2),
  ('theme:independent_mobility', 'theme', 'Zelfstandige mobiliteit', 'Mobilité autonome', 'theme:mobility', '{fiets,rijbewijs,fietsles,vélo,permis}', 3);

-- ---------- descriptions, as the federation wrote them ----------
update public.terms t set description_nl = v.nl, description_fr = v.fr
from (values
  ('theme:early_childhood', 'Kinderopvang, ontwikkeling in de eerste levensjaren, ondersteuning van ouders en verzorgers, voeding en voorbereiding op school.',
   'Accueil de l''enfance, développement des premières années, soutien aux parents et aux aidants, alimentation et préparation à l''école.'),
  ('theme:education', 'Voorschoolse educatie, schoolbegeleiding, leerachterstand, schooluitval, beroepsonderwijs, levenslang leren en niet-formeel leren.',
   'Éducation préscolaire, accompagnement scolaire, retard d''apprentissage, décrochage, enseignement professionnel, apprentissage tout au long de la vie et non formel.'),
  ('theme:health', 'Fysieke gezondheid, mentale gezondheid, preventie, verslaving, seksuele gezondheid, voeding en veerkracht. Vooral bij jonge kinderen vraagt dit vaak samenwerking tussen zorg, onderwijs, gezin en sociale bescherming (UNICEF).',
   'Santé physique et mentale, prévention, assuétudes, santé sexuelle, alimentation et résilience. Surtout chez les jeunes enfants, cela demande souvent une collaboration entre soins, école, famille et protection sociale (UNICEF).'),
  ('theme:safety', 'Hulp bij problemen thuis, geweld, misbruik, verwaarlozing, crisisopvang, jeugdbescherming en begeleiding van jongeren die met justitie in contact komen.',
   'Aide en cas de problèmes à la maison, violence, maltraitance, négligence, accueil de crise, protection de la jeunesse et accompagnement des jeunes en contact avec la justice.'),
  ('theme:poverty', 'Toegang tot inkomen, voedsel, kleding, gezondheidszorg, onderwijs, vrije tijd en andere essentiële voorzieningen.',
   'Accès au revenu, à l''alimentation, aux vêtements, aux soins, à l''éducation, aux loisirs et aux autres services essentiels.'),
  ('theme:diversity', 'Ondersteuning van kinderen en jongeren met een beperking, een migratieachtergrond, discriminatie-ervaring, kwetsbare thuissituatie of andere drempels tot deelname.',
   'Soutien aux enfants et jeunes en situation de handicap, issus de l''immigration, confrontés à la discrimination, à une situation familiale fragile ou à d''autres obstacles à la participation.'),
  ('theme:talent_work', 'Oriëntatie, stages, beroepsvaardigheden, begeleiding naar werk, jongeren die niet studeren of werken, ondernemerschap en de overgang van opleiding naar werk.',
   'Orientation, stages, compétences professionnelles, accompagnement vers l''emploi, jeunes sans emploi ni formation, entrepreneuriat et transition de la formation à l''emploi.'),
  ('theme:housing_independence', 'Begeleid wonen, betaalbare huisvesting, dak- en thuisloosheid, zelfstandig leren leven en ondersteuning bij de overgang naar volwassenheid.',
   'Logement accompagné, logement abordable, sans-abrisme, apprentissage de l''autonomie et soutien au passage à l''âge adulte.'),
  ('theme:leisure', 'Jeugdbewegingen, sport, kunst, cultuur, ontmoeting, vakantiewerking en laagdrempelige activiteiten.',
   'Mouvements de jeunesse, sport, art, culture, rencontres, activités de vacances et activités accessibles.'),
  ('theme:participation', 'Jongeren inspraak geven, vrijwilligerswerk, jeugdraden, maatschappelijke betrokkenheid en mee beslissen over beleid en projecten. De EU noemt participatie en betrokkenheid expliciet als kern van haar jeugdbeleid.',
   'Donner la parole aux jeunes, volontariat, conseils de jeunes, engagement citoyen et codécision sur les politiques et projets. L''UE place explicitement la participation au cœur de sa politique de jeunesse.'),
  ('theme:digital', 'Digitale toegang en vaardigheden, mediawijsheid, online veiligheid, cyberpesten, desinformatie en verantwoord gebruik van technologie.',
   'Accès et compétences numériques, éducation aux médias, sécurité en ligne, cyberharcèlement, désinformation et usage responsable de la technologie.'),
  ('theme:climate', 'Klimaatactie, natuurbehoud, duurzame buurten, gezonde publieke ruimte en betrokkenheid van jongeren bij milieubeslissingen.',
   'Action climatique, préservation de la nature, quartiers durables, espace public sain et implication des jeunes dans les décisions environnementales.'),
  ('theme:migration', 'Taal, onderwijs, sociale contacten, bescherming en begeleiding van jonge nieuwkomers en vluchtelingen.',
   'Langue, scolarité, liens sociaux, protection et accompagnement des jeunes primo-arrivants et réfugiés.'),
  ('theme:mobility', 'Veilige verplaatsingen, openbaar vervoer, zelfstandige mobiliteit en toegang tot school, werk, zorg en vrije tijd.',
   'Déplacements sûrs, transports publics, mobilité autonome et accès à l''école, au travail, aux soins et aux loisirs.')
) v(id, nl, fr)
where t.id = v.id;

-- ---------- reads: descriptions travel with the vocabulary ----------
create or replace function public.taxonomy() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'terms', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'kind', t.kind, 'label_nl', t.label_nl, 'label_fr', t.label_fr,
        'parent_id', t.parent_id, 'sdgs', to_jsonb(t.sdgs), 'synonyms', to_jsonb(t.synonyms),
        'status', t.status, 'mine', t.proposed_by = auth.uid(), 'merged_into', t.merged_into,
        'sort', t.sort, 'description_nl', t.description_nl, 'description_fr', t.description_fr)
        order by t.kind, t.sort, t.label_nl)
      from public.terms t), '[]'::jsonb),
    'funders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.name, 'kind', f.kind, 'website', f.website,
        'intake_url', f.intake_url, 'is_member', f.is_member, 'city', f.city,
        'country', f.country, 'logo_url', f.logo_url) order by f.name)
      from public.funders f), '[]'::jsonb),
    'custom_fields', coalesce((select jsonb_agg(to_jsonb(cf) - 'created_at' order by cf.sort, cf.key)
      from public.custom_fields cf), '[]'::jsonb)
  );
$$;

-- ---------- admin: manage the vocabulary directly ----------

-- Create (no id) or update a term. Regions are generated from NIS / ISO and stay out.
create function public.admin_save_term(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := nullif(p ->> 'id', '');
  v_kind public.term_kind := (p ->> 'kind')::public.term_kind;
  v_parent text := nullif(p ->> 'parent_id', '');
  v_base text;
  v_syn text[] := coalesce(array(select left(btrim(s), 80) from jsonb_array_elements_text(p -> 'synonyms') s
                                 where btrim(s) <> '' limit 30), '{}');
  v_sdgs smallint[] := coalesce(array(select x::smallint from jsonb_array_elements_text(p -> 'sdgs') x
                                      where x ~ '^[0-9]{1,2}$' and x::int between 1 and 17), '{}');
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  if v_id is not null then
    select kind into v_kind from public.terms where id = v_id and status = 'active';
    if not found then
      raise exception 'No active term %', v_id using errcode = 'P0002';
    end if;
  end if;
  if v_kind = 'region' then
    raise exception 'Regions follow NIS and ISO codes and are not edited here' using errcode = '22023';
  end if;
  if v_parent is not null then
    if not exists (select 1 from public.terms where id = v_parent and kind = v_kind and status = 'active') then
      raise exception 'The parent must be an active term of the same kind' using errcode = '22023';
    end if;
    -- No cycles: the new parent may not be the term itself or one of its descendants.
    if v_id is not null and exists (
      with recursive up(id) as (
        select v_parent union all
        select t.parent_id from public.terms t join up on t.id = up.id where t.parent_id is not null)
      select 1 from up where id = v_id) then
      raise exception 'A term cannot sit under itself or its own subtopic' using errcode = '22023';
    end if;
  end if;
  if v_id is null then
    v_base := v_kind::text || ':' || coalesce(nullif(trim(both '_' from
      regexp_replace(lower(translate(btrim(p ->> 'label_nl'),
        'àáâäãèéêëìíîïòóôöõùúûüçñ', 'aaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '_', 'g')), ''), 'term');
    v_id := left(v_base, 60);
    if exists (select 1 from public.terms where id = v_id) then
      v_id := left(v_base, 52) || '_' || substr(md5(random()::text), 1, 6);
    end if;
    insert into public.terms (id, kind, label_nl, label_fr, parent_id, sdgs, synonyms, sort,
      description_nl, description_fr)
    values (v_id, v_kind, btrim(p ->> 'label_nl'),
      coalesce(nullif(btrim(p ->> 'label_fr'), ''), btrim(p ->> 'label_nl')), v_parent,
      case when v_parent is null then v_sdgs else '{}' end, v_syn,
      coalesce(nullif(p ->> 'sort', '')::smallint, 50),
      coalesce(left(btrim(p ->> 'description_nl'), 1000), ''),
      coalesce(left(btrim(p ->> 'description_fr'), 1000), ''));
  else
    update public.terms set
      label_nl = btrim(p ->> 'label_nl'),
      label_fr = coalesce(nullif(btrim(p ->> 'label_fr'), ''), btrim(p ->> 'label_nl')),
      parent_id = v_parent,
      sdgs = case when v_parent is null then v_sdgs else '{}' end,
      synonyms = v_syn,
      sort = coalesce(nullif(p ->> 'sort', '')::smallint, sort),
      description_nl = coalesce(left(btrim(p ->> 'description_nl'), 1000), ''),
      description_fr = coalesce(left(btrim(p ->> 'description_fr'), 1000), '')
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Take a term out of use. With a target, its calls move there and its labels become
-- synonyms of the target (nothing is lost); without one, only an unused term can go.
create function public.admin_retire_term(p_id text, p_target text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  t public.terms;
  v_moved integer;
begin
  if not public.is_federation_admin() then
    raise exception 'Federation admins only' using errcode = '42501';
  end if;
  select * into t from public.terms where id = p_id and status = 'active';
  if not found then
    raise exception 'No active term %', p_id using errcode = 'P0002';
  end if;
  if t.kind = 'region' then
    raise exception 'Regions follow NIS and ISO codes and are not edited here' using errcode = '22023';
  end if;
  if exists (select 1 from public.terms where parent_id = p_id and status = 'active') then
    raise exception 'Move or retire its subtopics first' using errcode = '22023';
  end if;
  select count(*) into v_moved from public.call_terms where term_id = p_id;
  if p_target is null and v_moved > 0 then
    raise exception 'This term is used on % calls; choose a term to move them to', v_moved using errcode = '22023';
  end if;
  if p_target is not null then
    if p_target = p_id or not exists (
      select 1 from public.terms where id = p_target and kind = t.kind and status = 'active') then
      raise exception 'The target must be another active term of the same kind' using errcode = '22023';
    end if;
    insert into public.call_terms (call_id, term_id)
    select call_id, p_target from public.call_terms where term_id = p_id on conflict do nothing;
    insert into public.call_metrics (call_id, term_id, target, actual, unit)
    select call_id, p_target, target, actual, unit from public.call_metrics where term_id = p_id
    on conflict do nothing;
    update public.terms set synonyms = (
      select coalesce(array_agg(distinct s), '{}') from (
        select s from unnest(synonyms || t.synonyms || array[t.label_nl, t.label_fr]) s limit 30) x)
    where id = p_target;
  end if;
  delete from public.call_metrics where term_id = p_id;
  delete from public.call_terms where term_id = p_id;
  update public.terms set status = 'retired', merged_into = p_target where id = p_id;
  return v_moved;
end;
$$;

revoke execute on function public.admin_save_term(jsonb), public.admin_retire_term(text, text) from public, anon;
grant execute on function public.admin_save_term(jsonb), public.admin_retire_term(text, text) to authenticated;
`;export{e as default};