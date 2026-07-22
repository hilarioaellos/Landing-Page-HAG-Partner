import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ============ ORGANIZATIONS & USERS ============
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  profiles: defineTable({
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")), // null until assigned by super_admin
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("manager"),
      v.literal("partner"),
      v.literal("viewer")
    ),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    avatar: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_user_org", ["userId", "orgId"]),

  // ============ CONTACT LEADS ============
  contact_leads: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("closed")),
  }).index("by_status", ["status"]),

  // ============ INVITATIONS ============
  invitations: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("manager"),
      v.literal("partner"),
      v.literal("viewer")
    ),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdBy: v.id("users"),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_org", ["orgId"]),

  // ============ CONTABILIDAD ============
  chart_of_accounts: defineTable({
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("asset"),
      v.literal("liability"),
      v.literal("equity"),
      v.literal("revenue"),
      v.literal("expense")
    ),
    parentId: v.optional(v.id("chart_of_accounts")),
    isActive: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_code", ["orgId", "code"]),

  journal_entries: defineTable({
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    date: v.number(),
    description: v.string(),
    reference: v.optional(v.string()),
    lines: v.array(
      v.object({
        accountId: v.id("chart_of_accounts"),
        debit: v.number(),
        credit: v.number(),
        description: v.optional(v.string()),
      })
    ),
    status: v.union(v.literal("draft"), v.literal("posted"), v.literal("voided")),
  })
    .index("by_org", ["orgId"])
    .index("by_date", ["orgId", "date"]),

  invoices: defineTable({
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    number: v.string(),
    contactId: v.optional(v.id("crm_contacts")),
    issueDate: v.number(),
    dueDate: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    items: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        taxRate: v.optional(v.number()),
      })
    ),
    subtotal: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_contact", ["contactId"])
    .index("by_status", ["orgId", "status"]),

  // ============ PROVEEDORES ============
  suppliers: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    paymentTerms: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["orgId", "status"]),

  supplier_products: defineTable({
    orgId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    name: v.string(),
    sku: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    unit: v.optional(v.string()),
    minOrder: v.optional(v.number()),
    leadTimeDays: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_supplier", ["supplierId"]),

  purchase_orders: defineTable({
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    supplierId: v.id("suppliers"),
    number: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("confirmed"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    orderDate: v.number(),
    expectedDate: v.optional(v.number()),
    items: v.array(
      v.object({
        productId: v.optional(v.id("supplier_products")),
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
      })
    ),
    total: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_supplier", ["supplierId"])
    .index("by_status", ["orgId", "status"]),

  // ============ DOCUMENTOS ============
  document_folders: defineTable({
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    name: v.string(),
    parentId: v.optional(v.id("document_folders")),
  })
    .index("by_org", ["orgId"])
    .index("by_parent", ["parentId"]),

  documents: defineTable({
    orgId: v.id("organizations"),
    uploadedBy: v.id("users"),
    folderId: v.optional(v.id("document_folders")),
    name: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id("_storage"),
    tags: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_folder", ["folderId"])
    .index("by_uploader", ["uploadedBy"]),

  // ============ MENSAJERÍA ============
  conversations: defineTable({
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    isGroup: v.boolean(),
    participants: v.array(v.id("users")),
    createdBy: v.id("users"),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_last_message", ["orgId", "lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    type: v.union(v.literal("text"), v.literal("file")),
    fileId: v.optional(v.id("documents")),
    readBy: v.array(v.id("users")),
    editedAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"]),

  // ============ CRM ============
  crm_contacts: defineTable({
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    position: v.optional(v.string()),
    status: v.union(
      v.literal("lead"),
      v.literal("prospect"),
      v.literal("customer"),
      v.literal("inactive")
    ),
    source: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["orgId", "status"]),

  crm_deals: defineTable({
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    contactId: v.id("crm_contacts"),
    title: v.string(),
    value: v.number(),
    currency: v.string(),
    stage: v.union(
      v.literal("lead"),
      v.literal("qualified"),
      v.literal("proposal"),
      v.literal("negotiation"),
      v.literal("won"),
      v.literal("lost")
    ),
    expectedCloseDate: v.optional(v.number()),
    probability: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_contact", ["contactId"])
    .index("by_stage", ["orgId", "stage"]),

  crm_activities: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    contactId: v.id("crm_contacts"),
    dealId: v.optional(v.id("crm_deals")),
    type: v.union(
      v.literal("call"),
      v.literal("email"),
      v.literal("meeting"),
      v.literal("note"),
      v.literal("task")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
  })
    .index("by_org", ["orgId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"])
    .index("by_user", ["userId"]),

  // ============ FINTRACK ============
  fintrack_accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("investment"),
      v.literal("credit"),
      v.literal("cash")
    ),
    currencyCode: v.string(),
    bankName: v.optional(v.string()),
    initialBalanceCents: v.number(),
    balanceCents: v.number(),
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  fintrack_transactions: defineTable({
    userId: v.id("users"),
    accountId: v.id("fintrack_accounts"),
    amountCents: v.number(),
    currencyCode: v.string(),
    type: v.union(
      v.literal("income"),
      v.literal("expense"),
      v.literal("transfer")
    ),
    categoryId: v.optional(v.id("fintrack_categories")),
    merchantId: v.optional(v.id("fintrack_merchants")),
    date: v.number(),
    source: v.union(v.literal("manual"), v.literal("csv"), v.literal("plaid")),
    notes: v.optional(v.string()),
    isReconciled: v.boolean(),
    transferToAccountId: v.optional(v.id("fintrack_accounts")),
    importHash: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"])
    .index("by_date", ["userId", "date"])
    .index("by_category", ["userId", "categoryId"])
    .index("by_import_hash", ["userId", "importHash"])
    .index("by_account_date", ["accountId", "date"]),

  fintrack_categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.id("fintrack_categories")),
    isSystem: v.boolean(),
    forceExclude: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_parent", ["parentId"]),

  fintrack_category_settings: defineTable({
    userId: v.id("users"),
    categoryId: v.id("fintrack_categories"),
    isActive: v.boolean(),
    excludeFromReports: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "categoryId"]),

  fintrack_merchants: defineTable({
    userId: v.id("users"),
    name: v.string(),
    normalizedName: v.string(),
    defaultCategoryId: v.optional(v.id("fintrack_categories")),
  })
    .index("by_user", ["userId"])
    .index("by_normalized", ["userId", "normalizedName"]),

  fintrack_budgets: defineTable({
    userId: v.id("users"),
    month: v.number(),
    year: v.number(),
    categoryId: v.id("fintrack_categories"),
    amountPlannedCents: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_period", ["userId", "year", "month"])
    .index("by_period_category", ["userId", "year", "month", "categoryId"]),

  fintrack_debts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    lender: v.string(),
    type: v.union(v.literal("revolving"), v.literal("installment")),
    currencyCode: v.string(),
    balanceCents: v.number(),
    interestRateBps: v.number(),
    monthlyPaymentCents: v.number(),
    isActive: v.boolean(),
    // A7 — enrichment fields
    originDate: v.optional(v.number()),
    paymentDueDate: v.optional(v.number()),
    paymentPeriodicity: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("biweekly"),
        v.literal("weekly"),
        v.literal("one_time")
      )
    ),
    totalTermMonths: v.optional(v.number()),
    paidInstallments: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  fintrack_credit_cards: defineTable({
    userId: v.id("users"),
    accountId: v.id("fintrack_accounts"),
    closingDay: v.number(),
    paymentDueDay: v.number(),
    creditLimitCents: v.number(),
    minimumPaymentCents: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"]),

  fintrack_cash_pockets: defineTable({
    userId: v.id("users"),
    name: v.string(),
    amountCents: v.number(),
    accountId: v.id("fintrack_accounts"),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"]),

  fintrack_transaction_splits: defineTable({
    userId: v.id("users"),
    transactionId: v.id("fintrack_transactions"),
    categoryId: v.id("fintrack_categories"),
    subcategoryId: v.optional(v.id("fintrack_categories")),
    amountCents: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_user", ["userId"]),

  fintrack_notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("payment_due"),
      v.literal("budget_exceeded"),
      v.literal("subscription_renewing"),
      v.literal("debt_due"),
      v.literal("receivable_overdue"),
      v.literal("low_balance"),
      v.literal("reconciliation_pending")
    ),
    message: v.string(),
    dueDate: v.optional(v.number()),
    isRead: v.boolean(),
    severity: v.union(
      v.literal("urgent"),
      v.literal("warning"),
      v.literal("good"),
      v.literal("info")
    ),
    createdAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_user_created", ["userId", "createdAt"]),

  fintrack_reconciliations: defineTable({
    userId: v.id("users"),
    accountId: v.id("fintrack_accounts"),
    date: v.number(),
    systemBalanceCents: v.number(),
    bankBalanceCents: v.number(),
    differenceCents: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("discrepancy")
    ),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"])
    .index("by_account_date", ["accountId", "date"]),

  fintrack_user_settings: defineTable({
    userId: v.id("users"),
    defaultCurrency: v.string(),
    dashboardWidgets: v.optional(v.string()),
    theme: v.optional(v.string()),
    categoriesReviewed: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // ============ A1 — SUSCRIPCIONES ============
  fintrack_subscriptions: defineTable({
    userId: v.id("users"),
    name: v.string(),
    amountCents: v.number(),
    currencyCode: v.string(),
    periodicity: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annual"),
      v.literal("weekly")
    ),
    nextRenewalDate: v.number(),
    accountId: v.id("fintrack_accounts"),
    categoryId: v.optional(v.id("fintrack_categories")),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"])
    .index("by_renewal", ["userId", "nextRenewalDate"]),

  // ============ A6 — ACREENCIAS ============
  fintrack_receivables: defineTable({
    userId: v.id("users"),
    debtorName: v.string(),
    description: v.string(),
    originalAmountCents: v.number(),
    outstandingBalanceCents: v.number(),
    currencyCode: v.string(),
    originDate: v.number(),
    dueDate: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    paymentPeriodicity: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("one_time"),
        v.literal("irregular")
      )
    ),
    status: v.union(
      v.literal("active"),
      v.literal("partially_paid"),
      v.literal("fully_paid"),
      v.literal("written_off")
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  fintrack_receivable_payments: defineTable({
    receivableId: v.id("fintrack_receivables"),
    userId: v.id("users"),
    amountCents: v.number(),
    paymentDate: v.number(),
    method: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_receivable", ["receivableId"])
    .index("by_user", ["userId"])
    .index("by_user_receivable", ["userId", "receivableId"]),
});
