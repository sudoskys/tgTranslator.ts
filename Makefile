.PHONY: adr-index adr-lint

adr-index:
	python3 scripts/adr-index.py --write

adr-lint:
	python3 scripts/adr-lint.py
