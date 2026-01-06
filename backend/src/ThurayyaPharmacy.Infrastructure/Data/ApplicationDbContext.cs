using Microsoft.EntityFrameworkCore;
using ThurayyaPharmacy.Domain.Entities;

namespace ThurayyaPharmacy.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    private readonly ThurayyaPharmacy.Application.Interfaces.ICurrentTenantService _currentTenantService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ThurayyaPharmacy.Application.Interfaces.ICurrentTenantService currentTenantService) : base(options)
    {
        _currentTenantService = currentTenantService;
    }

    // Core
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    
    // Inventory
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductBatch> ProductBatches => Set<ProductBatch>();
    
    // Procurement
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<PurchaseBill> PurchaseBills => Set<PurchaseBill>();
    public DbSet<PaymentRecord> PaymentRecords => Set<PaymentRecord>();
    
    // Sales
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    
    // Finance
    public DbSet<Expense> Expenses => Set<Expense>();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = _currentTenantService.TenantId ?? Guid.Empty;
        var userId = _currentTenantService.UserId?.ToString();

        foreach (var entry in ChangeTracker.Entries<ThurayyaPharmacy.Domain.Common.BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    entry.Entity.CreatedBy = userId;
                    
                    if (entry.Entity is ThurayyaPharmacy.Domain.Common.ITenantEntity tenantEntity && tenantEntity.TenantId == Guid.Empty)
                    {
                        tenantEntity.TenantId = tenantId;
                    }
                    break;
                case EntityState.Modified:
                    entry.Entity.ModifiedAt = DateTime.UtcNow;
                    entry.Entity.ModifiedBy = userId;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Apply global query filters
        var tenantId = _currentTenantService.TenantId ?? Guid.Empty;

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            // Soft delete filter
            if (entityType.ClrType.GetProperty("IsDeleted") != null)
            {
                var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
                var property = System.Linq.Expressions.Expression.Property(parameter, "IsDeleted");
                var falseConstant = System.Linq.Expressions.Expression.Constant(false);
                var lambda = System.Linq.Expressions.Expression.Lambda(
                    System.Linq.Expressions.Expression.Equal(property, falseConstant),
                    parameter);
                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
            }

            // Multi-tenancy filter
            if (typeof(ThurayyaPharmacy.Domain.Common.ITenantEntity).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
                var property = System.Linq.Expressions.Expression.Property(parameter, "TenantId");
                var tenantIdConstant = System.Linq.Expressions.Expression.Constant(tenantId);
                var equalExpression = System.Linq.Expressions.Expression.Equal(property, tenantIdConstant);
                
                // If the user is not logged in (e.g., during registration), we might want to skip this filter or handle it differently.
                // But for now, using Guid.Empty will ensure no data is leaked.
                var lambda = System.Linq.Expressions.Expression.Lambda(equalExpression, parameter);
                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
            }
        }
        
        // Configure relationships
        ConfigureTenant(modelBuilder);
        ConfigureBranch(modelBuilder);
        ConfigureUser(modelBuilder);
        ConfigureProduct(modelBuilder);
        ConfigureSupplier(modelBuilder);
        ConfigurePurchaseOrder(modelBuilder);
        ConfigurePurchaseBill(modelBuilder);
        ConfigureCustomer(modelBuilder);
        ConfigureInvoice(modelBuilder);
        ConfigureExpense(modelBuilder);
    }

    private void ConfigureTenant(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Country).HasMaxLength(100);
            entity.Property(e => e.Currency).HasMaxLength(10);
        });
    }

    private void ConfigureBranch(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Branch>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Location).HasMaxLength(500);
            
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Branches)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Manager)
                .WithMany()
                .HasForeignKey(e => e.ManagerId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private void ConfigureUser(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Email).IsUnique();
            
            // Performance indexes
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.RefreshToken);
            entity.HasIndex(e => new { e.TenantId, e.BranchId });
            
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Branch)
                .WithMany(b => b.Users)
                .HasForeignKey(e => e.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private void ConfigureProduct(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Sku).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Price).HasPrecision(18, 2);
            entity.Property(e => e.Cost).HasPrecision(18, 2);
            entity.Property(e => e.Margin).HasPrecision(18, 2);
            
            // Performance indexes for frequently queried fields
            entity.HasIndex(e => e.Sku);
            entity.HasIndex(e => new { e.TenantId, e.BranchId });
            entity.HasIndex(e => new { e.TenantId, e.Category });
            entity.HasIndex(e => e.ExpiryDate);
            entity.HasIndex(e => new { e.Stock, e.MinStock }); // For low stock queries
            
            entity.HasOne(e => e.Branch)
                .WithMany(b => b.Products)
                .HasForeignKey(e => e.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Supplier)
                .WithMany(s => s.Products)
                .HasForeignKey(e => e.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        modelBuilder.Entity<ProductBatch>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BatchNumber).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Cost).HasPrecision(18, 2);
            
            entity.HasOne(e => e.Product)
                .WithMany(p => p.Batches)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private void ConfigureSupplier(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(20);
            entity.Property(e => e.CreditLimit).HasPrecision(18, 2);
            entity.Property(e => e.CurrentBalance).HasPrecision(18, 2);
            
            // Performance indexes
            entity.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
            entity.HasIndex(e => new { e.TenantId, e.Status });
            
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private void ConfigurePurchaseOrder(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SubTotal).HasPrecision(18, 2);
            entity.Property(e => e.Tax).HasPrecision(18, 2);
            entity.Property(e => e.Discount).HasPrecision(18, 2);
            entity.Property(e => e.GrandTotal).HasPrecision(18, 2);
            
            entity.HasOne(e => e.Supplier)
                .WithMany(s => s.PurchaseOrders)
                .HasForeignKey(e => e.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Branch)
                .WithMany(b => b.PurchaseOrders)
                .HasForeignKey(e => e.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        modelBuilder.Entity<PurchaseOrderItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UnitCost).HasPrecision(18, 2);
            
            entity.HasOne(e => e.PurchaseOrder)
                .WithMany(po => po.Items)
                .HasForeignKey(e => e.PurchaseOrderId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Product)
                .WithMany()
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private void ConfigurePurchaseBill(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PurchaseBill>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BillNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TotalAmount).HasPrecision(18, 2);
            entity.Property(e => e.PaidAmount).HasPrecision(18, 2);
            
            entity.HasOne(e => e.PurchaseOrder)
                .WithMany(po => po.Bills)
                .HasForeignKey(e => e.PurchaseOrderId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Supplier)
                .WithMany()
                .HasForeignKey(e => e.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        modelBuilder.Entity<PaymentRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            
            entity.HasOne(e => e.PurchaseBill)
                .WithMany(b => b.Payments)
                .HasForeignKey(e => e.PurchaseBillId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private void ConfigureCustomer(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Phone).IsRequired().HasMaxLength(20);
            entity.Property(e => e.CreditLimit).HasPrecision(18, 2);
            entity.Property(e => e.Balance).HasPrecision(18, 2);
            
            // Performance indexes
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => new { e.TenantId, e.Phone });
            entity.HasIndex(e => new { e.TenantId, e.Type });
            
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private void ConfigureInvoice(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Total).HasPrecision(18, 2);
            entity.Property(e => e.PaidAmount).HasPrecision(18, 2);
            
            entity.HasOne(e => e.Customer)
                .WithMany(c => c.Invoices)
                .HasForeignKey(e => e.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Branch)
                .WithMany(b => b.Invoices)
                .HasForeignKey(e => e.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
        modelBuilder.Entity<InvoiceItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Price).HasPrecision(18, 2);
            
            entity.HasOne(e => e.Invoice)
                .WithMany(i => i.Items)
                .HasForeignKey(e => e.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasOne(e => e.Product)
                .WithMany()
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
    
    private void ConfigureExpense(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Expense>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.AttachmentUrl).HasMaxLength(500);
            
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.Branch)
                .WithMany()
                .HasForeignKey(e => e.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}

