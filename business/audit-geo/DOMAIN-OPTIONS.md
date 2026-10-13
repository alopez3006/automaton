# Domaine du pilote — 13 octobre 2026

## Publication par le superviseur après instruction du propriétaire

Les trois records du tableau ont été ajoutés dans la zone Infomaniak, TTL 3600. Lectures autoritaires sur nsany1.infomaniak.com : CNAME et deux TXT exactement présents. A racine et MX préservés. La session du propriétaire était déjà connectée ; aucun mot de passe ni secret de compte lu.

Refresh Sites après publication : SSL active, provider active_redeploying et statut pending. Le premier GET HTTPS a retourné 404 pendant le raccordement ; DNS publié/certificat actif ne constituent pas encore la preuve du parcours client sur le domaine. Vérifier après activation et conserver l’hôte gratuit jusque-là.

Vérification suivante réussie : Sites retourne désormais status/provider/SSL **active**. GET HTTPS `/`, `/privacy` et `/example.md` sur `https://audit.vutler.com` retournent **200**. Le domaine public est opérationnel ; le test complet d’une demande et de la livraison reste à suivre dans le reçu de la troisième passe. Métadonnées partagées dans publication.json.

Choix opérationnel : **audit.vutler.com**, actif déclaré possédé par le propriétaire. Aucun achat nécessaire ; dépenses 0 €, enveloppe restante 20 €. L’absence de DNS ne prouve pas la propriété ni l’absence d’un usage prévu.

## Historique de préparation avant publication

Les éléments suivants décrivent le contrôle initial ; les records sont maintenant publiés et le domaine est actif, comme vérifié ci-dessus.

Vérifications publiques initiales : aucun A/AAAA/CNAME retourné pour audit.vutler.com ; DNS vutler.com nsany1/nsany2.infomaniak.com, racine A 84.16.66.164, MX 5 mta-gw.infomaniak.ch. Racine, MX et TXT existants à conserver.

Sites a ajouté le sous-domaine au projet existant. ID appgdom_6acdd6ba79388191939f78ba6816fcf7 ; statut pending, TLS initializing. Il reste à poser **exactement** :

| Type | Nom complet | Valeur |
|---|---|---|
| CNAME | audit.vutler.com | custom-domains.chatgpt.site. |
| TXT | _openai-site-verification.audit.vutler.com | openai-site-verification=at1ZZ2tNW8KA7g_3lpcWaWpQJ82FBn68NaGLUQJ49aU |
| TXT | _cf-custom-hostname.audit.vutler.com | 4ff545fb-d993-47c9-b3da-0ce71b98a7ad |

Dans la zone Infomaniak vutler.com, les noms relatifs sont audit, _openai-site-verification.audit et _cf-custom-hostname.audit. Ne pas ajouter les A apex retournés : il s’agit d’un sous-domaine. Aucun record existant à effacer ni redirection racine à changer.

Après enregistrement : rafraîchir le statut Sites, vérifier DNS, TLS, accueil, création/suivi/suppression d’une demande synthétique et téléchargement de l’exemple. Le téléchargement d’un rapport impayé doit rester refusé. L’hôte gratuit reste l’URL active jusqu’à preuve complète. Aucune connexion DNS ou TLS réussie n’est revendiquée à ce stade.

Ancien devis pagebriefly.com abandonné comme option de lancement : les actifs possédés sont préférés selon la nouvelle instruction du propriétaire. Aucun prix historique n’est utilisé pour acheter.
