# NHS Medicines Data Extraction Tool

Built for the Sheer Health technical assessment by Emma Ijiogbe.

## Overview

This tool automates extraction of medicine information from the NHS "Medicines A to Z" site into a structured JSON bundle.

The goal was to treat this like a small ingestion pipeline: reliably crawl the NHS index, follow the key topic links for each medicine (About, Who can and cannot take it, How and when to take it, Side effects), and normalize the results into a JSON shape that other services can use.

### Design Priorities

- **Reliability under a timebox** – retries, basic stats, and simple validation
- **Maintainability via POM** – Page Object Model isolates NHS-specific selectors
- **Useful JSON output** – sections keyed by NHS topic titles, plus URLs and timestamps

## Key Features

- **Deep content extraction**: Navigates to individual topic pages for comprehensive data
- **Concurrent processing**: 5 medicines in parallel with controlled rate limiting
- **Retry logic**: Automatic retries for transient failures
- **Page Object Model**: Clean separation between page structure and scraping logic
- **TypeScript**: Full type safety and clear interfaces
- **Structured logging**: Progress tracking and debugging

## Installation & Usage

### Quick Start

1. **Install dependencies**

   ```bash
   npm install
   npx playwright install
   npm run build
   ```

2. **Run the scraper**

   ```bash
   npm start
   ```

3. **Check the output**
   - `output/medicines.json` – All extracted medicines
   - `output/medicines-summary.json` – Names only
   - `output/extraction-report.md` – Extraction stats

### Configuration

Inside `src/index.ts` (lines 131–132):

- `LIMIT_MEDICINES`: number for testing (e.g., 5) or `null` for full extraction
- `maxConcurrency`: parallel medicine pages (default: 5)

(Runtime flags weren’t implemented to stay within the 2–4 hour scope.)

Example test run:

```
Extraction Summary:
   Total Medicines: 5
   Success Rate: 100.00%
   Time Taken: 10.21s
```

## Output Format

### Sample Output

```json
{
  "Aciclovir": {
    "name": "Aciclovir",
    "url": "https://www.nhs.uk/medicines/aciclovir/",
    "scrapedAt": "2024-01-15T10:30:45.123Z",
    "description": "Aciclovir (or acyclovir) is an antiviral medicine...",
    "brandNames": ["Zovirax"],
    "sections": {
      "About aciclovir": "Aciclovir is an antiviral medicine that helps the body fight infection...",
      "Key facts": [
        "Aciclovir treatment is usually started within 72 hours...",
        "Common side effects include headaches..."
      ],
      "Who can and cannot take aciclovir": "Most adults and children can take aciclovir...",
      "How and when to take aciclovir": "The dose depends on what you're taking it for...",
      "Side effects of aciclovir": "Like all medicines, aciclovir can cause side effects..."
    },
    "relatedConditions": ["Cold sores", "Shingles", "Chickenpox"]
  }
  "...additional medicines": {},
  "__meta": {
    "scrapedAt": "2024-01-26T15:43:28.030Z",
    "totalMedicines": 291,
    "successfulMedicines": 291,
    "failedMedicines": []
  }
}
```

## Architecture

### Page Object Model Structure

```
src/
├── index.ts
├── types.ts
├── scraper/
│   └── MedicineScraper.ts    # Main scraping logic with concurrency control
├── pages/
│   ├── BasePage.ts           # Shared page functionality
│   ├── MedicinesIndexPage.ts # Handles the A-Z index
│   └── MedicineDetailPage.ts # Extracts data from individual medicine pages
└── utils/
    └── logger.ts             # Logging utilities
```

**Why POM?**
NHS pages change often. Having all selectors in one place isolates breakage and speeds up maintenance.

### How It Works

1. **Index Scraping**: `MedicinesIndexPage` extracts all medicine links from the A-Z index
2. **Parallel Processing**: `MedicineScraper` processes medicines concurrently using p-limit
3. **Deep Navigation**: For each medicine, `MedicineDetailPage`:
   - Extract description and brand names
   - Find and follow topic links
   - Scrape structured content per topic section
4. **Output Generation**: Results saved as JSON with metadata

