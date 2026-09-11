import { SuggestSector } from './SuggestSector';
import { PastBallots } from './PastBallots';
import { SquadJoin, SquadRoster } from './SquadJoin';
import React, { useEffect, useState } from 'react';
import { Search, Plus, ThumbsUp, Users, ArrowRight, MessageSquare, X } from 'lucide-react';
import type { AttendeeProfile, CategoryInfo, PlateauProblem, VotingRound, MyVotes, TrusteeCandidate, Spotlight } from '../types';
import { BrandLogo } from './BrandLogo';
import { AttendeeDirectory } from './AttendeeDirectory';
import { SeamlessProblemWizard } from './SeamlessProblemWizard';
import { RoundDeadline } from './RoundDeadline';
import { CommunityBallot } from './CommunityBallot';
import { SpotlightCard } from './SpotlightCard';
import { plural } from '../utils/format';
import { useCapped, ShowMore } from './ShowMore';

interface Props {
  problems: PlateauProblem[];
  attendees: AttendeeProfile[];
  categories: CategoryInfo[];
  trustees: TrusteeCandidate[];
  profile: AttendeeProfile | null;
  myVotes: MyVotes;
  round: VotingRound | null;
  lastRound: VotingRound | null;
  onVote: (id: string, commit: boolean, name?: string, skill?: string) => Promise<void>;
  onVoteCategory: (name: string) => Promise<void>;
  onVoteTrustee: (id: string) => Promise<void>;
  onSubmit: React.ComponentProps<typeof SeamlessProblemWizard>['onSubmit'];
  onComment: (id: string, author: string, text: string) => Promise<void>;
  onProfile: () => void;
  onJoin: () => void;
  // Opens check-in already flipped to "find my profile".
  onRecover: () => void;
  onMixer: () => void;
  onHost?: () => void;
  syncStatus: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  onReconnect: () => void;
  // The spotlight used to render in App, above this component and outside the
  // layout it owns, so nothing could budget for its height. It lives here now.
  spotlight: Spotlight | null;
  spotlightHistory: Spotlight[];
  isFirstVisit: boolean;
  // False until the first server snapshot arrives.
  loaded: boolean;
  // Whether this device has already voted in the open round. The full ballot
  // object was passed and never read; this is the one fact the card needs.
  ballotCast: boolean;
  // A mixer is running right now. Not derivable from activePhase, which always
  // holds a value; see RoomSessionState.mixerLive.
  mixerLive: boolean;
}

type View = 'problems' | 'members' | 'sectors' | 'trustees' | 'ballot' | 'history';
const NAMED_VIEWS: View[] = ['members', 'sectors', 'trustees', 'history'];

// Every section now has its own URL. Previously four of them shared one — the
// view param was DELETED for anything but history — so browsing members →
// sectors → trustees stacked three identical history entries and Back always
// resolved to Challenges. Challenges keeps the bare URL as the natural home,
// which is still distinct from the four named ones.
function readViewFromUrl(): View {
  const params = new URLSearchParams(window.location.search);
  if (params.has('round')) return 'ballot';
  const named = params.get('view') as View | null;
  return named && NAMED_VIEWS.includes(named) ? named : 'problems';
}

