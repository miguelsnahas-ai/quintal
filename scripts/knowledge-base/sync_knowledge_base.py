#!/usr/bin/env python3
"""Regenerate the SQL to sync public.knowledge_chunks with the source
Google Sheet ("base de conhecimento inicial para o RAG da IA do Quintal").

WHY THIS EXISTS
The sheet's own metadata row (row 1 of its legend table) says it plainly:
one self-contained "chunk" per row, ID = <tab prefix>-<number>, age in
months for filtering, tags/category for search. This script is the
formalized, reusable version of the one-off parsing done to seed the table
the first time (see git history around 2026-09-24) — reuse it instead of
re-deriving the column mapping from scratch, which is what caused most of
that session's back-and-forth.

HOW TO RUN A SYNC (for a future Claude Code session, or a human with MCP
access to the Google_Drive and Supabase tools)
  1. Get the sheet's Google Drive fileId from its URL
     (https://docs.google.com/spreadsheets/d/<fileId>/edit...).
  2. Call the Google_Drive MCP tool `read_file_content` with that fileId.
     Its result is JSON: {"fileContent": "<the whole sheet as markdown
     tables>"}. Save just the `fileContent` string to a local .txt file
     (e.g. with jq: `jq -r .fileContent raw.json > sheet.txt`).
  3. Run this script against that file:
       python3 scripts/knowledge-base/sync_knowledge_base.py sheet.txt > /tmp/kb_sync.sql
  4. Skim /tmp/kb_sync.sql's row counts (the script prints a per-category
     summary to stderr) against the sheet's own "Contagem de linhas" note
     in its legend table, as a sanity check.
  5. Apply /tmp/kb_sync.sql to the live project via the Supabase MCP tool
     `execute_sql` (project_id "izattwaiqjzhydzhxlns"). It's a single
     upsert + a delete-what's-gone statement — no need to batch it like
     the original 531-row INSERT (upserts on an already-indexed table are
     much lighter than the original CREATE TABLE + INSERT, but if the
     sheet has grown a lot, split by category the same way the original
     six-batch load did).
  6. Nothing else needs to change: knowledge_chunks_tsvector and
     search_knowledge_chunks (supabase/migrations/20260924*) are untouched
     by a data-only sync — the generated `search` column recomputes itself
     automatically for every upserted row.

WHAT IT DOES NOT HANDLE
  - Renumbering or reusing an existing ID for a different row. The sheet's
    own convention is "continue the numbering, never reuse an ID" — if
    that's ever violated, the upsert will silently overwrite the wrong
    logical row. Spot-check the diff if a row's *meaning* changed but its
    ID didn't.
  - Schema changes (new columns/tabs). Adding a new tab means adding a new
    entry to CONFIGS below with its own title/age/tags column names,
    mirroring the pattern of the existing ten.
"""

import re
import sys
from collections import Counter

# (category slug, title column, age-min column, age-max column, tags column)
# Mirrors the sheet's ten tabs, in the order they appear in the doc.
CONFIGS = [
    ("materiais", "Material", "Idade mín. (meses)", "Idade máx. (meses)", "Tags"),
    ("brincadeiras", "Nome", "Idade mín. (meses)", "Idade máx. (meses)", "Tags"),
    ("alimentos", "Alimento", "Idade mín. (meses)", None, None),
    ("receitas", "Receita", "Idade mín. (meses)", None, None),
    ("metodos_alimentacao", "Método", None, None, None),
    ("rotinas_sono", "Modelo de rotina", "Idade mín. (meses)", "Idade máx. (meses)", None),
    ("formas_de_dormir", "Método", "Idade mín. (meses)", "Idade máx. (meses)", None),
    ("desenvolvimento", "Área", "Idade mín. (meses)", "Idade máx. (meses)", None),
    ("higiene", "Produto (tipo)", "Idade mín. (meses)", "Idade máx. (meses)", None),
    ("passeios", "Passeio", "Idade mín. (meses)", "Idade máx. (meses)", None),
]

ID_RE = re.compile(r"^[A-Z]+-\d+$")


def parse_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def split_blocks(text: str) -> list[list[str]]:
    """Blank-line-delimited chunks of the doc. Each markdown table (the
    legend table, then one per tab) is its own block; within a table
    block, line 0 is a spacer row, line 1 the alignment row (":-:" cells),
    line 2 the real header, and everything after that is data."""
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in text.split("\n"):
        if line.strip() == "":
            if current:
                blocks.append(current)
                current = []
        else:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def clean(value: str | None) -> str:
    if value is None:
        return ""
    value = value.replace("\\!", "!").replace("\\-", "-")
    if value in ("—", "-", "–", ""):
        return ""
    return value.strip()