## Design Decisions

### Why Deep Content Extraction?

The requirement was to extract "details about that medication," not just summaries. Topic pages contain the real informational depth, so the scraper follows those links to create a more complete dataset.

### Data Structure Choices

- **NHS section titles preserved verbatim**
- **Related conditions elevated to a top-level field**
- **Timestamp added per medicine**
- **Lists preserved where NHS uses them**

### Brand Name Extraction

NHS brand names appear in two places:

**1. The page title**
Example: `Paracetamol for children (Calpol)`

**2. The content body**
Example: `Other brand names: Panadol`

Title-based extraction is fast and reliable, so it's included by default.

A slower, more exhaustive implementation was tested (scanning the page for "Brand names:" patterns), but it added significant latency across ~300 medicines. To keep extraction time within the 2–4 hour limit, only title-based extraction is used here.

The architecture supports adding deeper brand extraction later.

### Page Structure Variations

NHS uses two layouts:

**1. Hub-style** ("Paracetamol for adults")

- The main page is just a summary; all real medical content is split across topic subpages.
- -> Scraper extracts structured sections from each topic page.

**2. Single-page** ("Paracetamol for children")

- All medical information lives directly in the main content body, with no topic subpages.
- -> Scraper captures only the top-level description, and sections remains empty ({}).

Segmenting a single-page template into artificial sections would require custom natural-language parsing and rules, which was intentionally out of scope for this timebox.

### Topic Section Prioritization

NHS medicine pages can include seven or more topic sections.
This scraper focuses on the four core sections that appear consistently across medicines and carry the highest informational value:

- About
- Who can and cannot take it
- How and when to take it
- Side effects

These sections form the backbone of medication guidance and are the most useful for downstream ingestion.
Additional sections (pregnancy guidance, drug interactions, FAQs) can be added by expanding the priority list in MedicineDetailPage, and the architecture is designed to support that with minimal friction.

### Review Dates

NHS pages show review metadata such as:

```
Page last reviewed: 20 October 2022
Next review due: 20 October 2025
```

These are not extracted because:

- Topic pages often have different review dates per section
- Review dates live in footer regions requiring extra DOM traversal
- The assessment's primary goal was medical content ingestion
- Extracting review dates would add additional page queries and slow down the scraper

The architecture can add per-section freshness tracking later if needed.

### Performance & Ethics

- **Rate limiting**: 5 concurrent pages to avoid stressing NHS servers
- **No spoofing**: Public data only, no anti-detection tricks
- **Retry logic**: Graceful recovery for transient failures

## Performance Characteristics

- Handles ~300 medicines with controlled concurrency
- Reuses browser contexts for efficiency
- Each medicine may open multiple topic pages

### Error Handling

- Try/catch at all layers
- Clear logging with context
- Failed items tracked with reasons
- Validation checks to ensure extract quality

### Testing

The architecture is test-friendly:

- Unit tests run without launching a browser
- Mocked page objects isolate logic
- Validation tests check key constraints

Run tests:

```bash
npm test
```

## Notes for Reviewers

**Total time spent**: ~3.5 hours

- Architecture: ~30 minutes
- Core scraping: ~90 minutes
- Deep extraction: ~60 minutes
- Documentation + cleanup: ~30 minutes

**Prioritization under time constraints**:

- ✔️ Robust data extraction
- ✔️ Clean architecture
- ✔️ Good documentation
- ❌ Full test suite (supported structurally)
- ❌ CLI flags

## Future Enhancements

1. **Replace scraping with official NHS API ingestion** (if available)
2. **Request interception** to block images/styles and speed up pages
3. **CLI interface** with runtime flags (--limit, --concurrency, --output, --headless)
4. **Incremental re-scrape mode**
5. **robots.txt & ToS compliance automation**
6. **CI pipeline** to run scraper on schedules
7. **Content normalization pipeline** via post-processing layer (e.g. rule-based or LLM-assisted)

## Requirements

- Node.js 20+
- npm or yarn
- ~500MB disk for Playwright browsers

## License

This is a technical assessment project. Please do not use in production without NHS authorization.
