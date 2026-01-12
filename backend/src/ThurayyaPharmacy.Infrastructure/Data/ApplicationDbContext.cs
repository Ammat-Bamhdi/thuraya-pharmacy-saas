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
        
        // Multi-tenancy and soft-delete filters - Applied dynamically per entity using method calls
        // This ensures TenantId is resolved at query time, not at model build time
        // The old approach captured TenantId as a constant at startup (Guid.Empty), breaking multi-tenancy
        ConfigureMultiTenancyFilters(modelBuilder);
        
        // Apply soft-delete filter to non-tenant entities (Tenant, ProductBatch, etc.)
        ApplySoftDeleteFilters(modelBuilder);
        
        // Disable cascade delete globally to avoid SQL Server multiple cascade path issues
        foreach (var relationship in modelBuilder.Model.GetEntityTypes()
            .SelectMany(e => e.GetForeignKeys()))
        {
            relationship.DeleteBehavior = DeleteBehavior.Restrict;
        }
        
        // Configure relationships (can override Restrict where appropriate)
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
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Slug).IsUnique();
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
            entity.HasIndex(e => e.Email).IsUnique(); // Global email uniqueness
            
            // Performance indexes
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.RefreshToken);
            entity.HasIndex(e => e.InvitationToken);
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
            
            // Use Restrict to avoid multiple cascade paths (Tenant->Product->Batch vs Tenant->Batch)
            entity.HasOne(e => e.Product)
                .WithMany(p => p.Batches)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
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
    
    /// <summary>
    /// Configures multi-tenancy query filters dynamically.
    /// 
    /// IMPORTANT: The TenantId property is evaluated at query execution time, NOT at model build time.
    /// EF Core parameterizes property accesses from the DbContext, ensuring proper tenant isolation.
    /// </summary>
    private void ConfigureMultiTenancyFilters(ModelBuilder modelBuilder)
    {
        // Apply tenant filter to Branch
        modelBuilder.Entity<Branch>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to User  
        modelBuilder.Entity<User>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to Product
        modelBuilder.Entity<Product>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to Supplier
        modelBuilder.Entity<Supplier>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to PurchaseOrder
        modelBuilder.Entity<PurchaseOrder>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to PurchaseBill
        modelBuilder.Entity<PurchaseBill>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to Customer
        modelBuilder.Entity<Customer>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to Invoice
        modelBuilder.Entity<Invoice>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // Apply tenant filter to Expense
        modelBuilder.Entity<Expense>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
    }
    
    /// <summary>
    /// Current tenant ID property - EF Core parameterizes this at query execution time.
    /// Using a property (not method) is the recommended pattern for EF Core query filters.
    /// Returns Guid.Empty if no tenant is authenticated (which will match no data).
    /// </summary>
    private Guid CurrentTenantId => _currentTenantService.TenantId ?? Guid.Empty;
    
    /// <summary>
    /// Applies soft delete filter to the Tenant entity itself.
    /// Other entities have tenant filter which implies soft delete.
    /// </summary>
    private void ApplySoftDeleteFilters(ModelBuilder modelBuilder)
    {
        // Tenant entity - only soft delete, no tenant filter (it IS the tenant)
        modelBuilder.Entity<Tenant>()
            .HasQueryFilter(e => !e.IsDeleted);
            
        // ProductBatch - also has TenantId through BranchEntity
        modelBuilder.Entity<ProductBatch>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // PurchaseOrderItem - also has TenantId through BranchEntity
        modelBuilder.Entity<PurchaseOrderItem>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // PaymentRecord - also has TenantId through TenantEntity
        modelBuilder.Entity<PaymentRecord>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
            
        // InvoiceItem - also has TenantId through BranchEntity
        modelBuilder.Entity<InvoiceItem>()
            .HasQueryFilter(e => !e.IsDeleted && e.TenantId == CurrentTenantId);
    }
}

