# AWS RDS Database Cleanup Guide

> ⚠️ **FOR EDUCATIONAL PURPOSES ONLY** - This guide documents how to securely connect to and clean an AWS RDS database that is in a private VPC.

## Overview

This guide covers the steps to:
1. Identify an AWS RDS database endpoint
2. Temporarily enable public access for maintenance
3. Delete all data from the database
4. Restore security settings

## Prerequisites

- AWS CLI installed and configured (`aws --version`)
- Node.js installed
- IAM user with permissions for:
  - `rds:DescribeDBInstances`
  - `rds:ModifyDBInstance`
  - `ec2:AuthorizeSecurityGroupIngress`
  - `ec2:RevokeSecurityGroupIngress`

---

## Step 1: Identify Your RDS Database

### List all RDS instances in your region:

```bash
aws rds describe-db-instances \
  --region eu-north-1 \
  --query "DBInstances[*].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port,DBName]" \
  --output table
```

**Example output:**
```
|  awseb-e-xxxxx-stack-awsebrdsdatabase-xxxxx |  awseb-e-xxxxx.c90awy6yomx4.eu-north-1.rds.amazonaws.com  |  5432 |  ebdb |
```

### Get security group and public access status:

```bash
aws rds describe-db-instances \
  --db-instance-identifier YOUR_DB_INSTANCE_ID \
  --region eu-north-1 \
  --query "DBInstances[0].[VpcSecurityGroups[*].VpcSecurityGroupId,PubliclyAccessible]" \
  --output json
```

**Example output:**
```json
[
    ["sg-0d9bf62f24b792fa4"],
    false
]
```

---

## Step 2: Enable Temporary Public Access

> ⚠️ **Security Warning**: Only do this temporarily for maintenance. Always revert these changes afterward.

### Make RDS publicly accessible:

```bash
aws rds modify-db-instance \
  --db-instance-identifier YOUR_DB_INSTANCE_ID \
  --publicly-accessible \
  --apply-immediately \
  --region eu-north-1
```

### Add inbound rule to security group:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id YOUR_SECURITY_GROUP_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region eu-north-1
```

### Wait for changes to propagate:

```bash
# Wait 30 seconds for RDS modification
sleep 30

# Flush DNS cache (Windows)
ipconfig /flushdns

# Verify new public IP
nslookup YOUR_RDS_ENDPOINT
```

---

## Step 3: Connect and Delete Data

### Create a Node.js script (`delete-all-data.cjs`):

```javascript
const { Client } = require('pg');

async function deleteAllData() {
  const client = new Client({
    host: 'YOUR_RDS_ENDPOINT',
    port: 5432,
    database: 'ebdb',
    user: 'YOUR_USERNAME',
    password: 'YOUR_PASSWORD',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Get all tables in the database
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('Tables in database:');
    tablesResult.rows.forEach(row => console.log('  - ' + row.table_name));
    console.log('');

    console.log('Deleting all data...\n');

    // Delete order respects foreign key constraints (child tables first)
    const deleteOrder = [
      '"InvoiceItems"',
      '"PaymentRecords"',
      '"PurchaseOrderItems"',
      '"ProductBatches"',
      '"Invoices"',
      '"PurchaseBills"',
      '"PurchaseOrders"',
      '"Products"',
      '"Expenses"',
      '"Customers"',
      '"Suppliers"',
      '"Users"',
      '"Branches"',
      '"Tenants"'
    ];

    for (const table of deleteOrder) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        console.log(`✓ Deleted ${result.rowCount} rows from ${table}`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`⚠ Table ${table} does not exist, skipping`);
        } else {
          console.log(`✗ Error deleting from ${table}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ All data deleted successfully!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nConnection closed.');
  }
}

deleteAllData();
```

### Install dependencies and run:

```bash
npm install pg --save-dev
node delete-all-data.cjs
```

**Example output:**
```
Connecting to database...
Connected successfully!

Tables in database:
  - Branches
  - Customers
  - Expenses
  - InvoiceItems
  - Invoices
  ...

Deleting all data...

✓ Deleted 0 rows from "InvoiceItems"
✓ Deleted 0 rows from "PaymentRecords"
✓ Deleted 3 rows from "Users"
✓ Deleted 1 rows from "Branches"
✓ Deleted 3 rows from "Tenants"

✅ All data deleted successfully!

Connection closed.
```

---

## Step 4: Restore Security Settings

> 🔒 **CRITICAL**: Always restore security settings after maintenance!

### Remove public access from security group:

```bash
aws ec2 revoke-security-group-ingress \
  --group-id YOUR_SECURITY_GROUP_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region eu-north-1
```

### Make RDS private again:

```bash
aws rds modify-db-instance \
  --db-instance-identifier YOUR_DB_INSTANCE_ID \
  --no-publicly-accessible \
  --apply-immediately \
  --region eu-north-1
```

### Clean up temporary files:

```bash
rm delete-all-data.cjs
```

---

## Understanding Foreign Key Constraints

When deleting data from a relational database, you must delete in the correct order to avoid foreign key constraint violations:

```
┌─────────────────────────────────────────────────────────────┐
│                     DELETE ORDER                             │
│                                                              │
│  1. InvoiceItems      ─┐                                    │
│  2. PaymentRecords     │  Child tables (depend on others)   │
│  3. PurchaseOrderItems │                                    │
│  4. ProductBatches    ─┘                                    │
│                                                              │
│  5. Invoices          ─┐                                    │
│  6. PurchaseBills      │  Mid-level tables                  │
│  7. PurchaseOrders     │                                    │
│  8. Products          ─┘                                    │
│                                                              │
│  9. Expenses          ─┐                                    │
│  10. Customers         │  Top-level business entities       │
│  11. Suppliers        ─┘                                    │
│                                                              │
│  12. Users            ─┐                                    │
│  13. Branches          │  Core entities                     │
│  14. Tenants          ─┘                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Best Practices

| Practice | Description |
|----------|-------------|
| **Never leave RDS public** | Always revert to private after maintenance |
| **Use specific IP ranges** | Instead of `0.0.0.0/0`, use your specific IP |
| **Use Secrets Manager** | Store credentials in AWS Secrets Manager, not in scripts |
| **Enable SSL** | Always use `ssl: { rejectUnauthorized: false }` or proper certificates |
| **Audit logging** | Enable CloudWatch logs for database access |
| **Use VPN/Bastion** | For regular access, use a VPN or bastion host instead of making RDS public |

---

## Alternative: Using AWS Session Manager

If you have SSM permissions, you can run commands on an EC2 instance within the VPC:

```bash
aws ssm send-command \
  --instance-ids "i-xxxxxxxxxxxx" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["PGPASSWORD=xxx psql -h RDS_ENDPOINT -U username -d database -c \"DELETE FROM table;\""]' \
  --region eu-north-1
```

This is more secure as it doesn't require exposing the RDS to the public internet.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection timeout | Check security group rules and public accessibility |
| DNS not resolving to public IP | Flush DNS cache (`ipconfig /flushdns` on Windows) |
| Foreign key constraint error | Delete child tables before parent tables |
| SSL connection error | Use `ssl: { rejectUnauthorized: false }` in Node.js |
| Access denied on AWS CLI | Check IAM user permissions |

---

*Last updated: January 2026*
