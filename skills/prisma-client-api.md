---
name: prisma-client-api
description: Prisma Client API reference covering model queries, filtering, relations, transactions, and raw SQL for Prisma ORM 7.x. Use when writing database queries, performing CRUD operations, filtering/sorting data, working with relations, or using transactions.
---

# Prisma Client API Reference

Complete API reference for Prisma Client. This skill provides guidance on model queries, filtering, relations, and client methods for Prisma ORM 7.x.

## When to Apply

Reference this skill when:
- Writing database queries with Prisma Client
- Performing CRUD operations (create, read, update, delete)
- Filtering and sorting data
- Working with relations
- Using transactions
- Configuring client options

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Client Construction | HIGH | `constructor` |
| 2 | Model Queries | CRITICAL | `model-queries` |
| 3 | Query Shape | HIGH | `query-options` |
| 4 | Filtering | HIGH | `filters` |
| 5 | Relations | HIGH | `relations` |
| 6 | Transactions | CRITICAL | `transactions` |
| 7 | Raw SQL | CRITICAL | `raw-queries` |
| 8 | Client Methods | MEDIUM | `client-methods` |

## Client Instantiation (v7)

```typescript
import { PrismaClient } from '../generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({ adapter })
```

## Model Query Methods

| Method | Description |
|--------|-------------|
| `findUnique()` | Find one record by unique field |
| `findUniqueOrThrow()` | Find one or throw error |
| `findFirst()` | Find first matching record |
| `findFirstOrThrow()` | Find first or throw error |
| `findMany()` | Find multiple records |
| `create()` | Create a new record |
| `createMany()` | Create multiple records |
| `createManyAndReturn()` | Create multiple and return them |
| `update()` | Update one record |
| `updateMany()` | Update multiple records |
| `updateManyAndReturn()` | Update multiple and return them |
| `upsert()` | Update or create record |
| `delete()` | Delete one record |
| `deleteMany()` | Delete multiple records |
| `count()` | Count matching records |
| `aggregate()` | Aggregate values (sum, avg, etc.) |
| `groupBy()` | Group and aggregate |

## Query Options

| Option | Description |
|--------|-------------|
| `where` | Filter conditions |
| `select` | Fields to include |
| `include` | Relations to load |
| `omit` | Fields to exclude |
| `orderBy` | Sort order |
| `take` | Limit results |
| `skip` | Skip results (pagination) |
| `cursor` | Cursor-based pagination |
| `distinct` | Unique values only |

## Client Methods

| Method | Description |
|--------|-------------|
| `$connect()` | Explicitly connect to database |
| `$disconnect()` | Disconnect from database |
| `$transaction()` | Execute transaction |
| `$queryRaw()` | Execute raw SQL query |
| `$executeRaw()` | Execute raw SQL command |
| `$on()` | Subscribe to events |
| `$extends()` | Add extensions |

## Quick Examples

### Find records

```typescript
// Find by unique field
const user = await prisma.user.findUnique({
  where: { email: 'alice@prisma.io' }
})

// Find with filter and pagination
const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
  take: 10
})

// Find with relation loading
const userWithPosts = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true }
})

// Find with field selection
const userEmails = await prisma.user.findMany({
  select: { email: true, name: true }
})
```

### Create records

```typescript
// Create with nested relation
const user = await prisma.user.create({
  data: {
    email: 'alice@prisma.io',
    name: 'Alice',
    posts: {
      create: { title: 'Hello World' }
    }
  },
  include: { posts: true }
})

// Create many
const count = await prisma.user.createMany({
  data: [
    { email: 'alice@prisma.io', name: 'Alice' },
    { email: 'bob@prisma.io', name: 'Bob' },
  ],
  skipDuplicates: true
})
```

### Update records

```typescript
// Update one
const user = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Alice Smith' }
})

// Upsert
const user = await prisma.user.upsert({
  where: { email: 'alice@prisma.io' },
  update: { name: 'Alice Smith' },
  create: { email: 'alice@prisma.io', name: 'Alice Smith' }
})

// Update many
const count = await prisma.user.updateMany({
  where: { role: 'USER' },
  data: { active: false }
})
```

### Delete records

```typescript
// Delete one
await prisma.user.delete({
  where: { id: 1 }
})

// Delete many
await prisma.user.deleteMany({
  where: { active: false }
})
```

### Transactions

```typescript
// Sequential transaction (array)
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { email: 'alice@prisma.io' } }),
  prisma.post.create({ data: { title: 'Hello', authorId: 1 } })
])

// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id: 1 } })
  if (!user) throw new Error('User not found')
  return tx.post.create({
    data: { title: 'Hello', authorId: user.id }
  })
})
```

### Raw SQL

```typescript
// Tagged template (safe from SQL injection)
const users = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE role = ${role}
`

// Execute (returns affected row count)
const count = await prisma.$executeRaw`
  UPDATE "User" SET active = false WHERE "lastLogin" < ${cutoff}
`
```

## Filter Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `not` | Not equal |
| `in` | In array |
| `notIn` | Not in array |
| `lt`, `lte` | Less than (or equal) |
| `gt`, `gte` | Greater than (or equal) |
| `contains` | String contains |
| `startsWith` | String starts with |
| `endsWith` | String ends with |
| `mode` | Case sensitivity (`'insensitive'`) |

### Filter Examples

```typescript
// Combine filters
const users = await prisma.user.findMany({
  where: {
    AND: [
      { email: { contains: '@company.com' } },
      { role: { in: ['ADMIN', 'EDITOR'] } },
      { createdAt: { gte: new Date('2024-01-01') } }
    ]
  }
})

// OR conditions
const users = await prisma.user.findMany({
  where: {
    OR: [
      { email: { contains: 'alice' } },
      { name: { startsWith: 'A' } }
    ]
  }
})

// NOT conditions
const users = await prisma.user.findMany({
  where: {
    NOT: { role: 'ADMIN' }
  }
})

// Case-insensitive search
const users = await prisma.user.findMany({
  where: {
    name: { contains: 'alice', mode: 'insensitive' }
  }
})
```

## Relation Filters

| Operator | Description |
|----------|-------------|
| `some` | At least one related record matches |
| `every` | All related records match |
| `none` | No related records match |
| `is` | Related record matches (1-to-1) |
| `isNot` | Related record doesn't match |

### Relation Filter Examples

```typescript
// Users who have at least one published post
const users = await prisma.user.findMany({
  where: {
    posts: { some: { published: true } }
  }
})

// Users with no posts
const users = await prisma.user.findMany({
  where: {
    posts: { none: {} }
  }
})

// Posts where author is admin
const posts = await prisma.post.findMany({
  where: {
    author: { is: { role: 'ADMIN' } }
  }
})
```

## Aggregations

```typescript
// Count
const count = await prisma.user.count({
  where: { active: true }
})

// Aggregate
const stats = await prisma.product.aggregate({
  _avg: { price: true },
  _max: { price: true },
  _min: { price: true },
  _sum: { price: true },
  _count: true
})

// Group by
const grouped = await prisma.user.groupBy({
  by: ['role'],
  _count: { _all: true },
  orderBy: { _count: { _all: 'desc' } }
})
```

## Resources

- [Prisma Client API Reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
- [CRUD Operations](https://www.prisma.io/docs/orm/prisma-client/queries/crud)
- [Filtering and Sorting](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting)
