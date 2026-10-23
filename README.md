# TechPoint POS

A lightweight point-of-sale (POS) web application for a small electronics and
accessories store. Cashiers can browse products, search and filter them, build
a cart, complete a sale, print a receipt, and view order history. Managers can
manage products and stock, view sales, register cashiers, and see an overview
dashboard.

**Phase 1** delivered the full frontend, with data simulated in the browser.
**Phase 2** connects it to the Flask + PostgreSQL backend
(`techpoint-backend`), so login, products, sales, cashiers and stock now come
from a real server and database. Phase 3 is still to come.

## What is a POS?

A **Point of Sale (POS)** is the place and moment where a customer pays for
goods, and the software that supports that transaction. A modern POS:

1. Displays products with prices and stock levels
2. Lets the cashier build a cart of items
3. Calculates totals
4. Records a completed sale and reduces stock in real time
5. Produces a receipt for the customer
6. Tracks every transaction for reporting
7. Manages stock: what's in, what's low, what's out
8. Distinguishes roles: cashiers sell, managers manage

## Project status

| Area | Status |
|------|--------|
| Product catalogue | Done (loaded after sign-in for the active branch) |
| Search & filtering | Done |
| Cart & sale calculation | Done |
| Sale completion | Done (sent to the backend, which checks stock and prices) |
| Authentication & roles | Done (tenant and branch scoped JWT requests) |
| Manager dashboard, sales, cashiers, products pages | Done (backend) |
| Receipt printing | In progress |
| Categories, order history, and stock ledger | Loaded from the backend database |
| Settings | In progress |
| Responsive polish | In progress |

## How it connects to the backend

All requests go through `src/api/client.js`. It adds the login token and
selected branch to requests and turns server errors into readable messages.

