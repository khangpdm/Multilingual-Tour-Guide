import json
import re
from datetime import datetime, timezone

import pymysql
from pathlib import Path
from pymysql.cursors import DictCursor
from datetime import date


class DuplicateRecordError(Exception):
    pass


class Cursor:
    def __init__(self, items):
        self.items = items

    def sort(self, field, direction=1):
        self.items.sort(key=lambda row: row.get(field) or "", reverse=direction < 0)
        return self

    def skip(self, count):
        self.items = self.items[count:]
        return self

    def limit(self, count):
        self.items = self.items[:count]
        return self

    def __iter__(self):
        return iter(self.items)


def _decode_json(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _normalize_row(row):
    return {key: (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat() if isinstance(value, datetime) else value.isoformat() if isinstance(value, date) else value for key, value in row.items()}


def _matches(item, query):
    for key, expected in query.items():
        actual = item.get(key)
        if isinstance(expected, dict):
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$gt" in expected and not actual > expected["$gt"].isoformat():
                return False
            if "$gte" in expected and not actual >= expected["$gte"].isoformat():
                return False
            if "$lte" in expected and not actual <= expected["$lte"].isoformat():
                return False
            if "$regex" in expected:
                flags = re.IGNORECASE if expected.get("$options") == "i" else 0
                if actual is None or not re.search(expected["$regex"], actual, flags):
                    return False
        elif actual != expected:
            return False
    return True


class Collection:
    def __init__(self, database, name):
        self.db = database
        self.name = name

    def _all(self):
        with self.db.connection() as conn, conn.cursor() as cur:
            if self.name == "admin_sessions":
                cur.execute("SELECT token_hash AS _id, user_id, expires_at FROM admin_sessions")
                return [_normalize_row(row) for row in cur.fetchall()]
            if self.name == "users":
                cur.execute("SELECT id AS _id, id AS user_id, email, COALESCE(full_name,'') AS full_name, role_id, LOWER(status) AS status, password_hash, password_salt, last_login_at, created_at, updated_at FROM users")
                return [_normalize_row(row) for row in cur.fetchall()]
            if self.name == "roles":
                cur.execute("SELECT id AS _id, id AS role_id, name, level, is_system FROM roles")
                roles = [_normalize_row(row) for row in cur.fetchall()]
                for role in roles:
                    cur.execute("SELECT permission_id FROM role_permissions WHERE role_id=%s", (role["role_id"],))
                    role["permissions"] = [row["permission_id"] for row in cur.fetchall()]
                return roles
            if self.name == "languages":
                cur.execute("SELECT code AS _id, code, name, native_name, is_active, is_default, display_order FROM languages")
                return [_normalize_row(row) for row in cur.fetchall()]
            if self.name == "zones":
                cur.execute("SELECT id AS _id, id AS zone_id, name, min_lng, min_lat, max_lng, max_lat, min_zoom, max_zoom, is_active, created_at, updated_at FROM zone")
                result = [_normalize_row(row) for row in cur.fetchall()]
                for row in result:
                    row["map_region"] = {"bbox": [float(row.pop("min_lng")), float(row.pop("min_lat")), float(row.pop("max_lng")), float(row.pop("max_lat"))], "min_zoom": row["min_zoom"], "max_zoom": row["max_zoom"]}
                return result
            if self.name == "pois":
                cur.execute("SELECT id AS _id, id AS poi_id, zone_id, category, ST_Longitude(location) AS lng, ST_Latitude(location) AS lat, radius AS geofence_radius_m, qr_code, status, is_archived, unpublish_reason, images, last_modified_by, created_at, updated_at FROM poi")
                result = [_normalize_row(row) for row in cur.fetchall()]
                for row in result:
                    row["images"] = _decode_json(row["images"]) or []
                    row["location"] = {"type": "Point", "coordinates": [float(row.pop("lng")), float(row.pop("lat"))]}
                    cur.execute("SELECT language_code, name, address, description, text, audio_url, audio_sha256, audio_source, is_edited, updated_at FROM poi_content WHERE poi_id=%s", (row["_id"],))
                    row["content"] = {content["language_code"]: {key: value for key, value in content.items() if key != "language_code"} for content in cur.fetchall()}
                    row["is_archived"] = bool(row.pop("is_archived", False))
                return result
            if self.name == "audit_logs":
                cur.execute("SELECT id AS _id, id AS log_id, actor_user_id, action, target_id, before_data AS `before`, after_data AS `after`, created_at AS `timestamp` FROM audit_logs")
                return [_normalize_row({**row, "before": _decode_json(row["before"]), "after": _decode_json(row["after"])}) for row in cur.fetchall()]
        raise ValueError(f"Unsupported MySQL collection: {self.name}")

    def find_one(self, query):
        return next((item for item in self._all() if _matches(item, query)), None)

    def find(self, query=None):
        return Cursor([item for item in self._all() if _matches(item, query or {})])

    def count_documents(self, query):
        return sum(_matches(item, query) for item in self._all())

    def create_index(self, *args, **kwargs):
        return None

    def insert_one(self, doc):
        try:
            with self.db.connection() as conn, conn.cursor() as cur:
                if self.name == "admin_sessions":
                    cur.execute("INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (%s,%s,%s)", (doc["_id"], doc["user_id"], doc["expires_at"].replace(tzinfo=None)))
                elif self.name == "users":
                    cur.execute("INSERT INTO users (id,email,password_hash,password_salt,full_name,role_id,status) VALUES (%s,%s,%s,%s,%s,%s,'ACTIVE')", (doc["_id"], doc["email"], doc["password_hash"], doc.get("password_salt"), doc.get("full_name"), doc["role_id"]))
                elif self.name == "zones":
                    bounds = doc["map_region"]["bbox"]
                    cur.execute("INSERT INTO zone (id,name,min_lng,min_lat,max_lng,max_lat,min_zoom,max_zoom,is_active) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", (doc["_id"], doc["name"], *bounds, doc["map_region"]["min_zoom"], doc["map_region"]["max_zoom"], doc["is_active"]))
                elif self.name == "languages":
                    cur.execute("INSERT INTO languages (code,name,native_name,is_active,is_default,display_order) VALUES (%s,%s,%s,%s,%s,%s)", (doc["_id"], doc["name"], doc["native_name"], doc["is_active"], doc["is_default"], doc["display_order"]))
                elif self.name == "pois":
                    point = doc["location"]["coordinates"]
                    cur.execute("INSERT INTO poi (id,zone_id,category,location,radius,qr_code,status,images,last_modified_by) VALUES (%s,%s,%s,ST_GeomFromText(%s,4326,'axis-order=long-lat'),%s,%s,'active',%s,%s)", (doc["_id"], doc["zone_id"], doc["category"], f"POINT({point[0]} {point[1]})", doc["geofence_radius_m"], doc.get("qr_code"), json.dumps(doc.get("images", [])), doc["last_modified_by"]))
                    for locale, content in doc.get("content", {}).items():
                        cur.execute("INSERT INTO poi_content (poi_id,language_code,name,address,description,text,audio_url,audio_sha256,audio_source,is_edited) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", (doc["_id"], locale, content["name"], content.get("address"), content.get("description"), content["text"], content.get("audio_url"), content.get("audio_sha256"), content.get("audio_source"), content.get("is_edited", False)))
                elif self.name == "audit_logs":
                    cur.execute("INSERT INTO audit_logs (id,actor_user_id,action,target_id,before_data,after_data,ip_hash) VALUES (%s,%s,%s,%s,%s,%s,%s)", (doc["_id"], doc["actor_user_id"], doc["action"], doc.get("target_id"), json.dumps(doc.get("before"), default=str), json.dumps(doc.get("after"), default=str), doc.get("ip_hash")))
                else:
                    raise ValueError(f"Unsupported insert collection: {self.name}")
        except pymysql.err.IntegrityError as error:
            if error.args and error.args[0] == 1062:
                raise DuplicateRecordError from error
            raise

    def update_one(self, query, update, upsert=False):
        doc = self.find_one(query)
        if not doc:
            if not upsert:
                return
            doc = {key: value for key, value in query.items() if not isinstance(value, dict)}
            doc.update(update.get("$setOnInsert", {}))
            doc.update(update.get("$set", {}))
            doc.setdefault("_id", doc.get("role_id"))
            if self.name == "roles":
                with self.db.connection() as conn, conn.cursor() as cur:
                    cur.execute("INSERT INTO roles (id,name,level,is_system) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE name=VALUES(name),level=VALUES(level),is_system=VALUES(is_system)", (doc["_id"], doc["name"], doc["level"], doc["is_system"]))
                    for permission in doc["permissions"]:
                        cur.execute("INSERT IGNORE INTO permissions (id,domain) VALUES (%s,%s)", (permission, permission.split(".")[0]))
                        cur.execute("INSERT IGNORE INTO role_permissions (role_id,permission_id) VALUES (%s,%s)", (doc["_id"], permission))
            return
        changes = update.get("$set", {})
        with self.db.connection() as conn, conn.cursor() as cur:
            if self.name == "roles":
                return
            if self.name == "admin_sessions":
                cur.execute("UPDATE admin_sessions SET expires_at=%s WHERE token_hash=%s", (changes["expires_at"].replace(tzinfo=None), doc["_id"]))
            elif self.name == "users":
                if "last_login_at" in changes:
                    cur.execute("UPDATE users SET last_login_at=%s WHERE id=%s", (changes["last_login_at"].replace(tzinfo=None), doc["_id"]))
            elif self.name == "languages":
                fields = {**doc, **changes}
                if fields.get("is_default"):
                    cur.execute("UPDATE languages SET is_default=FALSE WHERE code<>%s AND is_default=TRUE", (doc["_id"],))
                cur.execute("UPDATE languages SET name=%s,native_name=%s,is_active=%s,is_default=%s,display_order=%s WHERE code=%s", (fields["name"], fields["native_name"], fields["is_active"], fields["is_default"], fields["display_order"], doc["_id"]))
            elif self.name == "zones":
                fields = {**doc, **changes}; bounds = fields["map_region"]["bbox"]
                cur.execute("UPDATE zone SET name=%s,min_lng=%s,min_lat=%s,max_lng=%s,max_lat=%s,min_zoom=%s,max_zoom=%s,is_active=%s WHERE id=%s", (fields["name"], *bounds, fields["map_region"]["min_zoom"], fields["map_region"]["max_zoom"], fields["is_active"], doc["_id"]))
            elif self.name == "pois":
                fields = {**doc, **changes}
                if "content." in " ".join(changes):
                    for key, content in changes.items():
                        if key.startswith("content."):
                            locale = key.split(".", 1)[1]
                            cur.execute("INSERT INTO poi_content (poi_id,language_code,name,address,description,text,audio_url,audio_sha256,audio_source,is_edited) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE name=VALUES(name),address=VALUES(address),description=VALUES(description),text=VALUES(text),is_edited=VALUES(is_edited)", (doc["_id"], locale, content["name"], content.get("address"), content.get("description"), content["text"], content.get("audio_url"), content.get("audio_sha256"), content.get("audio_source"), content.get("is_edited", False)))
                point = fields["location"]["coordinates"]
                status = "inactive" if fields.get("is_archived") or fields.get("status") == "inactive" else "active"
                cur.execute("UPDATE poi SET zone_id=%s,category=%s,location=ST_GeomFromText(%s,4326,'axis-order=long-lat'),radius=%s,qr_code=%s,status=%s,is_archived=%s,unpublish_reason=%s,last_modified_by=%s WHERE id=%s", (fields["zone_id"], fields["category"], f"POINT({point[0]} {point[1]})", fields["geofence_radius_m"], fields.get("qr_code"), status, fields.get("is_archived", False), fields.get("unpublish_reason"), fields.get("last_modified_by", doc["last_modified_by"]), doc["_id"]))
            else:
                raise ValueError(f"Unsupported update collection: {self.name}")

    def update_many(self, query, update):
        for item in self.find(query):
            self.update_one({"_id": item["_id"]}, update)

    def delete_one(self, query):
        doc = self.find_one(query)
        if doc and self.name == "admin_sessions":
            with self.db.connection() as conn, conn.cursor() as cur:
                cur.execute("DELETE FROM admin_sessions WHERE token_hash=%s", (doc["_id"],))

    def find_one_and_update(self, query, update, return_document=None):
        doc = self.find_one(query)
        if doc:
            self.update_one({"_id": doc["_id"]}, update)
            return self.find_one({"_id": doc["_id"]})


class MySQLDatabase:
    def __init__(self, settings):
        self.host = settings.get("MYSQL_HOST", "127.0.0.1")
        self.port = int(settings.get("MYSQL_PORT", 3306))
        self.user = settings.get("MYSQL_USER", "root")
        self.password = settings.get("MYSQL_PASSWORD", "")
        self.name = settings.get("MYSQL_DB_NAME", "tourism_db")

    def connection(self):
        connection = pymysql.connect(host=self.host, port=self.port, user=self.user, password=self.password, database=self.name, charset="utf8mb4", cursorclass=DictCursor, connect_timeout=5, autocommit=True)
        with connection.cursor() as cursor:
            cursor.execute("SET time_zone = '+00:00'")
        return connection

    def initialize(self):
        schema = Path(__file__).resolve().parents[1] / "app" / "db" / "admin_mysql.sql"
        with self.connection() as conn, conn.cursor() as cur:
            for statement in schema.read_text(encoding="utf-8").split(";"):
                if statement.strip():
                    cur.execute(statement)
            self._ensure_column(cur, "users", "password_salt", "CHAR(32) NULL")
            self._ensure_column(cur, "users", "full_name", "VARCHAR(255) NULL")
            self._ensure_column(cur, "poi", "is_archived", "BOOLEAN NOT NULL DEFAULT FALSE")
            self._ensure_column(cur, "poi", "unpublish_reason", "VARCHAR(500) NULL")
            cur.execute("SELECT id FROM roles WHERE id='local_admin'")
            if not cur.fetchone():
                cur.execute("INSERT INTO roles (id,name,level,is_system) VALUES ('local_admin','Local database editor',2,TRUE)")
            for permission in ["poi.view", "poi.create", "poi.edit", "poi.delete", "poi.assign_qr", "content.unpublish", "content.restore", "system.manage_constants", "system.manage_languages", "audit.view"]:
                cur.execute("INSERT IGNORE INTO permissions (id,domain) VALUES (%s,%s)", (permission, permission.split(".")[0]))
                cur.execute("INSERT IGNORE INTO role_permissions (role_id,permission_id) VALUES ('local_admin',%s)", (permission,))

    def _ensure_column(self, cursor, table, column, definition):
        cursor.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s AND COLUMN_NAME=%s",
            (self.name, table, column),
        )
        if not cursor.fetchone():
            cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")
    def command(self, command):
        if command != "ping":
            raise ValueError("Unsupported MySQL command")
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()

    def table_counts(self):
        tables = (
            "roles", "permissions", "users", "role_permissions", "languages",
            "zone", "poi", "poi_content", "audio_tasks", "analytics_events",
            "poi_density_hourly", "offline_pack_releases", "offline_pack_languages",
            "audit_logs", "admin_sessions",
        )
        with self.connection() as conn, conn.cursor() as cur:
            result = {}
            for table in tables:
                cur.execute(f"SELECT COUNT(*) AS total FROM `{table}`")
                result[table] = cur.fetchone()["total"]
        return result

    def fetch_one(self, table, filters):
        return Collection(self, table).find_one(filters)

    def fetch_valid_session(self, token_hash, current_time):
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT token_hash AS _id,user_id,expires_at FROM admin_sessions WHERE token_hash=%s AND expires_at>%s LIMIT 1",
                (token_hash, current_time.replace(tzinfo=None)),
            )
            row = cur.fetchone()
        return _normalize_row(row) if row else None

    def count_zone_pois(self, zone_id):
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM poi WHERE zone_id=%s AND status='active' AND is_archived=FALSE", (zone_id,))
            return cur.fetchone()["total"]

    def has_default_language(self):
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1 FROM languages WHERE is_default=TRUE LIMIT 1")
            return cur.fetchone() is not None

    def clear_default_language_except(self, code):
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute("UPDATE languages SET is_default=FALSE WHERE code<>%s AND is_default=TRUE", (code,))

    def fetch_all(self, table, filters=None, order_by=None, descending=False, limit=None, offset=0):
        rows = Collection(self, table).find(filters or {})
        if order_by:
            rows.sort(order_by, -1 if descending else 1)
        if offset:
            rows.skip(offset)
        if limit is not None:
            rows.limit(limit)
        return list(rows)

    def count(self, table, filters=None):
        return Collection(self, table).count_documents(filters or {})

    def _audit_filter_sql(self, filters):
        clauses = []
        params = []
        for key in ("actor_user_id", "action", "target_id"):
            if filters.get(key):
                clauses.append(f"{key}=%s")
                params.append(filters[key])
        if filters.get("from"):
            clauses.append("created_at>=%s")
            params.append(filters["from"].astimezone(timezone.utc).replace(tzinfo=None))
        if filters.get("to"):
            clauses.append("created_at<=%s")
            params.append(filters["to"].astimezone(timezone.utc).replace(tzinfo=None))
        return (" WHERE " + " AND ".join(clauses) if clauses else ""), params

    def fetch_audit_logs(self, filters, page, page_size):
        where, params = self._audit_filter_sql(filters)
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id AS _id,id AS log_id,actor_user_id,action,target_id,before_data AS `before`,after_data AS `after`,created_at AS `timestamp` FROM audit_logs" + where + " ORDER BY created_at DESC LIMIT %s OFFSET %s",
                [*params, page_size, (page - 1) * page_size],
            )
            rows = cur.fetchall()
        return [_normalize_row({**row, "before": _decode_json(row["before"]), "after": _decode_json(row["after"])}) for row in rows]

    def count_audit_logs(self, filters):
        where, params = self._audit_filter_sql(filters)
        with self.connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM audit_logs" + where, params)
            return cur.fetchone()["total"]

    def insert_record(self, table, record):
        return Collection(self, table).insert_one(record)

    def update_record(self, table, record_id, changes):
        return Collection(self, table).find_one_and_update(
            {"_id": record_id}, {"$set": changes}
        )

    def delete_record(self, table, record_id):
        return Collection(self, table).delete_one({"_id": record_id})

    def update_records(self, table, filters, changes):
        return Collection(self, table).update_many(filters, {"$set": changes})

    def __getitem__(self, name):
        return Collection(self, name)

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return Collection(self, name)

    def close(self):
        return None
