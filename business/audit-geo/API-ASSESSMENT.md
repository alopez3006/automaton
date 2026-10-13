# API et qualité du rapport — 13 octobre 2026

Demande propriétaire : examiner public-apis/public-apis pour savoir si une API améliorerait le rapport. Recherche seulement ; aucune intégration, souscription ou publication effectuée.

**Conclusion : aucune API payante nécessaire pour l'offre à 9 €. PageSpeed/Lighthouse est le meilleur complément technique ; une collecte locale plus complète est le premier chantier.** Ajouter un fournisseur de génération de texte ne résout pas le manque de preuves.

## État observé dans le code

`evidence.mjs` récupère l'URL demandée, robots.txt et /sitemap.xml. Il conserve au maximum 16 000 caractères par ressource après retrait des scripts/styles. Il ne visite pas les pages du sitemap. Le retrait des scripts retire aussi les blocs JSON-LD : le rapport ne peut donc pas conclure à l'absence de données structurées à partir de cette collecte.

PageSpeed existe avec `operator.mjs --pagespeed`, mais conserve uniquement le score performance mobile. Les diagnostics détaillés, métriques, catégories SEO/accessibilité et contexte de mesure ne sont pas transmis. Aucun nouveau modèle n'est nécessaire pour les exploiter.

## Choix et limites

| Option | Apport | Accès et limites | Recommandation |
|---|---|---|---|
| Collecte locale bornée | Titres, descriptions, H1, canonical, indexabilité, liens et JSON-LD ; comparaison de quelques pages utiles | Pas d'API tierce ; conserver protection SSRF, limites de taille/temps/redirections et origine contrôlée ; HTML brut différent du DOM rendu | Priorité 1 : accueil et jusqu'à quatre pages pertinentes, sans crawl illimité |
| Google PageSpeed Insights, présent dans la liste | Diagnostics Lighthouse et mesures de laboratoire, mobile et desktop | Google documente l'accès sans clé mais recommande une clé pour les appels automatisés fréquents. Test réel sans clé sur notre domaine : HTTP 429 RESOURCE_EXHAUSTED à 11:41:54 UTC ; zéro diagnostic obtenu | Priorité 2 : accès fiable et restitution détaillée ; échec = indisponible, jamais score zéro |
| Lighthouse local | Audits performance, SEO, accessibilité, bonnes pratiques sans API externe | Chrome et outil local requis ; charge sur le Mac ; résultats de laboratoire, pas mesures des visiteurs | Alternative à PageSpeed si quota bloqué ; installation/exécution non réalisées dans cette recherche |
| Google CrUX | Expérience réelle agrégée, URL ou origine, période de collecte | Clé Google Cloud requise ; disponibilité des données à vérifier pour chaque site. Google annonce le retrait futur des données CrUX de PageSpeed | Option ultérieure, distinguer clairement terrain/laboratoire et URL/origine |
| Google Search Console | Clics, impressions, CTR et position moyenne observée ; requêtes/pages | OAuth et consentement du client requis, scope lecture seule ; résultats limités aux lignes retournées | Très utile pour une offre ultérieure ou export fourni par le client ; pas prérequis de l'audit public à 9 € |
| serpstack, présent dans la liste | Résultats de recherche sur un échantillon de requêtes/localisations | Tarif consulté : gratuit 100 recherches/mois, usage non commercial ; Basic commercial 29,99 USD/mois. Ce forfait récurrent sort du périmètre autorisé | Ne pas intégrer au pilote ; un instantané SERP ne prouve ni trafic ni visibilité ChatGPT/Claude |
| APIs scraping/screenshot et génération de texte de la liste | Extraction/rendu ou rédaction selon fournisseur | Gratuité, usage commercial, quotas et conservation doivent être vérifiés individuellement ; présence dans l'annuaire insuffisante | Aucun achat ni fournisseur supplémentaire recommandé pour le besoin actuel |

## Proposition concrète pour une prochaine implémentation

1. Extraire et conserver les preuves HTML structurées avant nettoyage, notamment JSON-LD, avec URL/date et inconnues explicites ; analyser un petit ensemble de pages du même site. Aucune absence déduite d'une donnée supprimée/tronquée.
2. Conserver les diagnostics Lighthouse utiles, leur version, date, URL finale, appareil et conditions ; produire jusqu'à trois actions fondées sur ces diagnostics. Répéter les mesures avant d'affirmer une amélioration. Une seule mesure n'est pas une tendance.
3. Garder l'offre « fondations SEO/GEO ». Accès crawler, présence dans une réponse IA et trafic sont des preuves différentes. Google ne demande aucun fichier ni balisage spécial pour ses fonctionnalités IA. Aucun score de visibilité IA inventé.

Validation attendue : JSON-LD présent/absent/invalide, contenu tronqué, site rendu en JavaScript, sitemap absent, URL externe/privée refusée, quota 429, métrique manquante et séparation terrain/laboratoire. Vérifier ensuite un rapport réellement utile sans imposer trois tâches.

## Sources consultées

- [Liste public-apis, README actuel](https://raw.githubusercontent.com/public-apis/public-apis/master/README.md) : découverte, pas garantie de gratuité/fiabilité.
- [PageSpeed, accès et données](https://developers.google.com/speed/docs/insights/v5/get-started).
- [Lighthouse, exécution locale](https://developer.chrome.com/docs/lighthouse/overview).
- [CrUX API, clé et modèle des données](https://developer.chrome.com/docs/crux/api/).
- [Search Console, OAuth et lecture seule](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing) et [métriques retournées](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).
- [serpstack, conditions des forfaits](https://serpstack.com/pricing). Prix constaté à cette date, pas devis ni achat.
- [Google, fonctionnalités IA et fondations SEO](https://developers.google.com/search/docs/appearance/ai-features).

Stripe Directory tenté avec le CLI scoped : plugin indisponible ; page de secours stripe.directory inaccessible via le lecteur web. Comparaison poursuivie sur les sources primaires, sans engagement de fournisseur. Broker mémoire hébergé interrogé avec succès après résolution du blocage réseau du sandbox. Aucun secret lu ou affiché.
