var e=`-- Financing instruments after the independent domain review (2026-10-23):
-- * How money is granted (participatory, pooled, venture philanthropy, light
--   reporting) is a separate group from what kind of money it is.
-- * "Staged" duplicated calls.tranches: retired into the classic gift.
-- * Matchfunding is topping up what a project raises itself; co-financing by other
--   funders is an eligibility rule (calls.cofunding_allowed), not an instrument.
-- * PRI / MRI describe where the money comes from, not the instrument: they move to
--   the repayable group. Natural Belgian Dutch / French terms; prize split from
--   challenge; honour loans, micro-grants and scholarships added.
-- * outcome_linked: whether payment depends on measured results, as an attribute,
--   because an impact premium can sit on a gift as well as on a loan.

alter table public.terms add column outcome_linked boolean;

insert into public.terms (id, kind, label_nl, label_fr, parent_id, synonyms, sort, description_nl, description_fr) values
  ('inst:g_modality', 'instrument', 'Toekenningswijze', 'Modalité d''octroi', null, '{}', 4,
   'Hoe beslist en uitbetaald wordt, los van het instrument.',
   'Comment on décide et verse, indépendamment de l''instrument.'),
  ('inst:challenge', 'instrument', 'Challenge-oproep', 'Appel à défis', 'inst:g_gift',
   '{challenge,challenge fund,wedstrijd,concours,défi}', 6,
   'Competitieve oproep die vooraf financiert om een benoemd probleem op te lossen.',
   'Appel compétitif qui finance d''avance la résolution d''un problème précis.'),
  ('inst:micro_grant', 'instrument', 'Microsubsidie', 'Micro-subside', 'inst:g_gift',
   '{microsubsidie,kleine subsidie,microgrant,micro-subvention}', 2,
   'Kleine bedragen (vaak < €2.500), snel en licht toegekend, vaak aan jongerengroepen.',
   'Petits montants (souvent < 2 500 €), accordés vite et simplement, souvent à des groupes de jeunes.'),
  ('inst:honour_loan', 'instrument', 'Erelening', 'Prêt d''honneur', 'inst:g_repayable',
   '{erelening,renteloze persoonlijke lening,prêt d''honneur}', 2,
   'Renteloze lening zonder waarborg aan een jongere of startende ondernemer.',
   'Prêt sans intérêt ni garantie à un jeune ou à un entrepreneur qui démarre.'),
  ('res:scholarship', 'resource', 'Studiebeurs', 'Bourse d''études', 'res:g_youth',
   '{beurs,studiebeurs,bourse,scholarship}', 3,
   'Persoonlijke beurs voor de opleiding of het traject van een jongere.',
   'Bourse personnelle pour la formation ou le parcours d''un jeune.');

-- How money is granted: its own group.
update public.terms set parent_id = 'inst:g_modality', sort = 1 where id = 'inst:participatory';
update public.terms set parent_id = 'inst:g_modality', sort = 2 where id = 'inst:pooled';
update public.terms set parent_id = 'inst:g_modality', sort = 3 where id = 'inst:venture_philanthropy';
update public.terms set parent_id = 'inst:g_modality', sort = 4,
  label_nl = 'Lichte rapportering', label_fr = 'Rapportage allégé',
  synonyms = '{trust based,vertrouwensgebaseerd,fondé sur la confiance}',
  description_nl = 'Vertrouwen vooraf: weinig aanvraag- en rapportagewerk. Ongebonden of meerjarig staat bij soort steun.',
  description_fr = 'Confiance a priori : peu de formalités. Le non-affecté ou pluriannuel est un type de soutien.'
where id = 'inst:trust_based';

-- Staged duplicated calls.tranches.
insert into public.call_terms (call_id, term_id)
select call_id, 'inst:grant' from public.call_terms where term_id = 'inst:staged'
on conflict do nothing;
delete from public.call_terms where term_id = 'inst:staged';
delete from public.funder_focus where term_id = 'inst:staged';
update public.terms set status = 'retired', merged_into = 'inst:grant' where id = 'inst:staged';
update public.terms set synonyms = synonyms || '{mijlpaal,tranches,jalons}' where id = 'inst:grant';

update public.terms set label_nl = 'Matchfunding', label_fr = 'Abondement (matchfunding)',
  synonyms = '{matching,verdubbeling,crowdfunding,abondement,doublement}',
  description_nl = 'Het fonds legt een bedrag bij per euro die het project zelf ophaalt, bv. via crowdfunding.',
  description_fr = 'Le fonds ajoute un montant par euro que le projet collecte lui-même, p. ex. en crowdfunding.'
where id = 'inst:matchfunding';

update public.terms set label_nl = 'Prijs of award', label_fr = 'Prix',
  synonyms = '{prijs,award,prix,laureaat,lauréat}',
  description_nl = 'Beloning achteraf voor een behaald resultaat of initiatief.',
  description_fr = 'Récompense a posteriori pour un résultat ou une initiative.'
where id = 'inst:prize';

update public.terms set label_nl = 'Terugvorderbare subsidie', label_fr = 'Avance récupérable',
  synonyms = '{recoverable grant,terugbetaalbaar voorschot,subvention remboursable,avance récupérable}',
  description_nl = 'Gift die (deels) terugbetaald wordt als het project inkomsten of succes oplevert.',
  description_fr = 'Aide remboursée (en partie) si le projet génère des revenus ou réussit.'
where id = 'inst:recoverable';

update public.terms set label_nl = 'Renteloze of zachte lening', label_fr = 'Prêt à taux zéro ou solidaire',
  synonyms = '{lening,prêt,renteloos,sociale lening,prêt solidaire}',
  description_nl = 'Lening met lage of geen rente en soepele terugbetaling.',
  description_fr = 'Prêt à taux faible ou nul, remboursement souple.'
where id = 'inst:loan';

update public.terms set synonyms = '{quasi equity,achtergesteld,subordonné,quasi-fonds propres}',
  description_nl = 'Lening die pas na andere schuldeisers terugbetaald wordt en als quasi-eigen vermogen telt.',
  description_fr = 'Prêt remboursé après les autres créanciers, compté comme quasi-fonds propres.'
where id = 'inst:quasi_equity';

update public.terms set synonyms = '{equity,aandelen,participation,capital}' where id = 'inst:equity';
update public.terms set synonyms = synonyms ||
  '{pri,mri,programmagebonden investering,investissement lié à la mission,programme related investment,mission related investment}'
where id = 'inst:g_repayable';

update public.terms set label_nl = 'Waarborg', label_fr = 'Garantie',
  synonyms = '{garantie,borg,borgstelling}'
where id = 'inst:guarantee';

update public.terms set
  synonyms = '{blended finance,first loss,eerste verlies,gift en lening}',
  description_nl = 'Combinatie van gift en terugbetaalbaar geld in één pakket, bv. gift plus lening of eerste-verliesgarantie.',
  description_fr = 'Don et argent remboursable combinés, p. ex. don plus prêt ou garantie de première perte.'
where id = 'inst:blended';

update public.terms set synonyms = synonyms ||
  '{sociale impactobligatie,obligation à impact social,social outcomes contract,contrat à impact social}'
where id = 'inst:sib';

update public.terms set outcome_linked = true
where id in ('inst:g_outcome', 'inst:outcome_payment', 'inst:sib', 'inst:outcomes_fund',
             'inst:impact_incentive', 'inst:prize');
update public.terms set outcome_linked = false where kind = 'instrument' and outcome_linked is null;
`;export{e as default};