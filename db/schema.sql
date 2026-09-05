-- =============================================================================
-- Tin City Founders — event schema (SQLite)
--
-- Three structural changes from the current in-memory model:
--
--   1. EVENT is the top-level entity. Today there is one implicit global room,
--      so "what happened last month" is unanswerable. Everything now hangs off
--      an event.
--
--   2. SEGMENT replaces three overlapping concepts — RoomPhase (6 values),
--      RoundKind (3 values) and the canSubmit/canNominate/canJoin capability
--      flags. Any real activity was a combination of all three, and nothing
--      stopped an incoherent one (trustee phase + problem ballot + squad
--      joining). A segment is one answer to "what are we doing right now".
--
--   3. ONE VOTE TABLE. There were two parallel systems — ambient vote records
--      driving the card counts, and round ballots driving the results screen.
--      They disagreed on purpose and confused the host live. Every vote now
--      belongs to a segment.
--
-- Carried over deliberately from the current server:
--   - counts are DERIVED from votes, never incremented in place
--   - one vote per device per target, enforced by the database not a Set
--   - at most one live segment, enforced by a partial unique index
--   - nothing depends on a long-lived timer; expiry is a timestamp read at query
--
-- Requires: PRAGMA foreign_keys = ON;  (SQLite defaults it OFF per connection)
-- =============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;   -- concurrent reads while a vote is being written

-- ---------------------------------------------------------------------------
-- PEOPLE — global, so "who has been to four meetups" is answerable.
--
-- Identity is the tcf_vid cookie. It is imperfect: clearing site data or
-- switching phones creates a new person. That is the best available signal
-- without asking people to sign in, which we deliberately do not do. Treat
-- cross-event counts as indicative, not exact.
-- ---------------------------------------------------------------------------
CREATE TABLE people (
  id            TEXT PRIMARY KEY,           -- tcf_vid
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',   -- '' means unset. Never invent a default.
  bio           TEXT NOT NULL DEFAULT '',
  give_ask      TEXT NOT NULL DEFAULT '',   -- highest-value field at a mixer
  location      TEXT NOT NULL DEFAULT '',
  avatar_color  TEXT NOT NULL DEFAULT '#0D4734',
  first_seen_at INTEGER NOT NULL,           -- epoch ms
  last_seen_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE person_tags (
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (person_id, tag)
) STRICT;

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,                 -- "September Mixer"
  status     TEXT NOT NULL DEFAULT 'draft'
             CHECK (status IN ('draft','live','archived')),
  starts_at  INTEGER,
  ends_at    INTEGER,
  created_at INTEGER NOT NULL
) STRICT;

-- Only one event live at a time. The room can't be two evenings at once.
CREATE UNIQUE INDEX one_live_event ON events((1)) WHERE status = 'live';

-- Attendance: a person at an event. This is what makes returning attendees
-- visible, and keeps a person's profile from being duplicated per event.
CREATE TABLE attendances (
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id    TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  checked_in_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, person_id)
) STRICT;

-- ---------------------------------------------------------------------------
-- SECTORS — the fixed taxonomy. Global, not per event.
-- ---------------------------------------------------------------------------
CREATE TABLE sectors (
  name        TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  icon_name   TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
) STRICT;

-- ---------------------------------------------------------------------------
-- SEGMENTS — the run of show. One row per activity.
--
-- `kind` is the host's mental model, and the columns below it are what the app
-- actually reads. Storing both means the host picks one thing from a list while
-- the behaviour stays explicit and overridable.
-- ---------------------------------------------------------------------------
CREATE TABLE segments (
  id       TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,                -- order in the run of show

  kind TEXT NOT NULL CHECK (kind IN (
    'welcome',            -- check in, browse the room
    'pitch_ideas',        -- audience submits ideas
    'pitch_problems',     -- audience submits problems
    'vote_submissions',   -- vote on ideas/problems (audience- or admin-authored)
    'nominate_trustees',  -- audience puts names forward
    'vote_trustees',      -- vote on trustees
    'build_teams',        -- form teams around submissions
    'matchmaking',        -- who should you talk to, from give_ask
    'open_floor'          -- browse, no collection, no ballot
  )),

  title  TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',          -- one line shown to the room

  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending','live','revealed','closed')),

  -- What the audience may CREATE during this segment.
  collects TEXT CHECK (collects IN ('problem','idea','trustee','team')),

  -- What is on the ballot, if anything.
  ballot_source TEXT CHECK (ballot_source IN ('submissions','trustees','sectors')),
  -- NULL = the whole pool. Otherwise a JSON array of ids: the option picker.
  ballot_option_ids TEXT CHECK (ballot_option_ids IS NULL OR json_valid(ballot_option_ids)),
  max_selections INTEGER NOT NULL DEFAULT 1 CHECK (max_selections >= 1),

  -- Results snapshot written when the segment closes, so a tally never has to
  -- be recomputed from votes that may since have been deleted.
  results TEXT CHECK (results IS NULL OR json_valid(results)),

  opened_at  INTEGER,
  closed_at  INTEGER,
  -- Replaces the in-memory reveal timer, which never survived a restart.
  -- A revealed segment past this instant is treated as closed on read.
  reveal_until INTEGER
) STRICT;