export function CommunityView(p: Props) {
  const [linkedRound, setLinkedRound] = useState(() => new URLSearchParams(window.location.search).get('round'));
  const [view, setView] = useState<View>(readViewFromUrl);
  useEffect(() => {
    const navigate = () => {
      setLinkedRound(new URLSearchParams(window.location.search).get('round'));
      setView(readViewFromUrl());
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);
  const openSection = (section: Exclude<View, 'ballot'>) => {
    const url = new URL(window.location.href); url.searchParams.delete('round');
    if (section === 'problems') url.searchParams.delete('view'); else url.searchParams.set('view', section);
    window.history.pushState({}, '', url); setLinkedRound(null); setView(section);
  };
  const openBallot = (id: string) => {
    const url = new URL(window.location.href); url.searchParams.set('round', id); url.searchParams.set('mode', 'community');
    window.history.pushState({}, '', url); setLinkedRound(id); setView('ballot');
  };
  // Dismissal of the join/recover prompt is per-device and remembered. The Join
  // button in the header is always there, so dismissing never traps anyone.
  const [guestPromptDismissed, setGuestPromptDismissed] = useState(() => {
    try { return localStorage.getItem('tcf_guest_prompt_dismissed') === '1'; } catch { return false; }
  });
  const dismissGuestPrompt = () => {
    setGuestPromptDismissed(true);
    try { localStorage.setItem('tcf_guest_prompt_dismissed', '1'); } catch {}
  };
  // "What's new since you were last here", kept entirely on the device. No
  // server state and nothing recorded about anyone: a timestamp in localStorage,
  // read once on mount and immediately advanced, so this visit is the baseline
  // for the next one. A first-ever visit has no baseline and shows nothing —
  // everything is new, which is not news.
  const [lastSeen] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('tcf_last_seen');
      localStorage.setItem('tcf_last_seen', String(Date.now()));
      return stored ? Number(stored) : null;
    } catch { return null; }
  });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!detailId) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetailId(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [detailId]);
  const detail = p.problems.find(item => item.id === detailId);
  const round = p.round || p.lastRound;
  const act = async (key: string, action: () => Promise<void>) => {
    // A silent bounce into the check-in modal was the single most confusing
    // thing on this screen: the button looked live, nothing happened, and a
    // form appeared with no stated connection to what was pressed.
    if (!p.profile) {
      setError('Add your name first — it takes about ten seconds, and it is what shows beside your support.');
      p.onJoin();
      return;
    }
    setBusy(key); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(null); }
  };
  const button = 'px-4 py-2.5 rounded-xl border border-[#0D4734]/25 text-sm font-bold hover:bg-[#EBF3EF] disabled:opacity-50';
  // A round you have not voted in counts as new whenever it opened, because the
  // ask is still outstanding; challenges and spotlights count only if they
  // appeared since the last visit.
  const whatsNew: { label: string; go: () => void }[] = [];
  if (lastSeen !== null) {
    const freshProblems = p.problems.filter(item => Date.parse(item.createdAt) > lastSeen).length;
    if (freshProblems) whatsNew.push({ label: `${plural(freshProblems, 'new challenge')} to look at`, go: () => openSection('problems') });
    if (p.round?.status === 'open' && !p.ballotCast) whatsNew.push({ label: `A ballot is open: ${p.round.title}`, go: () => openBallot(p.round!.id) });
    if (p.spotlight && p.spotlight.startedAt > lastSeen) whatsNew.push({ label: `${p.spotlight.name} is in the spotlight`, go: () => openSection('problems') });
  }
  const filtered = p.problems.filter(item => (category === 'All' || item.category === category) && `${item.title} ${item.description} ${item.submittedBy}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'votes' ? b.upvotes - a.upvotes : sort === 'squads' ? b.commitments - a.commitments : b.createdAt.localeCompare(a.createdAt));
  // Filtering runs over every challenge; only rendering is capped.
  const cappedProblems = useCapped<PlateauProblem>(filtered, `${query}|${category}|${sort}`);

  return <div className="min-h-screen bg-[#F6F3EC] text-[#09251B]">
    {/* One row, always. The old header wrapped to three on a phone because it
        carried a full wordmark plus four buttons, two of which were only
        meaningful to a host. */}
    <header className="bg-white border-b-2 border-[#09251B] px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* The full wordmark is ~250px and pushed the profile button off a
            375px screen. Mark only on a phone, wordmark from sm up. */}
        <button onClick={() => openSection('problems')} aria-label="Community home" className="shrink-0">
          <span className="sm:hidden"><BrandLogo variant="icon-only" /></span>
          <span className="hidden sm:block"><BrandLogo variant="full" /></span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {/* Silent while healthy. A permanent "● Connected" badge is a status
              light nobody reads until it is wrong. */}
          {p.syncStatus !== 'connected' && (
            <button className="text-xs font-bold px-2 py-2 text-amber-700 underline" onClick={p.onReconnect}>
              {p.syncStatus === 'offline' ? 'Offline · Retry' : 'Reconnecting…'}
            </button>
          )}
          {/* Only during an actual event. A host device keeps it so a mixer can
              be set up before it is switched on. */}
          {/* When a mixer IS live this must show on a phone — the attendee in the
              room is the whole audience for it. The host-only "set one up"
              variant is what gets hidden on small screens. */}
          {p.mixerLive && (
            <button className={`${button} bg-[#E5A93C] border-[#09251B]`} onClick={p.onMixer}>
              Mixer is live
            </button>
          )}
          {!p.mixerLive && p.onHost && (
            <button className={`${button} hidden sm:inline-block`} onClick={p.onMixer}>Mixer mode</button>
          )}
          {p.onHost && <button className={`${button} hidden sm:inline-block`} onClick={p.onHost}>Host console</button>}
          <button className={`${button} flex items-center gap-2`} onClick={p.profile ? p.onProfile : p.onJoin}>
            {p.profile
              ? <>
                  <span className="w-7 h-7 rounded-lg grid place-items-center text-white shrink-0" style={{ background: p.profile.avatarColor || '#0D4734' }}>{p.profile.name.slice(0, 1)}</span>
                  <span className="hidden sm:inline">Your profile</span>
                </>
              : 'Join'}
          </button>
        </div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      {/* The hero cost ~350px to restate the header. One line, and the action. */}
      <section className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm sm:text-base font-bold">
          Jos founders backing each other’s work.{' '}
          <button onClick={() => openSection('members')} className="font-normal underline decoration-[#0D4734]/30 hover:decoration-[#0D4734]">
            {p.loaded ? `${p.attendees.length} members` : '— members'}
          </button>
          <span className="font-normal"> · {p.loaded ? p.problems.length : '—'} challenges</span>
        </p>
        <button className="bg-[#E5A93C] text-[#09251B] rounded-xl px-4 py-2.5 font-bold flex items-center gap-2" onClick={() => p.profile ? setSubmitOpen(true) : p.onJoin()}>
          <Plus size={18} /> Share a challenge
        </button>
      </section>

      {/* Everyone we imported has a profile on the server and no cookie on their
          phone, so on a first open they look exactly like a stranger. Recovery
          therefore sits beside joining at equal weight, not as an apology
          underneath it. Dismissing is remembered; the Join button in the header
          never goes away, so dismissal costs nothing. */}
      {!p.profile && !guestPromptDismissed && (
        <section className="rounded-2xl border border-[#0D4734]/25 bg-white p-4 mb-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">
              <strong>{linkedRound ? 'You’ve been sent a community ballot.' : 'New here?'}</strong>{' '}
              Add your name to support challenges and appear in the directory.
            </p>
            <button aria-label="Dismiss" className="text-xl leading-none px-1 text-[#09251B]/50 hover:text-[#09251B]" onClick={dismissGuestPrompt}>&times;</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className={`${button} bg-[#0D4734] text-white border-[#0D4734] hover:bg-[#166E52]`} onClick={p.onJoin}>Add your name</button>
            <button className={`${button} bg-white`} onClick={p.onRecover}>Already a member? Find your profile</button>
          </div>
        </section>
      )}

      {/* Only what changed since this device was last here, and only for someone
          the app recognises — a stranger has no "since". Silent when there is
          nothing, which is most of the time, so it never becomes furniture. */}
      {p.loaded && p.profile && whatsNew.length > 0 && (
        <section className="rounded-2xl border border-[#0D4734]/25 bg-[#EBF3EF] p-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0D4734]">Since you were last here</p>
          <ul className="mt-2 space-y-1">
            {whatsNew.map(item => <li key={item.label} className="text-sm">
              <button className="text-left underline decoration-[#0D4734]/30 hover:decoration-[#0D4734]" onClick={item.go}>{item.label}</button>
            </li>)}
          </ul>
        </section>
      )}

      {/* Everything else on this screen is a white card with a Support button.
          The ballot is the one thing that genuinely differs — it has a deadline,
          it closes, and it produces a result the community is bound by — so it
          is the one thing that looks different. An open ballot is dark and gold;
          a finished one recedes to a quiet white card. */}
      {round && (round.status === 'open'
        ? <section className="bg-[#0D4734] text-[#FAF6EE] border-2 border-[#09251B] rounded-2xl p-5 mb-6 shadow-[4px_4px_0_#E5A93C]">
            <p className="text-xs font-bold uppercase tracking-widest text-[#E5A93C]">Community ballot · Open</p>
            <h2 className="font-bold text-xl mt-1">{round.title}</h2>
            <p className="text-sm text-emerald-100 mt-1">{plural(round.ballotsCast, 'ballot')} submitted</p>
            <RoundDeadline round={round} />
            <button className="mt-4 w-full sm:w-auto bg-[#E5A93C] text-[#09251B] rounded-xl px-5 py-3 font-bold flex items-center justify-center gap-2" onClick={() => openBallot(round.id)}>
              {p.ballotCast ? 'Change your vote' : 'Vote now'}<ArrowRight size={16} />
            </button>
          </section>
        : <section className="bg-white border border-[#0D4734]/30 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[#0D4734]">Latest ballot results</p>
              <h2 className="font-bold text-lg">{round.title}</h2>
              <p className="text-sm text-stone-600">{plural(round.ballotsCast, 'ballot')} submitted</p>
            </div>
            <button className={`${button} flex items-center gap-2`} onClick={() => openBallot(round.id)}>View results<ArrowRight size={16} /></button>
          </section>)}

      <nav aria-label="Community sections" className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {(([['problems', 'Challenges'], ['members', 'Members'], ['sectors', 'Sectors'],
           // Shown only once somebody has been nominated. An empty governance
           // tab was on screen for every visitor, permanently.
           ...(p.trustees.length ? [['trustees', 'Trustees'] as const] : []),
           ['history', 'Results']] as const) as ReadonlyArray<readonly ['problems' | 'members' | 'sectors' | 'trustees' | 'history', string]>).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => openSection(id)} className={`${button} ${view === id ? 'bg-[#0D4734] text-white hover:bg-[#166E52]' : 'bg-white'}`}>{label}</button>)}
      </nav>
      {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
      {view === 'ballot' && (linkedRound || round?.id ? <CommunityBallot key={linkedRound || round!.id} roundId={linkedRound || round!.id} profile={p.profile} onJoin={p.onJoin} /> : <p>No ballot is available yet. You can still explore and support community challenges.</p>)}

      {view === 'history' && <PastBallots onOpen={openBallot} />}
      {view === 'members' && <AttendeeDirectory community attendees={p.attendees} currentProfile={p.profile} onOpenCheckIn={p.profile ? p.onProfile : p.onJoin} />}
      {/* Moved in from App, where it rendered above this component and outside
          the layout it owns — so nothing could account for its height. On the
          challenges tab only: it is a weekly highlight, not page furniture. */}
      {view === 'problems' && <SpotlightCard spotlight={p.spotlight} history={p.spotlightHistory} />}
      {view === 'problems' && <>
        {/* Search stays out; sector and sort fold away. The three of them stacked
            to roughly 180px on a phone — more room than the first challenge got.
            The summary names any filter that is actually on, so a narrowed list
            never looks like an empty community. */}
        <div className="mb-4">
          <label className="flex items-center gap-2 bg-white border rounded-xl px-3"><Search size={18} /><input aria-label="Search challenges" className="py-3 bg-transparent w-full outline-none" placeholder="Search challenges, ideas, or founders" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-bold py-1">
              Filters{category !== 'All' || sort !== 'newest' ? ` · ${[category !== 'All' ? category : null, sort === 'votes' ? 'most supported' : sort === 'squads' ? 'most commitments' : null].filter(Boolean).join(', ')}` : ''}
            </summary>
            <div className="flex flex-wrap gap-2 mt-2">
              <select aria-label="Filter by sector" className={button} value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{Array.from(new Set(p.problems.map(item => item.category))).map(name => <option key={name}>{name}</option>)}</select>
              <select aria-label="Sort challenges" className={button} value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="votes">Most supported</option><option value="squads">Most commitments</option></select>
            </div>
          </details>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cappedProblems.visible.map(item => <article key={item.id} className="bg-white border-2 border-[#09251B] rounded-2xl p-5 shadow-[3px_3px_0_#09251B] flex flex-col">
            <div className="flex flex-wrap gap-2 text-xs mb-3"><span className="bg-[#EBF3EF] rounded-lg px-2 py-1">{item.category}</span><span className="bg-amber-50 rounded-lg px-2 py-1">{item.status}</span></div>
            <h2 className="font-display font-black text-xl">{item.title}</h2><p className="text-sm text-stone-600 mt-3 line-clamp-3">{item.description}</p>
            <div className="flex flex-wrap gap-1 mt-4">{item.skillsNeeded.map(skill => <span key={skill} className="text-xs rounded-lg border px-2 py-1">{skill}</span>)}</div>
            <p className="text-xs text-stone-500 mt-4 mb-5">Shared by {item.submittedBy} · {plural(item.commitments, 'squad commitment')}</p>
            <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
              <button disabled={busy !== null} aria-pressed={p.myVotes.problems.includes(item.id)} className={`${button} flex items-center gap-2 ${p.myVotes.problems.includes(item.id) ? 'bg-amber-100' : ''}`} onClick={() => act(item.id, () => p.onVote(item.id, false))}><ThumbsUp size={16} />{p.myVotes.problems.includes(item.id) ? 'Supported' : 'Support'} · {item.upvotes}</button>
              <SquadJoin joined={p.myVotes.squads.includes(item.id)} disabled={busy !== null} initialSkill={p.profile?.tags?.[0]} onChange={async skill => { if (!p.profile) { p.onJoin(); throw new Error("Join the community first, then choose your squad."); } await p.onVote(item.id, true, p.profile.name, skill); }} />
              <button className={`${button} flex items-center gap-2`} onClick={() => { setDetailId(item.id); setComment(''); }}><MessageSquare size={16} />Details · {item.comments.length}</button>
            </div>
          </article>)}
        </div>
        <ShowMore hidden={cappedProblems.hidden} total={cappedProblems.total} noun="challenges" onMore={cappedProblems.showMore} onAll={cappedProblems.showAll} />
        {!p.loaded && !p.problems.length && <p role="status" className="text-sm text-stone-600">Loading challenges…</p>}
        {p.loaded && !filtered.length && <div className="bg-white rounded-2xl border p-8 text-center"><h2 className="font-bold text-xl">{p.problems.length ? 'No matching challenges' : 'What should we build together?'}</h2><p className="mt-2 text-stone-600">{p.problems.length ? 'Try another search or sector.' : 'Share the first challenge for the community to explore.'}</p></div>}
      </>}
      {view === 'sectors' && <SuggestSector />}
      {view === 'sectors' && p.loaded && !p.categories.length && <p className="text-sm text-stone-600">No sectors yet. Suggest one above and the host will review it.</p>}
      {view === 'sectors' && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{p.categories.map(item => <article key={item.name} className="bg-white border-2 rounded-2xl p-5"><h2 className="text-xl font-bold">{item.name}</h2><p className="text-sm text-stone-600 my-4">{item.description}</p><button disabled={busy !== null} aria-pressed={p.myVotes.categories.includes(item.name)} className={button} onClick={() => act(item.name, () => p.onVoteCategory(item.name))}>{p.myVotes.categories.includes(item.name) ? 'Supported' : 'Support'} · {item.upvotes}</button></article>)}</div>}
      {view === 'trustees' && <><p className="text-sm text-stone-600 mb-4">Nominated for the twelve statutory trustee seats.</p><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{p.trustees.map(item => <article key={item.id} className="bg-white border-2 rounded-2xl p-5"><p className="text-xs">Seat {item.seatNumber}</p><h2 className="text-xl font-bold">{item.name}</h2><p>{item.titleOrOrg}</p><p className="text-sm text-stone-600 my-4">{item.bio}</p><button className={button} disabled={busy !== null} aria-pressed={p.myVotes.trustees.includes(item.id)} onClick={() => act(item.id, () => p.onVoteTrustee(item.id))}>{p.myVotes.trustees.includes(item.id) ? 'Supported' : 'Support'} · {item.votes}</button></article>)}</div>{p.loaded && !p.trustees.length && <p>No trustees have been nominated yet.</p>}</>}
    </main>
    <footer className="text-center text-xs text-stone-600 p-6">Tin City Founders · Serious ambition. Serious collaboration.</footer>
    <SeamlessProblemWizard isOpen={submitOpen} onClose={() => setSubmitOpen(false)} onSubmit={p.onSubmit} currentProfile={p.profile} categories={p.categories} />
    {detail && <div role="dialog" aria-modal="true" aria-label="Challenge details" className="fixed inset-0 z-40 bg-black/50 p-4 overflow-y-auto flex items-start justify-center"><div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-6"><button aria-label="Close challenge details" className="float-right p-2" onClick={() => setDetailId(null)}><X /></button><h2 className="text-2xl font-bold pr-10">{detail.title}</h2><p className="my-5 whitespace-pre-wrap">{detail.description}</p><h3 className="font-bold">Squad members</h3><SquadRoster members={detail.squadMembers} legacyNames={detail.collaborators} /><h3 className="font-bold mt-5">Discussion</h3>{detail.comments.map(item => <div key={item.id} className="border-t py-3 mt-2"><strong>{item.author}</strong><p className="text-sm whitespace-pre-wrap">{item.text}</p></div>)}<form onSubmit={e => { e.preventDefault(); if (comment.trim()) void act('comment', async () => { await p.onComment(detail.id, p.profile!.name, comment.trim()); setComment(''); }); }} className="mt-4"><textarea autoFocus aria-label="Your comment" required value={comment} onChange={e => setComment(e.target.value)} className="border rounded-xl p-3 w-full" placeholder="Add to the conversation" /><button disabled={busy !== null} className={button}>Post comment</button>{error && <p role="alert" className="text-red-700 mt-3">{error}</p>}</form></div></div>}
  </div>;
}
