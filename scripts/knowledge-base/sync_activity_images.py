#!/usr/bin/env python3
"""Regenerate the SQL to backfill public.knowledge_chunks.image_url from
the Google Drive "banco de imagens" folder the user maintains by hand.

WHY THIS EXISTS
The user is progressively photographing/illustrating brincadeiras and
materiais and dropping images into a Drive folder, one PNG per row, named
after the row's own id (case-insensitive: "mat-031.png" -> "MAT-031").
This is a small, growing, manually-curated set (17 of ~149 rows as of
2026-09-25) — not the kind of thing that justifies automating the Drive
side end to end. This script is just the repeatable *last step*: turn a
filename -> Drive fileId listing into the UPDATE statements.

WHY DRIVE LINKS AND NOT SUPABASE STORAGE
Architecturally, Supabase Storage would be the consistent destination for
binary assets in this project. It isn't used here because uploading object
bytes to Storage needs its own REST API call, and this environment's
outbound network policy blocks direct HTTPS calls to *.supabase.co (only
the Supabase MCP tools, which are Postgres-only, get through) — there is
no MCP tool that exposes Storage's upload endpoint. Google Drive IS
reachable via its own MCP tools, so for now `image_url` stores a Drive
"thumbnail" link, which works for any file shared as "Anyone with the
link" (the folder already is). If Storage upload ever becomes available
in a session, this is a one-column swap: rerun a real migration that
downloads each file and re-uploads it to Storage, then repoint
`image_url` at the new public Storage URL — nothing else in the app reads
Drive/Storage-specific shape, it just consumes whatever URL is stored.

HOW TO RUN A SYNC (for a future Claude Code session, or a human with MCP
access to the Google_Drive and Supabase tools)
  1. List the two source folders with the Google_Drive MCP tool
     `search_files`, one call per folder:
       parentId = '1Q2lEGkmh3HtEy9OHDK9vj4HKGdIxRSLE'   (materiais)
       parentId = '19teP2d2p2BK45vq7Sie66CN72kYY9Qyc'   (brincadeiras)
     Paginate with the returned page token until a call comes back empty.
  2. For every file that isn't already synced (skip ones already handled
     in a previous run, tracked in git history / the SEEN constant below
     if you want a hard skip-list), note its filename and Drive fileId.
  3. Add each "filename,fileId" pair as a line to a local text file, e.g.
     /tmp/new_images.csv, then run:
       python3 scripts/knowledge-base/sync_activity_images.py /tmp/new_images.csv > /tmp/image_sync.sql
  4. Apply /tmp/image_sync.sql via the Supabase MCP tool `execute_sql`
     (project_id "izattwaiqjzhydzhxlns"). It's a handful of single-row
     UPDATEs keyed by id — safe to re-run, and a no-op for any id that
     isn't a real knowledge_chunks row (the WHERE clause just won't match).
  5. Sanity-check row counts: `select count(*) from knowledge_chunks where
     image_url is not null` should grow by exactly the number of new
     files synced.

WHAT IT DOES NOT HANDLE
  - Verifying the Drive file is actually shared as "Anyone with the link"
    (reader or above). If a newly added image isn't shared that way, the
    generated URL will 403 in the browser even though the SQL applies
    cleanly. Spot-check one new image after a sync.
  - Picking the fileId out of Drive search results itself — this script
    only turns an already-gathered filename/fileId list into SQL, on
    purpose, so it has no Google API dependency and needs no credentials.
"""

import csv
import re
import sys

FILENAME_RE = re.compile(r"^([a-zA-Z]+-\d+)\.(png|jpg|jpeg)$")


def build_updates(rows: list[tuple[str, str]]) -> list[str]:
    statements = []
    for filename, file_id in rows:
        filename = filename.strip()
        file_id = file_id.strip()
        if not filename or not file_id:
            continue
        match = FILENAME_RE.match(filename)
        if not match:
            print(f"-- skipping unrecognized filename: {filename}", file=sys.stderr)
            continue
        chunk_id = match.group(1).upper()
        url = f"https://drive.google.com/thumbnail?id={file_id}&sz=w1000"
        statements.append(
            f"update public.knowledge_chunks set image_url = '{url}' "
            f"where id = '{chunk_id}';"
        )
    return statements


def main() -> None:
    if len(sys.argv) != 2:
        print(
            "usage: sync_activity_images.py <filename,fileId CSV, no header>",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(sys.argv[1], newline="") as handle:
        rows = [tuple(row[:2]) for row in csv.reader(handle) if row]

    statements = build_updates(rows)
    print(f"-- {len(statements)} row(s) to update", file=sys.stderr)
    for statement in statements:
        print(statement)


if __name__ == "__main__":
    main()
