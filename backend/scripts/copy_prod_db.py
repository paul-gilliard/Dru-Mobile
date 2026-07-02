"""
Copie une base MySQL/MariaDB distante (prod) vers une base MySQL/MariaDB
locale (XAMPP), en LECTURE SEULE côté source.

Utilisé à la place de `mysqldump`/`mysql` (client MariaDB de XAMPP) car ce
dernier ne sait pas parler le plugin d'authentification `caching_sha2_password`
utilisé par le serveur MySQL 8 de Railway. PyMySQL + `cryptography` (déjà
dans requirements.txt) savent le faire nativement.

Usage:
    venv\\Scripts\\python.exe scripts\\copy_prod_db.py ^
        --source-host mainline.proxy.rlwy.net --source-port 17058 ^
        --source-user root --source-password "xxxx" --source-db railway ^
        --target-db dru_mobile_copy

Ne JAMAIS pointer --source-host vers un hôte interne (*.railway.internal) :
injoignable depuis l'extérieur du réseau privé Railway.
"""
import argparse
import re
import sys

import pymysql


def _make_mariadb_compatible(create_sql: str) -> str:
    """Le serveur MySQL 8 de prod utilise des collations (ex: utf8mb4_0900_ai_ci)
    que le client/serveur MariaDB local (XAMPP) ne connaît pas. On les
    remplace par un équivalent largement supporté."""
    create_sql = re.sub(r'utf8mb4_0900\w*', 'utf8mb4_unicode_ci', create_sql)
    create_sql = re.sub(r'\bDEFAULT CHARSET=utf8mb4[^\s,]*', 'DEFAULT CHARSET=utf8mb4', create_sql)
    return create_sql


def connect(host, port, user, password, database=None):
    return pymysql.connect(
        host=host, port=port, user=user, password=password,
        database=database, charset='utf8mb4', autocommit=True,
        connect_timeout=20, read_timeout=120, write_timeout=120,
    )


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source-host', required=True)
    p.add_argument('--source-port', type=int, required=True)
    p.add_argument('--source-user', required=True)
    p.add_argument('--source-password', required=True)
    p.add_argument('--source-db', required=True)

    p.add_argument('--target-host', default='127.0.0.1')
    p.add_argument('--target-port', type=int, default=3306)
    p.add_argument('--target-user', default='root')
    p.add_argument('--target-password', default='')
    p.add_argument('--target-db', default='dru_mobile_copy')
    args = p.parse_args()

    print(f"==> Connexion source ({args.source_db}@{args.source_host}:{args.source_port})...")
    src = connect(args.source_host, args.source_port, args.source_user, args.source_password, args.source_db)

    print(f"==> Connexion cible locale ({args.target_host}:{args.target_port})...")
    admin = connect(args.target_host, args.target_port, args.target_user, args.target_password)
    with admin.cursor() as cur:
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{args.target_db}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
    admin.close()
    tgt = connect(args.target_host, args.target_port, args.target_user, args.target_password, args.target_db)

    with src.cursor() as scur:
        scur.execute("SHOW TABLES")
        tables = [row[0] for row in scur.fetchall()]
    print(f"==> {len(tables)} tables trouvées : {', '.join(tables)}")

    with tgt.cursor() as tcur:
        tcur.execute("SET FOREIGN_KEY_CHECKS=0")

    for table in tables:
        print(f"    -> {table} ...", end=' ', flush=True)
        with src.cursor() as scur:
            scur.execute(f"SHOW CREATE TABLE `{table}`")
            create_sql = scur.fetchone()[1]
        create_sql = _make_mariadb_compatible(create_sql)

        with tgt.cursor() as tcur:
            tcur.execute(f"DROP TABLE IF EXISTS `{table}`")
            tcur.execute(create_sql)

        with src.cursor() as scur:
            scur.execute(f"SELECT * FROM `{table}`")
            columns = [d[0] for d in scur.description]
            rows = scur.fetchall()

        if rows:
            placeholders = ', '.join(['%s'] * len(columns))
            col_list = ', '.join(f'`{c}`' for c in columns)
            insert_sql = f"INSERT INTO `{table}` ({col_list}) VALUES ({placeholders})"
            with tgt.cursor() as tcur:
                batch = 500
                for i in range(0, len(rows), batch):
                    tcur.executemany(insert_sql, rows[i:i + batch])
        print(f"{len(rows)} lignes")

    with tgt.cursor() as tcur:
        tcur.execute("SET FOREIGN_KEY_CHECKS=1")

    src.close()
    tgt.close()

    print("\n==> Migration de compatibilité (display_name, password_hash)...")
    tgt2 = connect(args.target_host, args.target_port, args.target_user, args.target_password, args.target_db)
    with tgt2.cursor() as cur:
        try:
            cur.execute("ALTER TABLE `user` ADD COLUMN `display_name` VARCHAR(128) NULL")
        except pymysql.err.OperationalError as e:
            if e.args[0] != 1060:  # 1060 = Duplicate column name (déjà appliqué)
                raise
        cur.execute("ALTER TABLE `user` MODIFY COLUMN `password_hash` VARCHAR(255) NOT NULL")
        cur.execute("UPDATE `user` SET `display_name` = `username` WHERE `display_name` IS NULL")
    tgt2.close()

    print("\nCopie terminée avec succès.")
    pw = args.target_password
    print("Ajoute ceci dans backend/.env :")
    print(f"DATABASE_URL=mysql+pymysql://{args.target_user}:{pw}@{args.target_host}:{args.target_port}/{args.target_db}")


if __name__ == '__main__':
    try:
        main()
    except pymysql.err.OperationalError as e:
        print(f"\nERREUR de connexion MySQL : {e}", file=sys.stderr)
        sys.exit(1)
