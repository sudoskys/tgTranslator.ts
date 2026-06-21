#!/usr/bin/env python3
"""Validate ADR frontmatter and cross-references.

Cross-machine portable: requires only Python 3 and PyYAML. Auto-detects
`docs/adr/` or `docs/decisions/` under the repo root.

Checks:
  1. Frontmatter present and parseable
  2. `superseded_by: Y`  →  Y's frontmatter.supersedes must include this id
  3. `status: Superseded` →  `superseded_by` must be non-null
  4. `supersedes: [X]`   →  X's frontmatter.status must be Superseded
  5. `prds: [slug]`      →  docs/prd/<slug>.md must exist (skipped if no docs/prd/)

Exit code: 0 on success, 1 on violations.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
from typing import Any

try:
    import yaml
except ImportError:
    sys.exit("error: PyYAML not installed. Run: pip install pyyaml")


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---", re.DOTALL)


def repo_root() -> pathlib.Path:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        return pathlib.Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return pathlib.Path.cwd()


def adr_dir(root: pathlib.Path) -> pathlib.Path:
    for candidate in ("docs/adr", "docs/decisions"):
        if (root / candidate).is_dir():
            return root / candidate
    sys.exit(f"error: no docs/adr or docs/decisions directory under {root}")


def parse_frontmatter(path: pathlib.Path) -> dict[str, Any] | None:
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)
    if not match:
        return None
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def iter_adr_files(d: pathlib.Path):
    for f in sorted(d.glob("[0-9]*-*.md")):
        if f.is_file():
            yield f
    for sub in sorted(d.glob("[0-9]*-*")):
        readme = sub / "README.md"
        if sub.is_dir() and readme.is_file():
            yield readme


def normalize_id(value: Any) -> str:
    """Return a canonical ADR id string, e.g. 'ADR-146'. Accepts int or str."""
    if value is None:
        return ""
    if isinstance(value, int):
        return f"ADR-{value}"
    s = str(value).strip()
    if not s:
        return ""
    return s if s.startswith("ADR-") else f"ADR-{s}"


def main() -> int:
    root = repo_root()
    d = adr_dir(root)
    prd_dir = root / "docs" / "prd"
    prd_corpus = prd_dir.is_dir()

    errors: list[str] = []

    def fail(path: pathlib.Path, msg: str) -> None:
        errors.append(f"FAIL [{path.relative_to(root)}]: {msg}")

    records: dict[str, dict[str, Any]] = {}  # id -> parsed frontmatter + path
    for path in iter_adr_files(d):
        fm = parse_frontmatter(path)
        if fm is None:
            fail(path, "missing or unparseable frontmatter")
            continue
        adr_id = normalize_id(fm.get("id", ""))
        if not adr_id:
            fail(path, "frontmatter.id missing")
            continue
        status = str(fm.get("status", "")).strip()
        superseded_by = normalize_id(fm.get("superseded_by"))
        supersedes = {normalize_id(v) for v in (fm.get("supersedes") or []) if normalize_id(v)}

        # Rule 3: status=Superseded requires superseded_by
        if status == "Superseded" and not superseded_by:
            fail(path, "status=Superseded but superseded_by is empty")

        # Rule 5: prds slug(s) must resolve to docs/prd/<slug>.md when a PRD corpus exists
        prds = fm.get("prds")
        if prds:
            if not isinstance(prds, list):
                fail(path, f"frontmatter.prds must be a list, got {type(prds).__name__}")
            elif not prd_corpus:
                fail(path, "frontmatter.prds is set but docs/prd/ does not exist in this repo")
            else:
                for slug in prds:
                    if not isinstance(slug, str) or not slug:
                        fail(path, f"frontmatter.prds contains non-string or empty entry: {slug!r}")
                        continue
                    if not (prd_dir / f"{slug}.md").exists():
                        fail(path, f"prds references {slug!r} but docs/prd/{slug}.md does not exist")

        records[adr_id] = {
            "path": path,
            "status": status,
            "superseded_by": superseded_by,
            "supersedes": supersedes,
        }

    # Cross-reference pass
    for adr_id, rec in records.items():
        # Rule 2: superseded_by -> other.supersedes contains me
        new_id = rec["superseded_by"]
        if new_id:
            other = records.get(new_id)
            if other is None:
                fail(rec["path"], f"superseded_by={new_id} but no such ADR found")
            elif adr_id not in other["supersedes"]:
                fail(
                    rec["path"],
                    f"superseded_by={new_id}, but {new_id}.supersedes does not include {adr_id}",
                )

        # Rule 4: supersedes: [X] -> X.status must be Superseded
        for old_id in rec["supersedes"]:
            other = records.get(old_id)
            if other is None:
                fail(rec["path"], f"supersedes {old_id} but no such ADR found")
            elif other["status"] != "Superseded":
                fail(
                    rec["path"],
                    f"supersedes {old_id}, but {old_id}.status={other['status']!r} (expected Superseded)",
                )

    if errors:
        print("\n".join(errors), file=sys.stderr)
        print(f"adr-lint: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"adr-lint: OK ({len(records)} ADRs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
