---
name: smart-calendar-assistant
description: Scans iMessages and Gmail every 6 hours for mentions of plans, events, meetups, appointments, or anything that sounds like a scheduled activity. Creates calendar events — tentative if unconfirmed, confirmed if confirmed. For events with a person (not a business), looks up their email in contacts and invites them. Trigger when the user says "check my messages for plans", "scan for calendar events", "run the calendar scan", "check if anyone made plans with me", or for the 6-hour scheduled scan.
---

# Smart Calendar Assistant

Scans iMessages and Gmail for any mention of upcoming plans or events, then
automatically creates calendar entries — tentative for unconfirmed, confirmed
for confirmed. Invites people (not businesses) if their email is in contacts.

---

## When This Skill Runs

This skill is designed to be triggered:
- **Every 6 hours** via LaunchAgent (`configs/bot/tasks/smart_calendar_scan.rb`)
- **On demand** when user asks to "check for plans" or "scan messages"

The scan window covers messages from **the entire current month** (1st through
last day). The iMessage MCP supports date-level filtering via `date_from`/`date_to`
in `YYYY-MM-DD` format. When running on-demand or via cron, scan the full month
to catch plans made days or weeks in advance.

---

## Step-by-Step Execution

### Step 1 — Fetch Recent iMessages (Keyword-Targeted)

Instead of fetching ALL messages for the day, run **targeted keyword searches**
to keep token usage low. Use `search_messages` from the imessage MCP with
`date_from` set to today's date and a `query` parameter for each keyword group.
Use `limit: 50` per search.

**IMPORTANT**: The iMessage MCP does **literal substring matching** — it does NOT
support boolean operators like `OR`. Each keyword must be its own separate
`search_messages` call. Run all searches in parallel (batch all tool calls).

Use `limit: 20` per search to keep token usage manageable.

**Group 1 — Food & drinks** (6 searches):
`"dinner"`, `"lunch"`, `"brunch"`, `"drinks"`, `"coffee"`, `"breakfast"`

**Group 2 — Sports & outdoors** (6 searches):
`"golf"`, `"hike"`, `"tennis"`, `"pickleball"`, `"tee time"`, `"fishing"`

**Group 3 — Social & entertainment** (6 searches):
`"hangout"`, `"party"`, `"birthday"`, `"concert"`, `"game night"`, `"brewery"`

**Group 4 — Fitness** (4 searches):
`"gym"`, `"workout"`, `"yoga"`, `"lesson"`

**Group 5 — Travel** (4 searches):
`"trip"`, `"visit"`, `"camping"`, `"hotel"`

**Group 6 — Day names** (7 searches):
`"Monday"`, `"Tuesday"`, `"Wednesday"`, `"Thursday"`, `"Friday"`, `"Saturday"`, `"Sunday"`

**Group 7 — Scheduling language** (4 searches):
`"tomorrow"`, `"tonight"`, `"this weekend"`, `"next week"`

**Group 8 — Confirmation** (4 searches):
`"sounds good"`, `"see you"`, `"confirmed"`, `"I'm in"`

**Group 9 — Invitations** (4 searches):
`"meet up"`, `"are you free"`, `"meet me"`, `"let's go"`

**Group 10 — Times** (4 searches):
`"noon"`, `"o'clock"`, `"1130"`, `"tee time"`

That's ~49 searches total. Run them ALL in parallel in a single batch of tool
calls. Each search: `search_messages(query: "<keyword>", date_from: "YYYY-MM-DD", date_to: "YYYY-MM-DD", limit: 20)`

After collecting results, **deduplicate** by message ID before proceeding to
Step 1b. This approach typically returns 10-30 relevant messages instead of 200+
unfiltered ones.

### Step 1b — Fetch Conversation Context

For each unique contact that appeared in Step 1 results, fetch their recent
conversation thread using `get_conversation(contact: "<name or handle>", date_from: "YYYY-MM-DD")`.
This is critical — a scheduling message (e.g. "1130 Wednesday") often lacks
keywords but sits next to messages that do. Scanning the full thread catches
plans that keyword search alone misses.

Parse the full thread for event signals before proceeding to Step 2.

### Step 2 — Fetch Recent Gmail

Use the Claude Gmail connector (available in both interactive and cron sessions).

1. `mcp__claude_ai_Gmail__search_threads` with a Gmail query like
   `newer_than:1d -in:promotions -in:updates` to surface recent personal
   threads. Use `pageSize: 20`.
2. For threads that look event-related from the snippet/subject, call
   `mcp__claude_ai_Gmail__get_thread` to read the full content.

Look for the same event signals as iMessages in subject lines and body content.

Focus especially on:
- Event planning threads between people
- Restaurant/reservation confirmations → these are CONFIRMED business events
- Social invites from individuals
- Skip calendar invite emails (already on calendar)
- Skip marketing emails, newsletters, automated notifications

### Step 3 — Parse Each Candidate

For each message that contains event signals, extract:

