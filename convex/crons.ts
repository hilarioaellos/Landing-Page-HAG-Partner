import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 9 AM EST (13:00 UTC) — create payment due notifications
crons.daily(
  "check_payment_due_dates",
  { hourUTC: 13, minuteUTC: 0 },
  internal.fintrack.notifications.checkPaymentDueDates
);

// Weekly on Monday at 3:00 UTC — purge read notifications older than 30 days
crons.weekly(
  "purge_read_notifications",
  { dayOfWeek: "monday", hourUTC: 3, minuteUTC: 0 },
  internal.fintrack.notifications.purgeReadNotifications
);

export default crons;
