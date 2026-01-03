# Thurayya Pharmacy API

Multi-tenant pharmacy management system backend built with .NET 10.

## Architecture

Clean Architecture with 4 layers:

```
├── ThurayyaPharmacy.API          # Web API controllers, JWT auth, Swagger
├── ThurayyaPharmacy.Application  # DTOs, validation, business logic
├── ThurayyaPharmacy.Infrastructure # EF Core, database context
└── ThurayyaPharmacy.Domain       # Entities, enums, base classes
```

## Features

- **Multi-tenancy**: Data isolation per tenant
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Role-based Authorization**: SuperAdmin, BranchAdmin, SectionAdmin
- **Soft Delete**: Records preserved with IsDeleted flag
- **Audit Fields**: CreatedAt, CreatedBy, ModifiedAt, ModifiedBy

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new tenant & admin
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token

### Branches
- `GET /api/branches` - List all branches
- `GET /api/branches/{id}` - Get branch by ID
- `POST /api/branches` - Create branch
- `PUT /api/branches/{id}` - Update branch
- `DELETE /api/branches/{id}` - Soft delete branch

### Products
- `GET /api/products` - List products (optional ?branchId=)
- `GET /api/products/{id}` - Get product by ID
- `GET /api/products/low-stock` - Get low stock alerts
- `POST /api/products` - Create product
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Soft delete product

### Suppliers
- `GET /api/suppliers` - List suppliers
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/{id}` - Update supplier
- `DELETE /api/suppliers/{id}` - Soft delete supplier

### Purchase Orders
- `GET /api/purchase-orders` - List orders
- `POST /api/purchase-orders` - Create order
- `POST /api/purchase-orders/{id}/approve` - Approve order
- `POST /api/purchase-orders/{id}/receive` - Receive & update stock

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/search?q=` - Search customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/{id}` - Update customer

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice (deducts stock)
- `PUT /api/invoices/{id}` - Update status

## Getting Started

### Prerequisites
- .NET 10 SDK
- SQL Server (LocalDB included)

### Run the API

```bash
cd backend
dotnet run --project src/ThurayyaPharmacy.API
```

API will be available at:
- **Swagger UI**: http://localhost:5000
- **API**: http://localhost:5000/api

### Configuration

Edit `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Your SQL Server connection string"
  },
  "Jwt": {
    "Key": "Your secret key (min 32 chars)",
    "Issuer": "ThurayyaPharmacy",
    "Audience": "ThurayyaPharmacyApp"
  }
}
```

## Database

The API uses Entity Framework Core with SQL Server. On first run in development mode, the database is automatically created.

To create migrations:
```bash
dotnet ef migrations add InitialCreate --project src/ThurayyaPharmacy.Infrastructure --startup-project src/ThurayyaPharmacy.API
```

## Tech Stack

- **.NET 10** - Latest LTS framework
- **Entity Framework Core 10** - ORM with SQL Server
- **JWT Bearer Auth** - Token-based authentication
- **BCrypt** - Password hashing
- **Swagger/OpenAPI** - API documentation
- **FluentValidation** - Input validation

