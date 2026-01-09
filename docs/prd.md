# PRD: Test Data Product

## Overview
This is a test PRD to verify the CLI tool works correctly.

## Goal
Test the Vulcan PRD CLI publishing functionality.

## Consumers
- Data Team
- Analytics Team

## Grain
Daily aggregated data

## Entities
- User (user_id)
- Event (event_id)

## Primary Time
- Field: event_timestamp
- Timezone: UTC
- Meaning: When the event occurred

## Dimensions
- user_id
- event_type
- date

## Measures
- event_count (unit: count)
- total_value (unit: dollars)

## Metrics
- Daily Active Users (definition: Count of unique users per day)
- Event Rate (definition: Events per user per day)

## Sources
- System: PostgreSQL
- Table: events
- Owner: Data Engineering Team

## Freshness & Backfill
- Cadence: Daily
- SLA: 24 hours
- Backfill Window: 90 days


