# claude_goal

My reading of what this project is actually for, inferred from the decisions made
across the build rather than from any statement of intent. Written to be argued
with — where it is wrong, the disagreement is the useful part.

## The end goal

**A standing record of what Plateau's founders say is broken, who they trust to
act on it, and what actually got done — with the mixer as the periodic moment
where that record gets decided on, not as the product itself.**

The app began as a console for one evening in Jos. Everything chosen since has
quietly pulled against that framing, and the priority shift — *"we don't need the
mixer urgently, what we need is the long form activity"* — named it out loud.

## Why I read it that way

Four decisions, none of which a single-evening tool would need:

**Submissions survive events; teams die with them.** Asked what persists across
the boundary, the answer split cleanly: sectors fixed, submissions survive, teams
die. That is a description of an institution — durable subject matter, durable
categories, disposable working groups. A problem raised in October is the same
problem in March, still open, with a longer history behind it.

**Problems flow into the mixer, not out of it.** *"People bring up issues over the
month, mixer day some are selected to be used in mixer."* The month is where the
substance accumulates. The mixer is a decision ritual applied to a backlog that
already exists — which inverts what the app was built to do, where the evening
generated everything from nothing.

**Trustees are representation, not a game mechanic.** The endorsement flow was
worth closing a live vulnerability over. A leaderboard would not have been. If
trustees carry authority between events, their legitimacy has to survive the
event that produced it.

**Identity outlived the evening before anything else did.** The newest feature
lets someone recover their profile on a different device months later and keep
their votes. Nothing about one night needs that. It is the difference between an
attendee and a member, and it shipped first — which says something.

## What follows from it

If this reading is right, three things change in priority.

**Permanence is the product, not the plumbing.** The move off ephemeral hosting
read as infrastructure hygiene. Under this goal it is the foundation: a problem's
value is its trail over months, and a wipe destroys the asset rather than
inconveniencing a night. The same logic makes the vote-integrity work
disproportionately important — a tally that can be gamed is a record no one will
cite later.

**The audience UI has to work with nobody driving.** The 3 September complaint —
too complex, people expected to navigate themselves — reads as a polish problem
in mixer mode, where a host can narrate around it. In extended mode there is no
host and no shared screen. A phone that only makes sense with someone explaining
it does not work at all. `free_roam` is the honest starting point; the other five
phase blocks are scaffolding for a mode that is becoming the minority case.

**The mixer becomes a segment type, not the architecture.** Phases, round kinds
and capability flags all encode "the host is driving." The merged `segments`
schema is the right direction because it makes host-driven one option among
several rather than the frame everything sits inside.

## What blocks it, concretely

Known and verified, not speculative:

- `one_live_segment` (`db/schema.sql:147`) is global across all events. Extended
  mode needs many concurrent open segments; the constraint permits one.
- No `opens_at` / `closes_at`. Without a host to open and close things, segments
  need a clock.
- `votes.segment_id` is `NOT NULL`, but ten `recordVote` call sites fire outside
  any round. Ambient participation — the extended-mode default — has nowhere to
  record itself.
- Recovery is phone-trust: knowing a number is enough to become someone. Fine for
  a room where everyone has each other's numbers. Weak for a record meant to be
  cited months later by people who were not there.

## Where I could be wrong

The strongest counter-reading is that the mixer *is* the point — that the energy
of the room is the product, extended mode is a between-events holding pattern to
keep people warm, and building for the long tail optimises the quiet part at the
expense of the loud one. If that is nearer the truth, the audience simplification
still matters, but the record-keeping is overbuilt and the schema work can wait a
long time.

I do not think that is it. But the difference decides what gets built next, so it
is worth saying which one is being aimed at.
