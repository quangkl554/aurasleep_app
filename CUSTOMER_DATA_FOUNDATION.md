# Customer Data Foundation

## Goal

Track each customer's account lifecycle, app usage, device actions, AI/chat usage, and payment lifecycle without mixing data between users.

## Data Added

- `user_activity_events`: generic timeline of important user actions.
- `user_sessions`: register/login history with IP and user agent metadata.
- `device_command_history`: device commands such as settings updates and sleep mode.
- `payment_events`: payment attempts and provider events for VNPay/debugging.

## Current Coverage

- Auth: register and login create session/activity records.
- Sleep: creating a sleep record creates an activity event.
- Routine: creating a routine creates an activity event.
- Device: settings and sleep mode create command history and activity events.
- Chat: sending a message creates an activity event with session metadata.
- Payment: creating a VNPay URL creates a payment event and activity event.

## Operating Note

After deploying model changes, run `npm run db:sync` once in Railway shell to create the new tables.
