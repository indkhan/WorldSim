# Data and provenance

## Bundled country snapshot

`src/data/countries.json` supplies country/territory name, code, population, region/subregion and representative latitude/longitude. It is bundled so the project works offline after dependencies are installed.

The current snapshot is suitable for a visual pet-project simulation but should not be presented as a current authoritative demographic release. Before publishing research claims, replace it with a versioned ingestion pipeline from sources such as the World Bank and UN, record observation year per field, and preserve raw-source provenance.

## Synthetic fields

Income mix, urbanity, sector assignment, resilience, adaptive capacity, import/export exposure, energy exposure and international link strength are synthetic/proxy variables derived from the run seed and country identifiers. They are intentionally deterministic so scenarios are reproducible.

The UI and documentation must keep these distinct from measured statistics.

## Recommended production data upgrades

1. World Bank population and development indicators with observation year.
2. UN urbanization and demographic distributions.
3. UN Comtrade / OECD / World Input-Output trade relationships.
4. IEA or other licensed/public energy dependencies where permitted.
5. Country-level sector employment/output shares.
6. Explicit missing-data flags rather than silent imputation.

Add data adapters behind stable domain interfaces rather than importing provider-specific schemas into the simulation engine.
