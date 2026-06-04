/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as contact from "../contact.js";
import type * as crons from "../crons.js";
import type * as emails_welcome from "../emails/welcome.js";
import type * as fintrack__auth from "../fintrack/_auth.js";
import type * as fintrack__balance from "../fintrack/_balance.js";
import type * as fintrack__money from "../fintrack/_money.js";
import type * as fintrack_accounts from "../fintrack/accounts.js";
import type * as fintrack_cards from "../fintrack/cards.js";
import type * as fintrack_categories from "../fintrack/categories.js";
import type * as fintrack_health from "../fintrack/health.js";
import type * as fintrack_import from "../fintrack/import.js";
import type * as fintrack_merchants from "../fintrack/merchants.js";
import type * as fintrack_notifications from "../fintrack/notifications.js";
import type * as fintrack_transactions from "../fintrack/transactions.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_guards from "../lib/guards.js";
import type * as organizations from "../organizations.js";
import type * as profiles from "../profiles.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  contact: typeof contact;
  crons: typeof crons;
  "emails/welcome": typeof emails_welcome;
  "fintrack/_auth": typeof fintrack__auth;
  "fintrack/_balance": typeof fintrack__balance;
  "fintrack/_money": typeof fintrack__money;
  "fintrack/accounts": typeof fintrack_accounts;
  "fintrack/cards": typeof fintrack_cards;
  "fintrack/categories": typeof fintrack_categories;
  "fintrack/health": typeof fintrack_health;
  "fintrack/import": typeof fintrack_import;
  "fintrack/merchants": typeof fintrack_merchants;
  "fintrack/notifications": typeof fintrack_notifications;
  "fintrack/transactions": typeof fintrack_transactions;
  http: typeof http;
  invitations: typeof invitations;
  "lib/crypto": typeof lib_crypto;
  "lib/guards": typeof lib_guards;
  organizations: typeof organizations;
  profiles: typeof profiles;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
