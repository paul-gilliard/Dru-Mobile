-- Migration de compatibilité à exécuter UNE FOIS sur la COPIE de la base
-- de production (jamais sur la vraie base prod !) après un mysqldump/import,
-- pour que le schéma corresponde exactement à ce qu'attend le backend mobile.
--
-- Le backend mobile (backend/app/models.py) est presque identique au schéma
-- de l'appli web, à deux différences près :
--   1) `user.display_name` : colonne ajoutée côté mobile pour afficher un nom
--      convivial (absente côté web -> on l'ajoute sur la copie).
--   2) `user.password_hash` : élargie à 255 caractères côté mobile par
--      prudence (certains algos de hash Werkzeug récents dépassent 128).
--   3) La fonctionnalité "bilan hebdo coché" du mobile utilise sa PROPRE
--      table `mobile_weekly_bilan_marking` (créée automatiquement par
--      `db.create_all()` au démarrage du backend), donc AUCUNE migration
--      n'est nécessaire pour `weekly_bilan_marking` : la table historique de
--      l'appli web reste intacte et n'est pas utilisée par le mobile.

ALTER TABLE `user`
  ADD COLUMN IF NOT EXISTS `display_name` VARCHAR(128) NULL;

ALTER TABLE `user`
  MODIFY COLUMN `password_hash` VARCHAR(255) NOT NULL;

UPDATE `user` SET `display_name` = `username` WHERE `display_name` IS NULL;
