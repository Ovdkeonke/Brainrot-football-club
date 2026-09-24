import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brainrotRedeemCodesTable = pgTable("brainrot_redeem_codes", {
  code: text("code").primaryKey(),
  limit: integer("limit").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrainrotRedeemCodeSchema = createInsertSchema(
  brainrotRedeemCodesTable,
).omit({ createdAt: true });
export type InsertBrainrotRedeemCode = z.infer<typeof insertBrainrotRedeemCodeSchema>;
export type BrainrotRedeemCode = typeof brainrotRedeemCodesTable.$inferSelect;

export const brainrotCoinGrantsTable = pgTable("brainrot_coin_grants", {
  clientId: text("client_id").primaryKey(),
  amount: integer("amount").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});