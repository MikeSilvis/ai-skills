---
name: stripe
description: Stripe API and dashboard operations via MCP. Use when the user asks about Stripe payments, customers, subscriptions, invoices, products, prices, charges, refunds, payment intents, checkout sessions, webhooks, or any Stripe-related task. Triggers on "stripe", "payment", "subscription", "invoice", "checkout", "webhook".
---

# Stripe MCP Skill

Use the Stripe MCP server tools to interact with Stripe directly. This skill covers common Stripe operations and best practices.

## When to Apply

Use this skill when:
- Managing customers, subscriptions, or invoices
- Creating or updating products and prices
- Investigating charges, refunds, or disputes
- Setting up or debugging webhooks
- Working with payment intents or checkout sessions
- Querying Stripe data for reporting or debugging

## Key Concepts

### Object Hierarchy
- **Customer** — top-level entity, has payment methods, subscriptions, invoices
- **Product** — what you sell (name, description, metadata)
- **Price** — how much and how often (one-time or recurring, attached to a product)
- **Subscription** — recurring billing relationship between a customer and one or more prices
- **Invoice** — billing document, auto-generated for subscriptions or created manually
- **PaymentIntent** — tracks a single payment attempt through its lifecycle
- **Checkout Session** — hosted payment page for one-time or subscription purchases

### Common Workflows

#### Create a subscription
1. Ensure customer exists (create or retrieve)
2. Ensure product and price exist
3. Create subscription with customer ID and price ID

#### Issue a refund
1. Find the charge or payment intent
2. Create a refund (full or partial amount)

#### Debug a failed payment
1. Retrieve the payment intent
2. Check `last_payment_error` for decline reason
3. Check the customer's default payment method

### Webhook Best Practices
- Always verify webhook signatures in production code
- Handle these events at minimum: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Implement idempotency — webhooks can be delivered more than once

## Tips
- Use `metadata` fields to store your app's internal IDs on Stripe objects
- Use `expand` parameters to reduce API calls when you need nested objects
- Test mode objects use `test_` prefixed keys — never mix test and live keys
- When listing objects, use auto-pagination rather than manual cursor management
