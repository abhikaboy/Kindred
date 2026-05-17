# Kindred Intern: 4-Week Scope

## Role

Product & analytics intern. Non-engineering, non-visual. Focused on defining product direction, building analytics foundations, and creating content that drives user engagement.

---

## Week 1: Product Immersion & Analytics Foundation

**Goal:** Understand the product deeply and set up measurement infrastructure.

### Deliverables
- [ ] Use the app daily as a real user — create tasks, complete them, send kudos, post updates, try voice input, explore blueprints
- [ ] Document the full user journey from onboarding to daily use — note friction points, confusion, delight moments
- [ ] Competitive teardown of 3 apps (Todoist, Forest, Finch) — onboarding flow, engagement hooks, monetization, where users complain (Reddit, App Store reviews)
- [ ] Define core metrics and build PostHog dashboards:
  - **Activation:** What action predicts a user coming back on Day 2? (hypothesis: completing first task, or closing a ring)
  - **Engagement:** Daily ring closure rates (Plan/Do/Share individually), tasks created vs completed ratio
  - **Retention:** Day 1, Day 7, Day 14, Day 30 cohort retention
  - **Social:** % of users who send at least 1 kudos in first week, posts per active user
  - **Conversion funnel:** Onboarding start → complete → first task → first ring closed → all rings closed

---

## Week 2: User Research & Blueprint Strategy

**Goal:** Talk to real people and build the content library that drives discovery.

### User Research
- [ ] Conduct 8-10 user interviews (current beta users or target audience)
  - What productivity tools do they currently use and why?
  - What would make them open Kindred daily?
  - Show them the rings — does the Plan/Do/Share framing resonate?
  - How would they want to receive productivity feedback? (morning summary, evening recap, in-the-moment nudge)
  - What would make them share/recommend Kindred?
- [ ] Synthesize findings into a 1-page insights doc with top 5 takeaways

### Blueprint Content
- [ ] Research popular productivity frameworks and templates people search for
- [ ] Create 20 high-quality blueprints across categories:
  - **Students:** MCAT prep, thesis writing, exam study schedules, semester planning
  - **Fitness:** Marathon training, gym routines, yoga challenges, meal prep
  - **Career:** Job search tracker, interview prep, 30-60-90 day plan, side project launch
  - **Daily life:** Morning routine, apartment move checklist, travel planning, weekly meal prep
  - **Creative:** Writing habit, learn guitar, photography project, 30-day drawing challenge
- [ ] Each blueprint should have: clear name, description, 3-6 categories with realistic tasks, appropriate recurrence rules

---

## Week 3: Productivity Agent — Product Definition

**Goal:** Define what the productivity agent is, how it works, and what it delivers.

### Research Phase
- [ ] Audit existing AI capabilities in the app (AnalyticsReportFlow, voice input, NL task creation) — understand what's already built
- [ ] Review user interview data from Week 2 — what feedback format do people actually want?
- [ ] Analyze what data is available for personalization: ring history, activity trends, task completion patterns, recurring task streaks, category usage

### Spec: Passive Reports
- [ ] Define report cadence and content:
  - **Daily morning brief** — what's ahead today, ring goals, any overdue tasks
  - **Weekly recap** — rings closed, score trend, best day, category breakdown, comparison to prior week
- [ ] Define where reports live in the app (Activity tab? Dashboard card? Push notification that opens a detail view?)
- [ ] Write 5 example reports using real-looking data — make them feel personal, not generic
- [ ] Define what "good" vs "bad" looks like — when is a report useful vs noise?

### Spec: Proactive Nudges
- [ ] Define trigger conditions:
  - Ring-based: "It's 3pm and your Do ring is empty"
  - Pattern-based: "You usually plan tasks in the morning — nothing scheduled yet today"
  - Celebration: "3-day streak of closing all rings!"
  - Social: "Your friend just closed all their rings today"
- [ ] Define frequency rules:
  - Max nudges per day (2-3?)
  - Respect existing check-in frequency setting (None/Occasionally/Regularly/Frequently)
  - Time windows (no nudges before 8am or after 9pm in user's timezone)
  - Cool-down after dismissal
- [ ] Define tone and voice — write 15-20 example nudge messages
- [ ] Map nudge triggers to existing data sources — what can be done with simple rules vs what needs AI

### Deliverable
- [ ] Written product spec (3-5 pages) covering: user problem, solution, report content, nudge triggers, UX flow, data requirements, success metrics, open questions
- [ ] Present spec to Abhik for feedback

---

## Week 4: Validate, Refine, Ship Blueprints

**Goal:** Validate the agent spec with users, finalize blueprints, hand off clean work.

### Agent Spec Validation
- [ ] Share the productivity agent spec with 5 users from Week 2 interviews
  - Show example reports — would they read these?
  - Show example nudges — helpful or annoying?
  - What's missing? What would they delete?
- [ ] Revise spec based on feedback — final version ready for engineering

### Blueprint Polish & Launch
- [ ] Expand to 30+ blueprints based on what resonated in user interviews
- [ ] QA all blueprints in the app — do tasks make sense, are recurrence rules correct?
- [ ] Organize blueprints by discovery category for the search/explore tab

### Analytics Review
- [ ] Pull first insights from PostHog dashboards (if enough data exists)
- [ ] Document baseline metrics — this is the "before" snapshot
- [ ] Identify 2-3 data-driven recommendations (e.g., "onboarding drops off at step 5, consider simplifying")

### Handoff
- [ ] Final deliverables doc:
  - PostHog dashboard links + metric definitions
  - User research insights (1-pager)
  - Productivity agent product spec (final)
  - Blueprint library (30+ published)
  - Competitive teardowns (3 apps)
  - Recommendations for next quarter

---

## Success Criteria

By end of 4 weeks, the intern has delivered:
1. **Working PostHog dashboards** tracking activation, engagement, retention, and ring metrics
2. **30+ published blueprints** across 5+ categories
3. **Productivity agent product spec** validated by 5 users, ready for engineering
4. **User research synthesis** with actionable insights
5. **Competitive analysis** of 3 key competitors