```
sender_name: string (name of person/business who sent it)
sender_contact: string (phone or email)
event_description: string (what the event is)
event_date: string | null (specific date if mentioned, else null)
event_time: string | null (specific time if mentioned, else null)
is_confirmed: boolean (true if both parties seem to agree, false if still tentative)
is_person: boolean (true if this is an individual, false if it's a business/service)
raw_context: string (the relevant message snippet for reference)
```

**Distinguishing person vs business:**
- Business signals: marketing emails, receipts, confirmation numbers, "no-reply"
  addresses, business names in sender field, reservation system emails
- Person signals: a recognizable first name, personal phone number, casual language,
  back-and-forth conversation thread

### Step 4 — Check for Duplicates

Before creating any event, check if an event already exists for that date/time
with a similar title. If it does, skip it.

Use `mcp__claude_ai_Google_Calendar__list_events` with a `timeMin`/`timeMax`
window of ±1 hour around the detected event time on `calendarId: "primary"`.

### Step 5 — Look Up Contact Email (Persons Only)

If `is_person = true`, use `resolve_contact(query: "<name>")` from the imessage
MCP to find their email address. Falls back to `get_contact(contact: "<name>")`
if resolve doesn't return an email.

- If found: add them as an attendee
- If not found: create the event without attendees (note it in description)

Skip this step entirely if `is_person = false` (business).

### Step 6 — Create the Calendar Event

Use `mcp__claude_ai_Google_Calendar__create_event` on `calendarId: "primary"`.

**For CONFIRMED events:**
```
status: "confirmed"
summary: "[emoji] [Event Description] with [Name]"
```

**For TENTATIVE/UNCONFIRMED events:**
```
status: "tentative"
summary: "[emoji] [Event Description] with [Name] (tentative)"
```

**Event details to set:**
- `summary`: descriptive title (e.g., "🍕 Dinner with Jake", "☕ Coffee with Sarah (tentative)")
- `description`: include the original message snippet for context, plus source (iMessage/Gmail)
- `start` / `end`: use detected time; if no time given, make it an all-day event on the date; if no date given, skip creating the event and just log it
- `timeZone`: "America/New_York"
- `attendees`: only include if `is_person = true` AND email was found
- `status`: "confirmed" or "tentative"
- `reminders`: set a popup reminder 60 minutes before

**Emoji guide:**
- 🍽️ dinner / meal
- ☕ coffee
- 🍺 drinks / bar
- 🎮 gaming / game night
- 🎂 birthday / party
- 🎵 concert / show
- 🏋️ gym / workout
- 🏈 sports / game watching
- 📅 generic meeting / hangout
- ✈️ travel / trip

### Step 7 — Report Summary

After processing all messages, provide a clean summary:

```
📅 Smart Calendar Scan Complete

✅ Events Created (N):
  • [Event title] — [Date/Time] — [confirmed/tentative]
    └ Invited: [name] if applicable

⏭️ Skipped (already on calendar or no date): N items

📭 No plans found in remaining messages
```

If nothing was found at all, say so clearly and briefly.

---

## Edge Cases & Rules

- **No date found**: Do NOT create an event. Log it as "unclear date — skipped".
- **Ambiguous dates** ("this weekend"): Use the upcoming Saturday at 12pm as a
  reasonable default; mark as tentative and note the ambiguity in the description.
- **Business reservation confirmations** (OpenTable, Eventbrite, airline, etc.):
  Create as confirmed, no attendees, use the business name in the title.
- **Group chats**: If a group iMessage thread has event planning, treat attendees
  as unknown unless names are clear in the thread — create event without invites.
- **Already on calendar**: Skip without creating a duplicate. Optionally update
  status from tentative → confirmed if the conversation confirms it.
- **Multi-message threads**: Prioritize the most recent message to determine
  confirmed vs tentative status.
- **Privacy**: Never log or share message content beyond the description field
  of the created calendar event.

---

## Tool Reference

### iMessage MCP (always available)

| Action | Tool |
|---|---|
| Get recent iMessages | `search_messages(query: "<keywords>", date_from: "YYYY-MM-DD", limit: 50)` — use targeted keyword searches, not blanket fetch |
| Get a conversation thread | `get_conversation(contact: "<name or handle>", date_from: "YYYY-MM-DD")` |
| Resolve contact email | `resolve_contact(query: "<name>")` |
| Get contact details | `get_contact(contact: "<name or handle>")` |
| List top contacts | `list_contacts(sort_by: "recent", limit: 50)` |

### Gmail & Calendar — Claude connectors (available in interactive + cron)

| Action | Tool |
|---|---|
| Search Gmail threads | `mcp__claude_ai_Gmail__search_threads(query: "newer_than:1d -in:promotions", pageSize: 20)` |
| Read a Gmail thread | `mcp__claude_ai_Gmail__get_thread(threadId)` |
| List calendar events | `mcp__claude_ai_Google_Calendar__list_events(calendarId: "primary", timeMin, timeMax)` |
| Create event | `mcp__claude_ai_Google_Calendar__create_event(calendarId: "primary", summary, start, end, ...)` |
| Update event | `mcp__claude_ai_Google_Calendar__update_event(calendarId, eventId, ...)` |
