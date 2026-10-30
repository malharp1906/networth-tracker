# Net Worth & Portfolio Tracker

An interactive web application for analyzing mutual fund portfolios, tracking net worth, visualizing asset allocation, and evaluating portfolio health.

## Features

- **Multi-Report Ingestion**: Drag-and-drop or batch import Excel (`.xlsx`, `.xls`) and `.csv` portfolio summary reports.
- **Dynamic Portfolio Analytics**:
  - Breakdown by asset class (Equity, Debt, Hybrid, etc.)
  - Category and regional allocation (Indian vs. International/Emerging Markets)
  - AMC concentration analysis
- **Visual Analytics**: Interactive allocation pie charts and bar distributions built with Recharts.
- **Portfolio Health & Alerts**: Automated checks for high concentration risk, cash drag, category skew, and negative returns.
- **Client & Profile Management**: Switch across multiple clients and applicants with persistent profile settings.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Data Visualization**: Recharts, Lucide React
- **File Parsing**: SheetJS (`xlsx`)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/networth-tracker.git
   cd networth-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Adding Portfolio Reports

You can upload portfolio summaries directly into the app using the web UI (drag-and-drop).

Alternatively, place `.xlsx` or `.csv` files into a `csv files/` directory in the project root. Running `npm run dev` or `npm run build` will automatically run the sync script to make them available in the dashboard.
