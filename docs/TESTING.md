# Testing

Use Node 22.12+ and npm ci. Run npm run check and npm run test:e2e. Playwright starts an isolated development server on port 3117; it refuses to reuse a running server. Stop a production server before browser tests because both modes use .next build artifacts.

Unit tests cover numerical invariants, actor shares, resources, shipment conservation, delayed policies, exact checkpoint prefixes, provider validation and budgets, portable replay validation, compact round trips and key-free API execution. Explainer charts are checked against fresh engine results.

Browser tests cover the globe, country inspection, playback, modal keyboard behavior, baseline lifecycle, local branching, shipping replay import/export and policy comparisons. The visual guide is tested offline, at four widths, with recorded weeks and both policy options.

There are no mocked database boundaries or persistence tests: those features have been removed. Historical implementation/review reports describe earlier versions, not the current architecture.
