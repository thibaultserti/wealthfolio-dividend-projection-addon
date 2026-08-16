# Wealthfolio Addons (Monorepo)

Monorepo containing extensions and addons for [Wealthfolio](https://wealthfolio.app).

## 📦 Packages

| Addon | Description | Path |
| :--- | :--- | :--- |
| **[Dividends Projection](packages/dividends-projection-addon)** | Visualize and project future dividend income, dividend yield, yield on cost, and historical dividend growth across portfolios. | `packages/dividends-projection-addon` |
| **[Portfolio Metrics](packages/portfolio-metrics-addon)** | Analyze and compare fundamental stock metrics (Margins, ROIC/ROCE/ROE, Debt/EBITDA, Interest Coverage, Goodwill, P/E, P/FCF, Note Q) across portfolios and accounts. | `packages/portfolio-metrics-addon` |

---

## 🚀 Quick Start & Scripts

### Installation
```bash
pnpm install
```

### Development
```bash
# Run all addons in watch mode
pnpm dev

# Or run a specific addon:
pnpm dev:dividends
pnpm dev:metrics
```

### Build & Typecheck
```bash
# Build all addons
pnpm build

# Type check all addons
pnpm type-check
pnpm lint
```

### Tests
```bash
# Run vitest across all addons
pnpm test

# Run tests for a specific addon
pnpm test:dividends
pnpm test:metrics
```

### Package (.zip for Wealthfolio)
```bash
# Package all addons into dist/*.zip
pnpm package

# Or package individual addons:
pnpm package:dividends
pnpm package:metrics
```

---

## 📄 License
MIT © [thibaultserti](https://github.com/thibaultserti)
