var e=`-- Reference vocabulary, shared by every funder. See docs/ux-analysis.md section 4.
-- Synonyms (NL, FR, EN, lowercase) feed both the tag picker search and the tag
-- suggestions in the call editor; merged proposals add to them over time.

insert into public.terms (id, kind, label_nl, label_fr, parent_id, sdgs, synonyms, sort) values
  -- themes
  ('theme:early_childhood', 'theme', 'Vroege kindertijd', 'Petite enfance', null, '{1,4}', '{kleuter,peuter,baby,kinderopvang,crèche,early childhood,0-6}', 1),
  ('theme:education', 'theme', 'Onderwijs en schoolsucces', 'Éducation et réussite scolaire', null, '{4,10}', '{onderwijs,school,leren,enseignement,éducation,education,leerlingen,élèves}', 2),
  ('theme:poverty', 'theme', 'Armoede en sociale inclusie', 'Pauvreté et inclusion sociale', null, '{1,10}', '{armoede,kansarmoede,pauvreté,précarité,poverty,inclusie,inclusion}', 3),
  ('theme:mental_health', 'theme', 'Mentaal welzijn', 'Santé mentale et bien-être', null, '{3}', '{welzijn,mentale gezondheid,psychisch,bien-être,santé mentale,wellbeing,mental health}', 4),
  ('theme:health_sport', 'theme', 'Gezondheid en sport', 'Santé et sport', null, '{3}', '{sport,beweging,gezondheid,santé,health,bewegen}', 5),
  ('theme:participation', 'theme', 'Participatie en burgerschap', 'Participation et citoyenneté', null, '{16}', '{participatie,inspraak,burgerschap,citoyenneté,participation,jongerenstem}', 6),
  ('theme:talent_work', 'theme', 'Talent, vaardigheden en werk', 'Talents, compétences et emploi', null, '{4,8}', '{werk,job,tewerkstelling,emploi,talent,vaardigheden,compétences,skills,employment}', 7),
  ('theme:digital', 'theme', 'Digitale inclusie', 'Inclusion numérique', null, '{4,10}', '{digitaal,digitale,numérique,digital,computer,laptop,internet}', 8),
  ('theme:culture', 'theme', 'Cultuur en creativiteit', 'Culture et créativité', null, '{4,11}', '{cultuur,kunst,creativiteit,culture,art,créativité,arts}', 9),
  ('theme:climate', 'theme', 'Klimaat en natuur', 'Climat et nature', null, '{13,15}', '{klimaat,natuur,milieu,climat,nature,environnement,climate,duurzaamheid}', 10),
  ('theme:safety', 'theme', 'Veiligheid en bescherming', 'Sécurité et protection', null, '{16}', '{veiligheid,bescherming,geweld,sécurité,protection,violence,safety}', 11),
  ('theme:diversity', 'theme', 'Diversiteit en gelijke behandeling', 'Diversité et égalité de traitement', null, '{5,10}', '{diversiteit,gelijke kansen,discriminatie,diversité,égalité des chances,discrimination,diversity}', 12);

insert into public.terms (id, kind, label_nl, label_fr, parent_id, sdgs, synonyms, sort) values
  ('theme:childcare', 'theme', 'Toegang tot kinderopvang', 'Accès à l''accueil de l''enfance', 'theme:early_childhood', '{}', '{kinderopvang,crèche,opvang,accueil}', 1),
  ('theme:parenting', 'theme', 'Opvoedingsondersteuning', 'Soutien à la parentalité', 'theme:early_childhood', '{}', '{opvoeding,ouders,parentalité,parents,gezin,famille}', 2),
  ('theme:early_language', 'theme', 'Vroege taalstimulering', 'Éveil au langage', 'theme:early_childhood', '{}', '{taalstimulering,voorlezen,langage,éveil}', 3),
  ('theme:dropout', 'theme', 'Schooluitval voorkomen', 'Prévenir le décrochage scolaire', 'theme:education', '{}', '{schooluitval,vroegtijdig schoolverlaten,ongekwalificeerd,décrochage,décrochage scolaire,dropout,spijbelen}', 1),
  ('theme:homework', 'theme', 'Huiswerkbegeleiding', 'Soutien scolaire', 'theme:education', '{}', '{huiswerk,huiswerkbegeleiding,bijles,soutien scolaire,devoirs,remédiation,tutoring}', 2),
  ('theme:literacy', 'theme', 'Lezen en geletterdheid', 'Lecture et littératie', 'theme:education', '{}', '{lezen,geletterdheid,leesplezier,lecture,littératie,literacy,boeken,livres}', 3),
  ('theme:stem', 'theme', 'STEM', 'STEM', 'theme:education', '{}', '{stem,wetenschap,techniek,wiskunde,sciences,technologie,mathématiques,coding,programmeren}', 4),
  ('theme:transitions', 'theme', 'Overgangen in de schoolloopbaan', 'Transitions scolaires', 'theme:education', '{}', '{overgang,studiekeuze,secundair,transition,orientation scolaire}', 5),
  ('theme:child_poverty', 'theme', 'Kinderarmoede', 'Pauvreté infantile', 'theme:poverty', '{}', '{kinderarmoede,pauvreté infantile,child poverty}', 1),
  ('theme:housing', 'theme', 'Wonen en dakloosheid', 'Logement et sans-abrisme', 'theme:poverty', '{}', '{wonen,huisvesting,dakloos,dakloosheid,logement,sans-abri,sans abri,homeless}', 2),
  ('theme:food', 'theme', 'Voeding en basisbehoeften', 'Alimentation et besoins de base', 'theme:poverty', '{}', '{voeding,maaltijd,ontbijt,alimentation,repas,petit-déjeuner,food}', 3),
  ('theme:mh_prevention', 'theme', 'Preventie en veerkracht', 'Prévention et résilience', 'theme:mental_health', '{}', '{preventie,veerkracht,prévention,résilience,resilience}', 1),
  ('theme:loneliness', 'theme', 'Eenzaamheid', 'Solitude', 'theme:mental_health', '{}', '{eenzaamheid,isolement,solitude,loneliness}', 2),
  ('theme:addiction', 'theme', 'Verslaving', 'Assuétudes', 'theme:mental_health', '{}', '{verslaving,drugs,alcohol,gaming,assuétudes,addiction}', 3),
  ('theme:sport_participation', 'theme', 'Sportparticipatie', 'Participation sportive', 'theme:health_sport', '{}', '{sportclub,sporten,club sportif,sportparticipatie}', 1),
  ('theme:healthy_living', 'theme', 'Gezonde leefstijl', 'Mode de vie sain', 'theme:health_sport', '{}', '{gezonde voeding,leefstijl,obesitas,mode de vie,alimentation saine}', 2),
  ('theme:youth_voice', 'theme', 'Jongeren aan het woord', 'La voix des jeunes', 'theme:participation', '{}', '{jongerenraad,inspraak,by youth for youth,par les jeunes,jongeren voor jongeren}', 1),
  ('theme:volunteering', 'theme', 'Vrijwilligerswerk', 'Volontariat', 'theme:participation', '{}', '{vrijwilligerswerk,vrijwilliger,engagement,volontariat,bénévolat,volunteering}', 2),
  ('theme:media_literacy', 'theme', 'Mediawijsheid en democratie', 'Éducation aux médias et démocratie', 'theme:participation', '{}', '{mediawijsheid,nepnieuws,democratie,éducation aux médias,démocratie,fake news}', 3),
  ('theme:orientation', 'theme', 'Oriëntatie en loopbaan', 'Orientation professionnelle', 'theme:talent_work', '{}', '{loopbaan,oriëntatie,orientation,carrière,beroepskeuze}', 1),
  ('theme:internships', 'theme', 'Stages en eerste job', 'Stages et premier emploi', 'theme:talent_work', '{}', '{stage,stages,eerste job,duaal leren,alternance,premier emploi,internship}', 2),
  ('theme:entrepreneurship', 'theme', 'Ondernemerschap', 'Entrepreneuriat', 'theme:talent_work', '{}', '{ondernemerschap,ondernemen,start-up,entrepreneuriat,entreprendre,incubator,incubateur}', 3),
  ('theme:financial_literacy', 'theme', 'Financiële geletterdheid', 'Éducation financière', 'theme:talent_work', '{}', '{financiële geletterdheid,budget,geld,sparen,éducation financière,argent,financial literacy}', 4),
  ('theme:devices', 'theme', 'Toegang tot toestellen en internet', 'Accès aux appareils et à internet', 'theme:digital', '{}', '{laptop,laptops,toestellen,ordinateur,ordinateurs,wifi,connectivité}', 1),
  ('theme:digital_skills', 'theme', 'Digitale vaardigheden', 'Compétences numériques', 'theme:digital', '{}', '{digitale vaardigheden,compétences numériques,digital skills,ict}', 2),
  ('theme:online_safety', 'theme', 'Online veiligheid', 'Sécurité en ligne', 'theme:digital', '{}', '{cyberpesten,online veiligheid,cyberharcèlement,sécurité en ligne,sexting}', 3),
  ('theme:arts_participation', 'theme', 'Kunstparticipatie', 'Participation artistique', 'theme:culture', '{}', '{muziek,theater,dans,musique,théâtre,danse,kunstbeoefening}', 1),
  ('theme:heritage', 'theme', 'Erfgoed', 'Patrimoine', 'theme:culture', '{}', '{erfgoed,museum,patrimoine,musée,heritage}', 2),
  ('theme:env_education', 'theme', 'Natuur- en milieueducatie', 'Éducation à l''environnement', 'theme:climate', '{}', '{milieueducatie,natuureducatie,éducation à l''environnement,buitenspelen}', 1),
  ('theme:climate_action', 'theme', 'Klimaatactie door jongeren', 'Action climatique des jeunes', 'theme:climate', '{}', '{klimaatactie,action climat,climate action,klimaatjongeren}', 2),
  ('theme:bullying', 'theme', 'Pesten', 'Harcèlement', 'theme:safety', '{}', '{pesten,harcèlement,bullying}', 1),
  ('theme:violence', 'theme', 'Geweldpreventie', 'Prévention de la violence', 'theme:safety', '{}', '{geweld,intrafamiliaal geweld,violence,maltraitance,misbruik,abus}', 2),
  ('theme:youth_care', 'theme', 'Jeugdhulp en pleegzorg', 'Aide à la jeunesse et accueil familial', 'theme:safety', '{}', '{jeugdhulp,pleegzorg,aide à la jeunesse,famille d''accueil,foster care,residentiële}', 3),
  ('theme:juvenile_justice', 'theme', 'Jeugddelinquentie', 'Délinquance juvénile', 'theme:safety', '{}', '{jeugddelinquentie,jeugdrecht,délinquance,ipp,justice juvénile}', 4),
  ('theme:newcomers', 'theme', 'Nieuwkomers en NBMV', 'Primo-arrivants et MENA', 'theme:diversity', '{}', '{nieuwkomers,nbmv,niet-begeleide minderjarigen,primo-arrivants,mena,réfugiés,vluchtelingen,refugees}', 1),
  ('theme:disability_inclusion', 'theme', 'Inclusie van jongeren met een beperking', 'Inclusion des jeunes en situation de handicap', 'theme:diversity', '{}', '{beperking,handicap,autisme,inclusief,inclusif,disability}', 2),
  ('theme:gender', 'theme', 'Gender en LGBTQ+', 'Genre et LGBTQ+', 'theme:diversity', '{}', '{gender,lgbtq,lgbt,meisjes,jongens,filles,garçons,genre}', 3),
  ('theme:anti_racism', 'theme', 'Racisme en discriminatie', 'Racisme et discrimination', 'theme:diversity', '{}', '{racisme,discriminatie,racisme,discrimination}', 4);

-- SDGs live on top-level themes; subtopics inherit them in the app.

insert into public.terms (id, kind, label_nl, label_fr, synonyms, sort) values
  ('vuln:poverty', 'vulnerability', 'Leven in armoede', 'En situation de pauvreté', '{kansarm,kansarme,armoede,précarité,défavorisés}', 1),
  ('vuln:migration', 'vulnerability', 'Migratieachtergrond', 'Issus de l''immigration', '{migratieachtergrond,anderstalig,immigration,allochtoon}', 2),
  ('vuln:newcomer', 'vulnerability', 'Nieuwkomer of vluchteling', 'Primo-arrivant ou réfugié', '{nieuwkomer,vluchteling,nbmv,mena,réfugié}', 3),
  ('vuln:disability', 'vulnerability', 'Met een beperking', 'En situation de handicap', '{beperking,handicap}', 4),
  ('vuln:neet', 'vulnerability', 'Niet aan het werk of op school (NEET)', 'Ni en emploi ni en formation (NEET)', '{neet,werkloos,sans emploi,inactif}', 5),
  ('vuln:youth_care', 'vulnerability', 'In de jeugdhulp of pleegzorg', 'Dans l''aide à la jeunesse ou en famille d''accueil', '{jeugdhulp,pleegzorg,aide à la jeunesse,placé}', 6),
  ('vuln:mental_health', 'vulnerability', 'Psychisch kwetsbaar', 'Santé mentale fragile', '{psychisch kwetsbaar,psychische problemen,fragilité psychique}', 7),
  ('vuln:dropout_risk', 'vulnerability', 'Risico op schooluitval', 'Risque de décrochage scolaire', '{schoolmoe,risque de décrochage}', 8),
  ('vuln:single_parent', 'vulnerability', 'Uit een eenoudergezin', 'Famille monoparentale', '{eenoudergezin,alleenstaande ouder,monoparentale}', 9),
  ('vuln:young_carer', 'vulnerability', 'Jonge mantelzorger', 'Jeune aidant proche', '{jonge mantelzorger,jeune aidant,mantelzorg}', 10),
  ('vuln:homeless', 'vulnerability', 'Dak- of thuisloos', 'Sans-abri ou sans logement', '{dakloos,thuisloos,sans-abri}', 11),

  ('setting:school', 'setting', 'School', 'École', '{school,klas,classe,école}', 1),
  ('setting:leisure', 'setting', 'Vrije tijd en jeugdwerk', 'Loisirs et animation jeunesse', '{jeugdwerk,jeugdbeweging,vrije tijd,loisirs,maison de jeunes,jongerenwerking}', 2),
  ('setting:care', 'setting', 'Zorg en hulpverlening', 'Soins et aide', '{hulpverlening,zorg,soins,aide}', 3),
  ('setting:work', 'setting', 'Werk en opleiding', 'Travail et formation', '{werkplek,opleiding,formation,entreprise}', 4),
  ('setting:family', 'setting', 'Thuis en gezin', 'Famille et domicile', '{thuis,gezin,famille,domicile}', 5),
  ('setting:community', 'setting', 'Buurt en publieke ruimte', 'Quartier et espace public', '{buurt,wijk,quartier,straat,espace public}', 6),
  ('setting:online', 'setting', 'Online', 'En ligne', '{online,en ligne,sociale media,réseaux sociaux}', 7),

  ('res:project_grant', 'resource', 'Projectsubsidie', 'Subvention de projet', '{projectsubsidie,subside,subvention}', 1),
  ('res:operating', 'resource', 'Werkingsmiddelen', 'Frais de fonctionnement', '{werkingsmiddelen,werkingskosten,fonctionnement}', 2),
  ('res:multi_year', 'resource', 'Meerjarige steun', 'Soutien pluriannuel', '{meerjarig,pluriannuel,multi-year}', 3),
  ('res:startup_costs', 'resource', 'Opstartkosten', 'Frais de démarrage', '{opstart,démarrage}', 4),
  ('res:investment', 'resource', 'Investering en materiaal', 'Investissement et matériel', '{investering,materiaal,infrastructuur,matériel,investissement}', 5),
  ('res:coaching', 'resource', 'Coaching of traject', 'Coaching ou trajet', '{coaching,begeleiding,traject,accompagnement}', 6),
  ('res:network', 'resource', 'Netwerk en events', 'Réseau et événements', '{netwerk,netwerkevent,réseau}', 7),
  ('res:individual', 'resource', 'Individuele beurs', 'Bourse individuelle', '{beurs,studiebeurs,bourse}', 8),
  ('res:loan', 'resource', 'Lening of impactinvestering', 'Prêt ou investissement d''impact', '{lening,prêt,impactinvestering,impact investment}', 9),

  ('applicant:npo', 'applicant', 'Vzw of ivzw', 'Asbl ou aisbl', '{vzw,ivzw,asbl,aisbl,vereniging}', 1),
  ('applicant:foundation', 'applicant', 'Stichting', 'Fondation', '{stichting,fondation}', 2),
  ('applicant:school', 'applicant', 'School', 'École', '{school,scholen,école,écoles}', 3),
  ('applicant:ocmw', 'applicant', 'OCMW of CPAS', 'CPAS ou OCMW', '{ocmw,cpas}', 4),
  ('applicant:local_gov', 'applicant', 'Lokaal bestuur', 'Pouvoir local', '{gemeente,stad,commune,ville,lokaal bestuur}', 5),
  ('applicant:informal', 'applicant', 'Feitelijke vereniging of burgerinitiatief', 'Association de fait ou initiative citoyenne', '{feitelijke vereniging,burgerinitiatief,association de fait,collectif}', 6),
  ('applicant:social_enterprise', 'applicant', 'Sociale onderneming', 'Entreprise sociale', '{sociale onderneming,coöperatie,entreprise sociale,coopérative}', 7),
  ('applicant:individual', 'applicant', 'Jongere zelf (individu)', 'Jeune lui-même (individu)', '{individu,persoonlijk,individuel}', 8),

  ('metric:youth_reached', 'metric', 'Aantal bereikte jongeren', 'Nombre de jeunes atteints', '{bereik,bereikte jongeren,jeunes atteints,deelnemers,participants}', 1),
  ('metric:vulnerable_share', 'metric', 'Aandeel kwetsbare jongeren', 'Part de jeunes vulnérables', '{aandeel kwetsbaar,part vulnérable}', 2),
  ('metric:support_hours', 'metric', 'Uren begeleiding', 'Heures d''accompagnement', '{uren,begeleidingsuren,heures}', 3),
  ('metric:school_completion', 'metric', 'Behaald diploma of attest', 'Diplôme ou certificat obtenu', '{diploma,attest,kwalificatie,diplôme,certificat}', 4),
  ('metric:jobs_internships', 'metric', 'Stage of job gevonden', 'Stage ou emploi trouvé', '{job gevonden,uitstroom,emploi trouvé,insertion}', 5),
  ('metric:wellbeing_change', 'metric', 'Verandering in welzijn', 'Évolution du bien-être', '{welzijnsscore,bien-être mesuré}', 6),
  ('metric:skills_gained', 'metric', 'Verworven vaardigheden', 'Compétences acquises', '{vaardigheden verworven,compétences acquises}', 7),
  ('metric:youth_led', 'metric', 'Jongeren in de leiding of het bestuur', 'Jeunes dans la gouvernance', '{jongeren in bestuur,gouvernance jeunes}', 8),
  ('metric:volunteers', 'metric', 'Betrokken vrijwilligers', 'Bénévoles impliqués', '{vrijwilligers,bénévoles}', 9);

insert into public.terms (id, kind, label_nl, label_fr, parent_id, sort) values
  ('nis:be', 'region', 'België', 'Belgique', null, 0);
insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort) values
  ('nis:02000', 'region', 'Vlaams Gewest', 'Région flamande', 'nis:be', '{vlaanderen,flandre,flanders}', 1),
  ('nis:03000', 'region', 'Waals Gewest', 'Région wallonne', 'nis:be', '{wallonië,wallonie,wallonia}', 2),
  ('nis:04000', 'region', 'Brussels Hoofdstedelijk Gewest', 'Région de Bruxelles-Capitale', 'nis:be', '{brussel,bruxelles,brussels}', 3);
insert into public.terms (id, kind, label_nl, label_fr, parent_id, sort) values
  ('nis:10000', 'region', 'Antwerpen', 'Anvers', 'nis:02000', 1),
  ('nis:20001', 'region', 'Vlaams-Brabant', 'Brabant flamand', 'nis:02000', 2),
  ('nis:30000', 'region', 'West-Vlaanderen', 'Flandre-Occidentale', 'nis:02000', 3),
  ('nis:40000', 'region', 'Oost-Vlaanderen', 'Flandre-Orientale', 'nis:02000', 4),
  ('nis:70000', 'region', 'Limburg', 'Limbourg', 'nis:02000', 5),
  ('nis:20002', 'region', 'Waals-Brabant', 'Brabant wallon', 'nis:03000', 1),
  ('nis:50000', 'region', 'Henegouwen', 'Hainaut', 'nis:03000', 2),
  ('nis:60000', 'region', 'Luik', 'Liège', 'nis:03000', 3),
  ('nis:80000', 'region', 'Luxemburg', 'Luxembourg', 'nis:03000', 4),
  ('nis:90000', 'region', 'Namen', 'Namur', 'nis:03000', 5);
`;export{e as default};