CREATE INDEX segments_by_event ON segments(event_id, position);

-- At most one segment live or revealed at a time, across the whole app.
CREATE UNIQUE INDEX one_live_segment
  ON segments((1)) WHERE status IN ('live','revealed');

-- ---------------------------------------------------------------------------
-- SUBMISSIONS — problems and ideas are one entity.
--
-- They are different framings, not different data: title, description, sector,
-- votes, people who commit. Two tables would duplicate voting, ballots,
-- deletion and history for the sake of a label.
-- ---------------------------------------------------------------------------
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  -- A submission OUTLIVES the event that raised it. A problem raised in
  -- September is still on the board in October, carrying its history with it.
  -- These record provenance only, and go NULL rather than cascading, so
  -- deleting an old event never destroys the problems raised there.
  origin_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  segment_id      TEXT REFERENCES segments(id) ON DELETE SET NULL,

  kind        TEXT NOT NULL CHECK (kind IN ('problem','idea')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sector      TEXT REFERENCES sectors(name) ON UPDATE CASCADE,

  author_id   TEXT REFERENCES people(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT '',    -- kept for display if the person is gone

  status TEXT NOT NULL DEFAULT 'open'
         CHECK (status IN ('open','shortlisted','team_formed','built','archived')),

  created_at INTEGER NOT NULL
) STRICT;

-- The board is filtered by STATUS, not by event: a submission stays in play
-- until it is built or archived. That is what "submissions survive" means in
-- practice — the host retires stale entries rather than the calendar doing it.
CREATE INDEX submissions_by_status ON submissions(status, kind);
CREATE INDEX submissions_by_origin ON submissions(origin_event_id);

CREATE TABLE submission_skills (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  skill         TEXT NOT NULL,             -- same vocabulary as person_tags
  PRIMARY KEY (submission_id, skill)
) STRICT;

CREATE TABLE submission_comments (
  id            TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  author_id     TEXT REFERENCES people(id) ON DELETE SET NULL,
  author_name   TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
) STRICT;

-- ---------------------------------------------------------------------------
-- TRUSTEES — org-level, not per event, but nominated during one.
-- ---------------------------------------------------------------------------
CREATE TABLE trustees (
  id          TEXT PRIMARY KEY,
  seat_number INTEGER NOT NULL,
  name        TEXT NOT NULL,
  title_or_org TEXT NOT NULL DEFAULT '',
  bio         TEXT NOT NULL DEFAULT '',
  -- Never exposed on any unauthenticated payload. Host-only.
  contact     TEXT NOT NULL DEFAULT '',

  -- 0 means NOT YET SCORED. A floor nomination must not read as a perfect
  -- candidate — that misled the host when choosing who signs a legal document.
  score_r INTEGER NOT NULL DEFAULT 0 CHECK (score_r BETWEEN 0 AND 5),
  score_n INTEGER NOT NULL DEFAULT 0 CHECK (score_n BETWEEN 0 AND 5),
  score_t INTEGER NOT NULL DEFAULT 0 CHECK (score_t BETWEEN 0 AND 5),

  reachable INTEGER NOT NULL DEFAULT 0 CHECK (reachable IN (0,1)),
  confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1)),
  -- CAMA 2020 disqualification checks; all default false for a floor nomination.
  cama_over_18       INTEGER NOT NULL DEFAULT 0 CHECK (cama_over_18 IN (0,1)),
  cama_sound_mind    INTEGER NOT NULL DEFAULT 0 CHECK (cama_sound_mind IN (0,1)),
  cama_not_bankrupt  INTEGER NOT NULL DEFAULT 0 CHECK (cama_not_bankrupt IN (0,1)),
  cama_no_fraud      INTEGER NOT NULL DEFAULT 0 CHECK (cama_no_fraud IN (0,1)),

  notes             TEXT NOT NULL DEFAULT '',   -- host-only; never published
  nominated_by      TEXT NOT NULL DEFAULT '',
  nominated_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  created_at        INTEGER NOT NULL
) STRICT;

