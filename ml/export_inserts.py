"""
Dump every row of every base table in the TrainWise database as plain,
runnable INSERT statements. Output: sql/full_data_insert.sql

Run from the ml/ folder:  python export_inserts.py

The generated script is intentionally simple: just INSERT statements, with
tables ordered parent-before-child (topological sort over the foreign keys) so
it runs on an empty schema without disabling constraints. IDENTITY_INSERT is
toggled around tables with an identity column so the original primary-key
values (and the FKs that point at them) are preserved. Strings are escaped,
datetimes quoted, and NULL / bit / binary rendered safely.
"""
import datetime
import decimal
import os

import db

OUT = os.path.join(os.path.dirname(__file__), "..", "sql", "full_data_insert.sql")

# Tables we never want to seed (SSMS diagram metadata, migration bookkeeping).
SKIP_TABLES = {"sysdiagrams"}


def list_tables(cur):
    cur.execute(
        "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
        "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    )
    return [(s, t) for s, t in cur.fetchall() if t not in SKIP_TABLES]


def ordered_tables(cur, tables):
    """Topologically sort so a table comes after every table it references via a
    foreign key. Self-references are ignored; any leftover cycle is appended in
    name order (rare, and the FK toggle on identity tables still lets it load)."""
    names = {t for _, t in tables}
    # child -> set(parents it depends on)
    cur.execute(
        "SELECT OBJECT_NAME(parent_object_id), OBJECT_NAME(referenced_object_id) "
        "FROM sys.foreign_keys"
    )
    deps = {t: set() for t in names}
    for child, parent in cur.fetchall():
        if child in names and parent in names and child != parent:
            deps[child].add(parent)

    ordered, placed = [], set()
    while len(placed) < len(names):
        ready = sorted(t for t in names
                       if t not in placed and deps[t] <= placed)
        if not ready:  # cycle: break it by taking the rest in name order
            ready = sorted(t for t in names if t not in placed)
        for t in ready:
            ordered.append(t)
            placed.add(t)
    schema_of = {t: s for s, t in tables}
    return [(schema_of[t], t) for t in ordered]


def columns(cur, schema, table):
    cur.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
        [schema, table],
    )
    return [r[0] for r in cur.fetchall()]


def has_identity(cur, schema, table):
    cur.execute(
        "SELECT COUNT(*) FROM sys.identity_columns "
        "WHERE object_id = OBJECT_ID(?)",
        [f"{schema}.{table}"],
    )
    return cur.fetchone()[0] > 0


def fmt(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float, decimal.Decimal)):
        return str(value)
    if isinstance(value, (bytes, bytearray)):
        return "0x" + value.hex()
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return "'" + str(value) + "'"
    # string / everything else: escape single quotes, emit as N'...' for unicode
    return "N'" + str(value).replace("'", "''") + "'"


def main():
    conn = db.get_connection()
    cur = conn.cursor()

    tables = ordered_tables(cur, list_tables(cur))
    lines = [
        "-- TrainWise data seed (INSERT statements only).",
        f"-- Generated {datetime.datetime.now():%Y-%m-%d %H:%M:%S} from "
        f"{db.config.SQL_SERVER} / {db.config.SQL_DATABASE}",
        "-- Run against an EMPTY schema (tables already created). Tables are",
        "-- ordered parent-before-child so foreign keys are satisfied.",
        "SET NOCOUNT ON;",
        "",
    ]

    total_rows = 0
    for schema, table in tables:
        cols = columns(cur, schema, table)
        if not cols:
            continue
        col_list = ", ".join(f"[{c}]" for c in cols)
        cur.execute(f"SELECT {col_list} FROM [{schema}].[{table}]")
        rows = cur.fetchall()
        if not rows:
            lines.append(f"-- {table}: no rows")
            lines.append("")
            continue

        ident = has_identity(cur, schema, table)
        lines.append(f"-- {table} ({len(rows)} rows)")
        if ident:
            lines.append(f"SET IDENTITY_INSERT [{schema}].[{table}] ON;")
        for r in rows:
            vals = ", ".join(fmt(v) for v in r)
            lines.append(
                f"INSERT INTO [{schema}].[{table}] ({col_list}) VALUES ({vals});"
            )
        if ident:
            lines.append(f"SET IDENTITY_INSERT [{schema}].[{table}] OFF;")
        lines.append("")
        total_rows += len(rows)

    lines += [f"-- Done. {len(tables)} tables, {total_rows} rows total.", ""]

    out_path = os.path.abspath(OUT)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    conn.close()
    print(f"Wrote {out_path}")
    print(f"{len(tables)} tables, {total_rows} rows")


if __name__ == "__main__":
    main()