def to_int(value: str | None) -> int | None:
    value = clean(value)
    if not value:
        return None
    m = re.search(r"-?\d+", value)
    return int(m.group()) if m else None


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_int_or_null(value: int | None) -> str:
    return str(value) if value is not None else "NULL"


def sql_text_array_or_null(tags: list[str] | None) -> str:
    if not tags:
        return "NULL"
    return "ARRAY[" + ", ".join(sql_str(t) for t in tags) + "]::text[]"


def parse_records(text: str) -> list[dict]:
    blocks = split_blocks(text)
    # blocks[0] is the legend/metadata table ("Objetivo", "Convenções", ...).
    tabs = blocks[1 : 1 + len(CONFIGS)]
    if len(tabs) < len(CONFIGS):
        raise SystemExit(
            f"Expected {len(CONFIGS)} tab blocks after the legend table, found {len(tabs)}. "
            "The sheet's tab order/count may have changed — update CONFIGS to match."
        )

    records = []
    for (slug, title_col, age_min_col, age_max_col, tags_col), block in zip(CONFIGS, tabs):
        header = parse_row(block[2])
        for line in block[3:]:
            row = parse_row(line)
            if len(row) < len(header):
                row += [""] * (len(header) - len(row))
            rowmap = dict(zip(header, row))

            rid = clean(rowmap.get("ID"))
            if not rid or not ID_RE.match(rid):
                continue

            title = clean(rowmap.get(title_col, "")) or rid
            age_min = to_int(rowmap.get(age_min_col)) if age_min_col else None
            age_max = to_int(rowmap.get(age_max_col)) if age_max_col else None

            tags = None
            if tags_col:
                raw_tags = clean(rowmap.get(tags_col, ""))
                if raw_tags:
                    tags = [t.strip() for t in raw_tags.split(";") if t.strip()]

            content_parts = []
            for h in header:
                if h == "ID":
                    continue
                val = clean(rowmap.get(h, ""))
                if val:
                    content_parts.append(f"{h}: {val}")

            records.append(
                {
                    "id": rid,
                    "category": slug,
                    "title": title,
                    "age_min_months": age_min,
                    "age_max_months": age_max,
                    "tags": tags,
                    "content": "\n".join(content_parts),
                }
            )
    return records


def build_sql(records: list[dict]) -> str:
    values_sql = ",\n".join(
        "({id}, {category}, {title}, {age_min}, {age_max}, {tags}, {content})".format(
            id=sql_str(r["id"]),
            category=sql_str(r["category"]),
            title=sql_str(r["title"]),
            age_min=sql_int_or_null(r["age_min_months"]),
            age_max=sql_int_or_null(r["age_max_months"]),
            tags=sql_text_array_or_null(r["tags"]),
            content=sql_str(r["content"]),
        )
        for r in records
    )

    id_list_sql = ", ".join(sql_str(r["id"]) for r in records)

    return f"""-- Auto-generated by scripts/knowledge-base/sync_knowledge_base.py — do not
-- hand-edit; re-run the script against a fresh sheet export instead.
-- Upserts every row currently in the sheet (insert new, update changed —
-- matched by id, so the sheet's own "never reuse an ID" convention must
-- hold) and removes any row whose id is no longer present (i.e. deleted
-- from the sheet). The generated `search` tsvector column recomputes
-- itself automatically for every affected row.

insert into public.knowledge_chunks
  (id, category, title, age_min_months, age_max_months, tags, content)
values
{values_sql}
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  age_min_months = excluded.age_min_months,
  age_max_months = excluded.age_max_months,
  tags = excluded.tags,
  content = excluded.content;

delete from public.knowledge_chunks
where id not in ({id_list_sql});
"""


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <sheet-export.txt>", file=sys.stderr)
        raise SystemExit(2)

    with open(sys.argv[1], encoding="utf-8") as f:
        text = f.read()

    records = parse_records(text)
    if not records:
        raise SystemExit("Parsed zero records — check the input file looks like a sheet export.")

    counts = Counter(r["category"] for r in records)
    print(f"Parsed {len(records)} rows across {len(counts)} categories:", file=sys.stderr)
    for slug, n in sorted(counts.items()):
        print(f"  {slug}: {n}", file=sys.stderr)

    print(build_sql(records))


if __name__ == "__main__":
    main()