CREATE INDEX trustees_by_seat ON trustees(seat_number);

-- ---------------------------------------------------------------------------
-- TEAMS — absorbs the old "squads".
--
-- Squads were people committing to a problem, stored as a list of DISPLAY
-- NAMES, so two people called David were indistinguishable. Membership now
-- references person ids.
-- ---------------------------------------------------------------------------
CREATE TABLE teams (
  id       TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  -- A team usually forms around a submission, but need not.
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  lead_person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  -- Who created it: the host, or someone on the floor.
  created_by TEXT NOT NULL DEFAULT 'host' CHECK (created_by IN ('host','audience')),
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE team_members (
  team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT '',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, person_id)
) STRICT;

-- ---------------------------------------------------------------------------
-- VOTES — one table, always attached to a segment.
--
-- target_id is polymorphic by target_kind (submission / trustee / sector).
-- Deliberately not a foreign key: one column cannot reference three tables.
-- Deleting a target must delete its votes explicitly.
-- ---------------------------------------------------------------------------
CREATE TABLE votes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  person_id  TEXT NOT NULL,                -- tcf_vid; not a FK so a vote survives
                                           -- a person record being removed
  target_kind TEXT NOT NULL CHECK (target_kind IN ('submission','trustee','sector')),
  target_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,

  -- One vote per device per target per segment. This is the integrity
  -- guarantee that used to live in an in-memory Set.
  UNIQUE (segment_id, person_id, target_id)
) STRICT;

CREATE INDEX votes_tally ON votes(segment_id, target_kind, target_id);
CREATE INDEX votes_by_person ON votes(segment_id, person_id);

-- ---------------------------------------------------------------------------
-- ANNOUNCEMENTS — expiry is a timestamp, not a setTimeout.
-- ---------------------------------------------------------------------------
CREATE TABLE announcements (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

-- =============================================================================
-- DERIVED COUNTS — views, not stored columns.
--
-- The current server recomputes counts from vote records rather than
-- incrementing, so a count can never drift from the ballots behind it. A view
-- makes that structural: there is no count to drift.
-- =============================================================================

CREATE VIEW submission_tallies AS
SELECT s.id AS submission_id,
       v.segment_id,
       COUNT(*) AS votes
FROM submissions s
JOIN votes v ON v.target_kind = 'submission' AND v.target_id = s.id
GROUP BY s.id, v.segment_id;

CREATE VIEW trustee_tallies AS
SELECT t.id AS trustee_id, v.segment_id, COUNT(*) AS votes
FROM trustees t
JOIN votes v ON v.target_kind = 'trustee' AND v.target_id = t.id
GROUP BY t.id, v.segment_id;

CREATE VIEW sector_tallies AS
SELECT sec.name AS sector, v.segment_id, COUNT(*) AS votes
FROM sectors sec
JOIN votes v ON v.target_kind = 'sector' AND v.target_id = sec.name
GROUP BY sec.name, v.segment_id;

-- Ballots cast in a segment = distinct people who voted in it.
CREATE VIEW segment_turnout AS
SELECT segment_id, COUNT(DISTINCT person_id) AS ballots_cast
FROM votes GROUP BY segment_id;

-- What is on the board right now, regardless of which event raised it.
CREATE VIEW active_submissions AS
SELECT * FROM submissions WHERE status IN ('open','shortlisted');

-- How a surviving submission has fared across events.
CREATE VIEW submission_history AS
SELECT s.id, s.title, s.kind, s.status,
       seg.event_id, e.name AS event_name, seg.id AS segment_id,
       COUNT(v.id) AS votes
FROM submissions s
JOIN votes v   ON v.target_kind = 'submission' AND v.target_id = s.id
JOIN segments seg ON seg.id = v.segment_id
JOIN events e  ON e.id = seg.event_id
GROUP BY s.id, seg.id;

-- Cross-event history: the thing the current model cannot answer at all.
CREATE VIEW person_attendance_history AS
SELECT p.id, p.name, COUNT(a.event_id) AS events_attended,
       MIN(a.checked_in_at) AS first_event, MAX(a.checked_in_at) AS latest_event
FROM people p LEFT JOIN attendances a ON a.person_id = p.id
GROUP BY p.id, p.name;
