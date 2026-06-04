import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 9 AM EST (13:00 UTC) — create payment due notifications
crons.daily(
  "check_payment_due_dates",
  { hourUTC: 13, minuteUTC: 0 },
  internal.fintrack.notifications.checkPaymentDueDates
);

export default crons;
