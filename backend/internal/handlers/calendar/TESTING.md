# Calendar Converter Unit Tests

## Overview

Comprehensive unit tests for the calendar event-to-task conversion logic in `converter.go`.

## Test Coverage

### 1. TestConvertEventToTaskParams

Tests the main conversion function with various event types:

#### Basic Timed Event
- Verifies standard event with start/end times
- Checks all field mappings (content, integration, priority, value)
- Validates StartTime, StartDate, and Deadline are set correctly
- Ensures StartDate is normalized to midnight

#### All-Day Event
- Tests events without specific times
- Verifies StartTime is NOT set (nil)
- Confirms StartDate and Deadline are set to date boundaries
- Validates proper handling of multi-day all-day events

#### Event with No Description or Location
- Tests minimal event data
- Verifies notes only contain available fields
- Ensures empty fields don't create extra newlines

#### Multi-Day Event
- Tests events spanning multiple days
- Validates correct start and end times across days
- Ensures proper date range handling

#### Event with Multiple Attendees
- Tests attendee list formatting
- Verifies comma-separated attendee list in notes
- Checks proper formatting of all note fields

### 2. TestBuildEventNotes

Tests the note formatting helper function:

#### All Fields Present
- Tests complete event with all optional fields
- Verifies proper formatting and ordering
- Checks newline separation

#### Only Calendar and Status
- Tests minimal event data
- Ensures no extra blank lines

#### No Attendees
- Tests event without attendees
- Verifies attendees field is omitted when empty

#### Single Attendee
- Tests single attendee formatting
- Ensures no comma in single-attendee case

#### Empty Event
- Tests completely empty event
- Verifies empty string result

#### Multiline Description
- Tests description with newlines
- Ensures newlines are preserved in notes

### 3. TestConvertEventToTaskParams_IntegrationFormat

Tests the integration ID format:

#### Standard IDs
- Tests simple calendar and event IDs
- Verifies format: `"gcal:{calendar_id}:{event_id}"`

#### Email as Calendar ID
- Tests email addresses as calendar IDs
- Ensures proper handling of @ symbol

#### Complex Calendar ID
- Tests Google group calendar IDs
- Verifies handling of dots and underscores

### 4. TestConvertEventToTaskParams_TimeZones

Tests timezone handling:

#### PST Timezone
- Tests Pacific Standard Time events
- Verifies timezone is preserved in times

#### EST Timezone
- Tests Eastern Standard Time events
- Ensures correct timezone conversion

### 5. TestConvertEventToTaskParams_EdgeCases

Tests edge cases and special scenarios:

#### Empty Summary
- Tests event with no title
- Ensures no panic or error

#### Very Long Summary
- Tests extremely long event titles
- Verifies no truncation or issues

#### Special Characters in Summary
- Tests @, &, (), and other special chars
- Ensures proper handling without escaping

#### Event at Midnight
- Tests events starting at 00:00
- Verifies proper date/time handling

#### Event Spanning Midnight
- Tests events that cross day boundary
- Ensures correct multi-day handling

## Test Results

```
=== RUN   TestConvertEventToTaskParams
=== RUN   TestConvertEventToTaskParams/basic_timed_event
=== RUN   TestConvertEventToTaskParams/all-day_event
=== RUN   TestConvertEventToTaskParams/event_with_no_description_or_location
=== RUN   TestConvertEventToTaskParams/multi-day_event
=== RUN   TestConvertEventToTaskParams/event_with_multiple_attendees
--- PASS: TestConvertEventToTaskParams (0.00s)

=== RUN   TestBuildEventNotes
=== RUN   TestBuildEventNotes/all_fields_present
=== RUN   TestBuildEventNotes/only_calendar_and_status
=== RUN   TestBuildEventNotes/no_attendees
=== RUN   TestBuildEventNotes/single_attendee
=== RUN   TestBuildEventNotes/empty_event
=== RUN   TestBuildEventNotes/multiline_description
--- PASS: TestBuildEventNotes (0.00s)

=== RUN   TestConvertEventToTaskParams_IntegrationFormat
=== RUN   TestConvertEventToTaskParams_IntegrationFormat/standard_IDs
=== RUN   TestConvertEventToTaskParams_IntegrationFormat/email_as_calendar_ID
=== RUN   TestConvertEventToTaskParams_IntegrationFormat/complex_calendar_ID
--- PASS: TestConvertEventToTaskParams_IntegrationFormat (0.00s)

=== RUN   TestConvertEventToTaskParams_TimeZones
=== RUN   TestConvertEventToTaskParams_TimeZones/PST_timezone
=== RUN   TestConvertEventToTaskParams_TimeZones/EST_timezone
--- PASS: TestConvertEventToTaskParams_TimeZones (0.00s)

=== RUN   TestConvertEventToTaskParams_EdgeCases
=== RUN   TestConvertEventToTaskParams_EdgeCases/empty_summary
=== RUN   TestConvertEventToTaskParams_EdgeCases/very_long_summary
=== RUN   TestConvertEventToTaskParams_EdgeCases/special_characters_in_summary
=== RUN   TestConvertEventToTaskParams_EdgeCases/event_at_midnight
=== RUN   TestConvertEventToTaskParams_EdgeCases/event_spanning_midnight
--- PASS: TestConvertEventToTaskParams_EdgeCases (0.00s)

PASS
ok  	github.com/abhikaboy/Kindred/internal/handlers/calendar	0.237s
```

## Running Tests

```bash
# Run all calendar package tests
cd backend && go test ./internal/handlers/calendar -v

# Run only converter tests
cd backend && go test ./internal/handlers/calendar -run TestConvert -v

# Run specific test
cd backend && go test ./internal/handlers/calendar -run TestConvertEventToTaskParams/basic_timed_event -v

# Run with coverage
cd backend && go test ./internal/handlers/calendar -cover
```

## Coverage

The tests cover:
- ✅ All event types (timed, all-day, multi-day)
- ✅ Field mapping logic
- ✅ Integration ID format
- ✅ Timezone handling
- ✅ Note formatting
- ✅ Edge cases and special characters
- ✅ Empty and minimal data scenarios
- ✅ Default value assignment

## What's Tested

### Field Mappings
- `event.Summary` → `task.Content` ✅
- `event.StartTime` → `task.StartTime` ✅
- `event.StartTime` (date) → `task.StartDate` ✅
- `event.EndTime` → `task.Deadline` ✅
- `event.Description` + `event.Location` + `event.Attendees` → `task.Notes` ✅
- `event.ID` + `event.CalendarID` → `task.Integration` ✅

### Default Values
- `Priority: 2` ✅
- `Value: 5.0` ✅
- `Public: false` ✅
- `Recurring: false` ✅
- `Active: true` ✅
- `Checklist: []` ✅
- `Reminders: []` ✅

### Special Handling
- All-day events (no StartTime) ✅
- Multi-day events ✅
- Events with/without attendees ✅
- Events with/without location ✅
- Events with/without description ✅
- Timezone preservation ✅
- Midnight boundary events ✅
