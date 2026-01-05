# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["ThurayyaPharmacy.sln", "./"]
COPY ["src/ThurayyaPharmacy.API/ThurayyaPharmacy.API.csproj", "src/ThurayyaPharmacy.API/"]
COPY ["src/ThurayyaPharmacy.Application/ThurayyaPharmacy.Application.csproj", "src/ThurayyaPharmacy.Application/"]
COPY ["src/ThurayyaPharmacy.Domain/ThurayyaPharmacy.Domain.csproj", "src/ThurayyaPharmacy.Domain/"]
COPY ["src/ThurayyaPharmacy.Infrastructure/ThurayyaPharmacy.Infrastructure.csproj", "src/ThurayyaPharmacy.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "src/ThurayyaPharmacy.API/ThurayyaPharmacy.API.csproj"

# Copy everything else
COPY . .

# Build and publish
WORKDIR "/src/src/ThurayyaPharmacy.API"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ThurayyaPharmacy.API.dll"]
