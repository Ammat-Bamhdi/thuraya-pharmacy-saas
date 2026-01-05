# Thurayya Pharmacy Backend - Azure Deployment

## Prerequisites
- Azure CLI installed (`az --version`)
- Azure subscription
- Docker (optional, for container deployment)

## Option 1: Deploy to Azure App Service (Recommended)

### Step 1: Login to Azure
```bash
az login
```

### Step 2: Create Resource Group
```bash
az group create --name thuraya-pharmacy-rg --location eastus
```

### Step 3: Create Azure SQL Database
```bash
# Create SQL Server
az sql server create \
  --name thuraya-pharmacy-sql \
  --resource-group thuraya-pharmacy-rg \
  --location eastus \
  --admin-user sqladmin \
  --admin-password "YourStrongPassword123!"

# Create Database
az sql db create \
  --resource-group thuraya-pharmacy-rg \
  --server thuraya-pharmacy-sql \
  --name ThurayyaPharmacy \
  --service-objective S0

# Allow Azure services
az sql server firewall-rule create \
  --resource-group thuraya-pharmacy-rg \
  --server thuraya-pharmacy-sql \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Step 4: Create App Service Plan
```bash
az appservice plan create \
  --name thuraya-pharmacy-plan \
  --resource-group thuraya-pharmacy-rg \
  --sku B1 \
  --is-linux
```

### Step 5: Create Web App
```bash
az webapp create \
  --name thuraya-pharmacy-api \
  --resource-group thuraya-pharmacy-rg \
  --plan thuraya-pharmacy-plan \
  --runtime "DOTNETCORE:10.0"
```

### Step 6: Configure App Settings
```bash
# Set connection string
az webapp config connection-string set \
  --name thuraya-pharmacy-api \
  --resource-group thuraya-pharmacy-rg \
  --settings DefaultConnection="Server=tcp:thuraya-pharmacy-sql.database.windows.net,1433;Database=ThurayyaPharmacy;User ID=sqladmin;Password=YourStrongPassword123!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;" \
  --connection-string-type SQLAzure

# Set app settings (secrets)
az webapp config appsettings set \
  --name thuraya-pharmacy-api \
  --resource-group thuraya-pharmacy-rg \
  --settings \
    Jwt__Key="YourProductionJwtSecretKeyAtLeast32Characters!" \
    Jwt__Issuer="ThurayyaPharmacy" \
    Jwt__Audience="ThurayyaPharmacyApp" \
    Google__ClientId="826988304508-nb0662tfl3uo5b0b87tmvkvmsbtn6g44.apps.googleusercontent.com" \
    Google__ClientSecret="YOUR_GOOGLE_SECRET" \
    ASPNETCORE_ENVIRONMENT="Production"
```

### Step 7: Deploy the App
```bash
# From backend folder
cd backend

# Deploy using ZIP deploy
dotnet publish src/ThurayyaPharmacy.API -c Release -o ./publish
cd publish
zip -r ../deploy.zip .
cd ..

az webapp deployment source config-zip \
  --name thuraya-pharmacy-api \
  --resource-group thuraya-pharmacy-rg \
  --src deploy.zip
```

## Option 2: Deploy via GitHub Actions (CI/CD)

Create `.github/workflows/azure-deploy.yml` in your repo root.

## Option 3: Deploy with Docker

### Build and push to Azure Container Registry
```bash
# Create ACR
az acr create \
  --name thurayyapharmacyacr \
  --resource-group thuraya-pharmacy-rg \
  --sku Basic \
  --admin-enabled true

# Login to ACR
az acr login --name thurayyapharmacyacr

# Build and push
cd backend
docker build -t thurayyapharmacyacr.azurecr.io/api:latest -f src/ThurayyaPharmacy.API/Dockerfile .
docker push thurayyapharmacyacr.azurecr.io/api:latest

# Deploy to App Service with container
az webapp create \
  --name thuraya-pharmacy-api \
  --resource-group thuraya-pharmacy-rg \
  --plan thuraya-pharmacy-plan \
  --deployment-container-image-name thurayyapharmacyacr.azurecr.io/api:latest
```

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `ConnectionStrings__DefaultConnection` | Azure SQL connection string |
| `Jwt__Key` | JWT signing key (min 32 chars) |
| `Jwt__Issuer` | JWT issuer (ThurayyaPharmacy) |
| `Jwt__Audience` | JWT audience (ThurayyaPharmacyApp) |
| `Google__ClientId` | Google OAuth Client ID |
| `Google__ClientSecret` | Google OAuth Client Secret |

## Post-Deployment

1. Update Google OAuth redirect URIs:
   - Add `https://thuraya-pharmacy-api.azurewebsites.net/api/auth/google/callback`

2. Update frontend environment:
   - Change `apiUrl` to `https://thuraya-pharmacy-api.azurewebsites.net/api`

3. Run EF Core migrations:
   ```bash
   az webapp ssh --name thuraya-pharmacy-api --resource-group thuraya-pharmacy-rg
   # Or apply migrations before deployment
   ```

## Estimated Monthly Costs

| Resource | SKU | Cost |
|----------|-----|------|
| App Service Plan | B1 | ~$13/mo |
| Azure SQL | S0 | ~$15/mo |
| **Total** | | **~$28/mo** |

For production, consider:
- App Service: P1v2 (~$80/mo) for better performance
- Azure SQL: S1/S2 for more DTUs
