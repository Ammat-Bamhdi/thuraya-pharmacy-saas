# 💊 Thuraya Pharmacy SaaS

A modern, multi-tenant pharmacy management system built with **Angular 21** and the latest web technologies.

## ✨ Features

- 🏢 **Multi-tenant Architecture** - Support multiple pharmacy chains
- 🌳 **Branch Network Management** - Hierarchical branch structure
- 📦 **Inventory Management** - Branch-specific product catalog
- 🛒 **Point of Sale (POS)** - Fast checkout system
- 📊 **Analytics Dashboard** - Real-time insights
- 👥 **Team Management** - Role-based access control
- 💰 **Finance & Procurement** - Purchase orders and billing
- 🌍 **Bilingual Support** - English and Arabic

## 🚀 Built With Angular 21

This application leverages the latest Angular 21 features:

- ✅ **Standalone Components** - No NgModules needed
- ✅ **Signals API** - Reactive state management
- ✅ **input/output Signals** - Type-safe component APIs
- ✅ **viewChild Queries** - Modern DOM access
- ✅ **Functional Interceptors** - HTTP request handling
- ✅ **inject() Function** - Dependency injection
- ✅ **Strict TypeScript** - Enhanced type safety
- ✅ **OnPush Change Detection** - Optimized performance

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- Modern web browser

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
ng serve --open
```

The app will be available at `http://localhost:3000`

### 3. Build for Production
```bash
ng build
```

## 📁 Project Structure

```
src/
├── app/
│   ├── app.component.ts          # Root application component
│   ├── app.config.ts             # Application configuration
│   │
│   ├── core/                     # 🔧 Core Module (Singleton)
│   │   ├── services/
│   │   │   ├── store.service.ts      # Global state management
│   │   │   ├── http.service.ts       # HTTP client wrapper
│   │   │   └── analytics.service.ts  # Analytics tracking
│   │   ├── interceptors/
│   │   │   └── http.interceptor.ts   # Auth & caching interceptors
│   │   ├── models/                   # Domain models & interfaces
│   │   │   ├── branch.model.ts
│   │   │   ├── product.model.ts
│   │   │   ├── procurement.model.ts
│   │   │   └── ...
│   │   └── index.ts              # Barrel export
│   │
│   ├── shared/                   # 🎨 Shared Module (Reusable)
│   │   ├── components/
│   │   │   ├── icons/            # SVG icon library
│   │   │   ├── chart/            # D3.js charts
│   │   │   └── modern-search/    # Search component
│   │   ├── directives/
│   │   │   └── common.directives.ts
│   │   ├── utils/
│   │   │   └── signal-helpers.ts
│   │   └── index.ts
│   │
│   ├── layout/                   # 🏠 Layout Module
│   │   ├── sidebar/
│   │   │   ├── sidebar.component.ts
│   │   │   └── sidebar.component.html
│   │   └── index.ts
│   │
│   ├── features/                 # 📦 Feature Modules
│   │   ├── dashboard/
│   │   │   ├── dashboard.component.ts
│   │   │   └── dashboard.component.html
│   │   ├── procurement/
│   │   │   ├── procurement.component.ts
│   │   │   ├── procurement.component.html
│   │   │   └── procurement-api.service.ts
│   │   ├── sales/
│   │   ├── inventory/
│   │   ├── finance/
│   │   ├── pos/
│   │   ├── users/
│   │   ├── settings/
│   │   ├── branch-network/
│   │   ├── onboarding/
│   │   └── index.ts
│   │
│   └── constants/                # 🎯 Global Constants
│       ├── countries.const.ts
│       ├── currencies.const.ts
│       ├── locations.const.ts
│       ├── onboarding.const.ts
│       └── index.ts
│
├── environments/                 # ⚙️ Environment configs
│   ├── environment.ts
│   └── environment.prod.ts
│
├── index.html                    # HTML entry point
└── index.tsx                     # Angular bootstrap
```

## 🏗️ Architecture

### Path Aliases

Clean imports using TypeScript path aliases:

```typescript
// Instead of relative paths
import { StoreService } from '../../../core/services/store.service';

// Use clean aliases
import { StoreService } from '@core/services/store.service';
```

Available aliases:
- `@core/*` - Core services, models, interceptors
- `@shared/*` - Shared components, directives, utils
- `@layout/*` - Layout components
- `@features/*` - Feature components
- `@constants/*` - Global constants

### Module Structure

| Module | Purpose |
|--------|---------|
| **Core** | Singleton services, HTTP interceptors, domain models |
| **Shared** | Reusable UI components, directives, utilities |
| **Layout** | Application shell (sidebar, header) |
| **Features** | Business feature modules (self-contained) |
| **Constants** | Static data (countries, currencies, i18n) |

## 🎨 Tech Stack

- **Framework**: Angular 21
- **Language**: TypeScript 5.8
- **Styling**: TailwindCSS
- **State**: Signals API
- **HTTP**: Angular HTTP Client with Fetch API
- **Build**: Angular CLI with Vite
- **Charts**: D3.js

## 🌟 Key Components

### Modern Search Component
```typescript
<app-modern-search
  placeholder="Search products..."
  [fullWidth]="true"
  (queryChange)="onSearch($event)"
/>
```

### Icon Component
```typescript
<app-icon name="search" [size]="20" />
```

### Common Directives
- `appClickOutside` - Detect outside clicks
- `appAutoFocus` - Auto-focus elements
- `appLoading` - Loading states
- `appCopyToClipboard` - Copy functionality

## 🤝 Contributing

Contributions are welcome! Please ensure all new code follows Angular 21 best practices:

1. Use standalone components
2. Use signals for state management
3. Use `input()` and `output()` instead of decorators
4. Use `inject()` function for DI
5. Use OnPush change detection
6. Place new code in the appropriate module (core/shared/features)

## 📄 License

Private - © 2025 Thuraya Systems

---

**Built with ❤️ using Angular 21**