| Screen | What it does with the backend |
|--------|-------------------------------|
| Login | `POST /api/auth/login`; business sign-up creates the first manager and default branch; the token is saved in the browser and removed on logout |
| Product list and category filters | `GET /api/products` and `GET /api/categories`, loaded after authentication; managers can switch active branches |
| Checkout | `POST /api/sales` with product ids and quantities only. The server checks stock, uses its own prices, and the receipt is built from the server's reply. If the server refuses (for example, not enough stock), its message is shown and the cart stays as it is. |
| Order history | `GET /api/sales/mine` for a cashier; `GET /api/sales` for a manager |
| Stock ledger | `GET /api/stock/movements` |
| Manager: sales | `GET /api/sales` (all cashiers' sales) and `GET /api/reports/sales-by-cashier` |
| Manager: cashiers | `GET /api/auth/users` to list, `POST /api/auth/register` to add |
| Manager: dashboard | Sales, transaction, inventory, low-stock, and cashier totals from `GET /api/reports/dashboard` |
| Manager: locations | Cross-branch sales, margin, returns, current stock, and stockout comparison from `GET /api/reports/location-performance`; branches with coordinates appear on an interactive map |
| Manager: products | Loads products and categories from the database; add and edit through `POST` / `PUT /api/products`; stock +/- through `POST /api/stock/adjust` (recorded as stock movements) |

The backend stores prices in USD. The frontend converts them to KSh for display
at a fixed rate:

    export const USD_TO_KSH = 130;
    export const toKsh = (usd) => Math.round(usd * USD_TO_KSH);
    export const formatKsh = (ksh) => `KSh ${ksh.toLocaleString("en-KE")}`;

## Features

### Selling (Cashier)

- Browse the product catalogue loaded from the backend
- Search products by title, brand, or category
- Filter by category
- Add products to a cart, change quantities within stock limits, remove items
- Hold a sale temporarily and restore it later
- Choose a payment method and complete the sale
- View, print, and download the receipt
- View order history

### Managing (Manager)

- Dashboard with total sales, cashier count, product count, and low stock
- Sales made by every cashier, with a per-cashier summary
- Register cashiers and see the list of existing ones
- Add products, edit prices, and adjust stock

### Common

- Login screen with real accounts from the backend
- Role-based access: cashiers cannot see manager pages
- Loading, error, and empty states throughout
- Responsive layout for desktop, tablet, and mobile

## Technologies

| Layer | Technology |
|-------|------------|
| UI library | React 19 |
| Build tool | Vite 8 |
| State management | React useState and reducer functions |
| Routing | React Router |
| Styling | Plain CSS |
| Data and login | Flask REST API, JWT bearer tokens |
| Persistence in the browser | localStorage (saved login token); business records are loaded from the backend |
| Linting | ESLint |

## Installation

Requires Node.js 18+ and npm, **and the backend running** (see the
`techpoint-backend` README).

    npm install

## Running the app

1. Start the backend first (`python app.py` in `techpoint-backend`, default
   address `http://127.0.0.1:5000`).
2. Start the frontend:

       npm run dev

3. Open **http://localhost:5173**.

The backend only accepts requests from the address set in its `FRONTEND_ORIGIN`
setting (`http://localhost:5173`). If Vite starts on a different port because
5173 is already taken, every request fails with "Failed to fetch". Stop the
older copy of the app and start it again so it gets port 5173.

### Optional: change the backend address

The frontend calls `http://127.0.0.1:5000/api` by default. To use another
address, create a file named `.env` in this project's root:

    VITE_API_URL=http://127.0.0.1:5000/api

### Optional: change the map tile service

The location report uses OpenStreetMap tiles by default and includes map
attribution. Set `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` in `.env` if
you use a hosted map provider, for example:

    VITE_MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png?key=YOUR_KEY
    VITE_MAP_ATTRIBUTION=Map data © Example Provider

Use a browser-safe key restricted to this domain if the provider supports it.
OpenStreetMap's public tile service is best-effort and has no service-level
agreement; use a hosted provider for production SaaS traffic. See the
[OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
Branch coordinates can be entered in the manager header under **Branch location**.
Automatic address geocoding is not configured yet.

### Logging in

Use an account that exists in the backend database. A seeded database has
demo accounts (see `seed.py` in the backend), and a manager can register more
cashiers from the Cashiers page. The old Phase 1 demo logins no longer work.

## Other scripts

    npm run build
    npm run preview
    npm run lint

## Project structure

    pos-system/
    ├── public/
    ├── src/
    │   ├── api/              # client.js (token + errors), products.js, categories.js
    │   ├── cart/             # cart reducer
    │   ├── components/       # shared UI and manager pages
    │   ├── hooks/            # useDebounce
    │   ├── utils/            # shared helpers
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js

## Shared utilities

Modules under `src/utils/` are small helpers used across the app.

| Utility | Purpose |
|---------|---------|
| formatPrice.js | USD to KSh conversion, safe parsing, line totals |
| storage.js | Namespaced localStorage wrapper (never throws) |
| id.js | Unique IDs for orders, ledger entries, receipts |
| dates.js | Date / time / relative formatting for en-KE |
| receiptText.js | Build and download a plain-text receipt |
| lowStock.js | Classify products as in / low / out of stock |
| ledger.js | Construct ledger entries for sales, restocks, adjustments |
| reporting.js | Aggregate sales into dashboard and report summaries |
| filterProducts.js | Multi-field product search |

## Team members

| # | Name | Role |
|---|------|------|
| 1 | Sylvans | Scrum Master / API, Auth, Dashboard |
| 2 | Brian   | Product Catalogue & Stock Management |
| 3 | Mark    | Search & Filtering |
| 4 | Oprah   | Cart, Sale, Ledger, Receipt |
| 5 | Prince  | UI/UX, Navigation, Reports, Settings |
| 6 | Moses   | Testing, Documentation & Shared Utilities |

## Important decisions

- The backend is the source of truth for products, sales, users and stock; the
  frontend never calculates prices for a sale. The server does.
- Cart updates use a reducer function to keep cart operations consistent.
- Fixed USD to KSh rate (130): one constant keeps conversion in one place.
- Stock changes from the manager page go through `POST /api/stock/adjust`, so
  each change leaves a stock movement in the database.
- The login token and manager's active branch id are kept in localStorage and
  removed on logout. Protected API requests are scoped to the signed-in
  business; branch inventory and sales use the selected branch.

## Known issues

- The cashier's "recent sales" card only shows sales made in the current
  session.
- Products and cashiers cannot be deleted: the backend has no delete endpoint.
- Fixed FX rate: no live USD to KSh conversion.
- Opening the app in two browser tabs will not sync cart state.

## Scope

Included in Phase 2:

- Real login with roles (manager, cashier)
- Products, sales, cashiers and stock from the backend and PostgreSQL
- Server-side stock checks and prices at checkout

Not included yet:

- Deleting or deactivating products and users
- Real payment processing (M-Pesa / Stripe)
- Physical receipt printer integration
- Deployment

## Git workflow

- `main`: stable. Changes only through a pull request.
- Work on a feature branch and open a pull request. Merge the backend change
  first when a frontend change depends on a new endpoint.
- Never commit `.env` files.

| Member | Branch |
|--------|--------|
| 1 | feature/api-integration, feature/connect-backend |
| 2 | feature/product-catalogue |
| 3 | feature/search-filter |
| 4 | feature/cart |
| 5 | feature/ui-styling |
| 6 | feature/member6-utilities + feature/testing-documentation |

## License

Educational project: TechPoint POS assignment.
