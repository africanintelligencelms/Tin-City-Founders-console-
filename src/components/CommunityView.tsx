import { SuggestSector } from './SuggestSector';
import { PastBallots } from './PastBallots';
import { SquadJoin, SquadRoster } from './SquadJoin';
import React, { useEffect, useState } from 'react';
import { Search, Plus, ThumbsUp, Users, ArrowRight, MessageSquare, X } from 'lucide-react';
import type { AttendeeProfile, CategoryInfo, PlateauProblem, VotingRound, MyRoundBallot, MyVotes, TrusteeCandidate } from '../types';
import { BrandLogo } from './BrandLogo';
import { AttendeeDirectory } from './AttendeeDirectory';
import { SeamlessProblemWizard } from './SeamlessProblemWizard';
import { RoundDeadline } from './RoundDeadline';
import { CommunityBallot } from './CommunityBallot';

interface Props {
  problems: PlateauProblem[];
  attendees: AttendeeProfile[];
  categories: CategoryInfo[];
  trustees: TrusteeCandidate[];
  profile: AttendeeProfile | null;
  myVotes: MyVotes;
  round: VotingRound | null;
  lastRound: VotingRound | null;
  ballot: MyRoundBallot;
  onVote: (id: string, commit: boolean, name?: string, skill?: string) => Promise<void>;
  onRoundSquad: (roundId: string, optionId: string, skill?: string) => Promise<void>;
  onVoteCategory: (name: string) => Promise<void>;
  onVoteTrustee: (id: string) => Promise<void>;
  onSubmit: React.ComponentProps<typeof SeamlessProblemWizard>['onSubmit'];
  onComment: (id: string, author: string, text: string) => Promise<void>;
  onBallot: (selections: string[]) => Promise<void>;
  onProfile: () => void;
  onJoin: () => void;
  onMixer: () => void;
  onHost?: () => void;
  syncStatus: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  onReconnect: () => void;
}

export function CommunityView(p: Props) {
  const [linkedRound, setLinkedRound] = useState(() => new URLSearchParams(window.location.search).get('round'));
  const [view, setView] = useState<'problems' | 'members' | 'sectors' | 'trustees' | 'ballot' | 'history'>(() => new URLSearchParams(window.location.search).has('round') ? 'ballot' : new URLSearchParams(window.location.search).get('view') === 'history' ? 'history' : 'problems');
  useEffect(() => {
    const navigate = () => { const id = new URLSearchParams(window.location.search).get('round'); setLinkedRound(id); setView(id ? 'ballot' : new URLSearchParams(window.location.search).get('view') === 'history' ? 'history' : 'problems'); };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);
  const openSection = (section: 'problems' | 'members' | 'sectors' | 'trustees' | 'history') => {
    const url = new URL(window.location.href); url.searchParams.delete('round');
    if (section === 'history') url.searchParams.set('view', 'history'); else url.searchParams.delete('view');
    window.history.pushState({}, '', url); setLinkedRound(null); setView(section);
  };
  const openBallot = (id: string) => {
    const url = new URL(window.location.href); url.searchParams.set('round', id); url.searchParams.set('mode', 'community');
    window.history.pushState({}, '', url); setLinkedRound(id); setView('ballot');
  };
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
    if (!p.profile) { p.onJoin(); return; }
    setBusy(key); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(null); }
  };
  const button = 'px-4 py-2.5 rounded-xl border border-[#0D4734]/25 text-sm font-bold hover:bg-[#EBF3EF] disabled:opacity-50';
  const filtered = p.problems.filter(item => (category === 'All' || item.category === category) && `${item.title} ${item.description} ${item.submittedBy}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'votes' ? b.upvotes - a.upvotes : sort === 'squads' ? b.commitments - a.commitments : b.createdAt.localeCompare(a.createdAt));

  return <div className="min-h-screen bg-[#F6F3EC] text-[#09251B]">
    <header className="bg-white border-b-2 border-[#09251B] px-4 sm:px-8 py-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => openSection('problems')} aria-label="Community home"><BrandLogo variant="full" /></button>
        <div className="flex flex-wrap items-center gap-2">
          <button className="text-xs px-2 py-2" onClick={p.onReconnect}>{p.syncStatus === 'connected' ? '● Connected' : 'Reconnect'}</button>
          <button className={button} onClick={p.onMixer}>Mixer mode</button>
          {p.onHost && <button className={button} onClick={p.onHost}>Host console</button>}
          <button className={`${button} flex items-center gap-2`} onClick={p.profile ? p.onProfile : p.onJoin}>
            {p.profile && <span className="w-7 h-7 rounded-lg grid place-items-center text-white" style={{ background: p.profile.avatarColor || '#0D4734' }}>{p.profile.name.slice(0, 1)}</span>}
            {p.profile ? 'Your profile' : 'Join community'}
          </button>
        </div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <section className="bg-[#0D4734] text-[#FAF6EE] rounded-3xl border-2 border-[#09251B] p-6 sm:p-10 shadow-[5px_5px_0_#E5A93C] mb-8">
        <p className="text-xs tracking-widest uppercase text-[#E5A93C] font-bold">Tin City Founders · Jos, Plateau State</p>
        <h1 className="text-3xl sm:text-5xl font-display font-black mt-3 max-w-3xl">Build the community.<br />Shape what happens next.</h1>
        <p className="mt-4 max-w-2xl text-emerald-100">Explore local challenges, support ideas, and find people to build with. Drop in whenever it works for you.</p>
        <div className="flex flex-wrap items-center gap-4 mt-6">
          <button className="bg-[#E5A93C] text-[#09251B] rounded-xl px-5 py-3 font-bold flex items-center gap-2" onClick={() => p.profile ? setSubmitOpen(true) : p.onJoin()}><Plus size={18} /> Share a challenge</button>
          <span className="text-sm">{p.attendees.length} members · {p.problems.length} challenges</span>
        </div>
      </section>

      {round && <section className="bg-white border border-[#0D4734]/30 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase text-[#0D4734]">{round.status === 'open' ? 'Community ballot · Open' : 'Latest ballot results'}</p><h2 className="font-bold text-lg">{round.title}</h2><p className="text-sm text-stone-600">{round.ballotsCast} ballots submitted</p><RoundDeadline round={round} /></div>
        <button className={`${button} flex items-center gap-2`} onClick={() => openBallot(round.id)}>{round.status === 'open' ? 'View ballot' : 'View results'}<ArrowRight size={16} /></button>
      </section>}

      <nav aria-label="Community sections" className="flex flex-wrap gap-2 mb-6">
        {([['problems', 'Challenges'], ['sectors', 'Sectors'], ['trustees', 'Trustees'], ['members', 'Member directory'], ['history', 'Past ballots']] as const).map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => openSection(id)} className={`${button} ${view === id ? 'bg-[#0D4734] text-white hover:bg-[#166E52]' : 'bg-white'}`}>{label}</button>)}
      </nav>
      {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
      {view === 'ballot' && (linkedRound || round?.id ? <CommunityBallot key={linkedRound || round!.id} roundId={linkedRound || round!.id} profile={p.profile} onJoin={p.onJoin} /> : <p>No ballot is available yet. You can still explore and support community challenges.</p>)}

      {view === 'history' && <PastBallots onOpen={openBallot} />}
      {view === 'members' && <AttendeeDirectory community attendees={p.attendees} currentProfile={p.profile} onOpenCheckIn={p.profile ? p.onProfile : p.onJoin} />}
      {view === 'problems' && <>
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="flex items-center gap-2 bg-white border rounded-xl px-3 flex-1 min-w-48"><Search size={18} /><input aria-label="Search challenges" className="py-3 bg-transparent w-full outline-none" placeholder="Search challenges, ideas, or founders" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <select aria-label="Filter by sector" className={button} value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{Array.from(new Set(p.problems.map(item => item.category))).map(name => <option key={name}>{name}</option>)}</select>
          <select aria-label="Sort challenges" className={button} value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="votes">Most supported</option><option value="squads">Most commitments</option></select>
        </div>
        <p className="text-sm text-stone-600 mb-5">Support here shows ongoing interest in a challenge. Formal community decisions use the ballot above when one is open.</p>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(item => <article key={item.id} className="bg-white border-2 border-[#09251B] rounded-2xl p-5 shadow-[3px_3px_0_#09251B] flex flex-col">
            <div className="flex flex-wrap gap-2 text-xs mb-3"><span className="bg-[#EBF3EF] rounded-lg px-2 py-1">{item.category}</span><span className="bg-amber-50 rounded-lg px-2 py-1">{item.status}</span></div>
            <h2 className="font-display font-black text-xl">{item.title}</h2><p className="text-sm text-stone-600 mt-3 line-clamp-3">{item.description}</p>
            <div className="flex flex-wrap gap-1 mt-4">{item.skillsNeeded.map(skill => <span key={skill} className="text-xs rounded-lg border px-2 py-1">{skill}</span>)}</div>
            <p className="text-xs text-stone-500 mt-4 mb-5">Shared by {item.submittedBy} · {item.commitments} squad commitments</p>
            <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
              <button disabled={busy !== null} aria-pressed={p.myVotes.problems.includes(item.id)} className={`${button} flex items-center gap-2 ${p.myVotes.problems.includes(item.id) ? 'bg-amber-100' : ''}`} onClick={() => act(item.id, () => p.onVote(item.id, false))}><ThumbsUp size={16} />{p.myVotes.problems.includes(item.id) ? 'Supported' : 'Support'} · {item.upvotes}</button>
              <SquadJoin joined={p.myVotes.squads.includes(item.id)} disabled={busy !== null} initialSkill={p.profile?.tags?.[0]} onChange={async skill => { if (!p.profile) { p.onJoin(); throw new Error("Join the community first, then choose your squad."); } await p.onVote(item.id, true, p.profile.name, skill); }} />
              <button className={`${button} flex items-center gap-2`} onClick={() => { setDetailId(item.id); setComment(''); }}><MessageSquare size={16} />Details · {item.comments.length}</button>
            </div>
          </article>)}
        </div>
        {!filtered.length && <div className="bg-white rounded-2xl border p-8 text-center"><h2 className="font-bold text-xl">{p.problems.length ? 'No matching challenges' : 'What should we build together?'}</h2><p className="mt-2 text-stone-600">{p.problems.length ? 'Try another search or sector.' : 'Share the first challenge for the community to explore.'}</p></div>}
      </>}
      {view === 'sectors' && <SuggestSector />}
      {view === 'sectors' && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{p.categories.map(item => <article key={item.name} className="bg-white border-2 rounded-2xl p-5"><h2 className="text-xl font-bold">{item.name}</h2><p className="text-sm text-stone-600 my-4">{item.description}</p><button disabled={busy !== null} aria-pressed={p.myVotes.categories.includes(item.name)} className={button} onClick={() => act(item.name, () => p.onVoteCategory(item.name))}>{p.myVotes.categories.includes(item.name) ? 'Supported' : 'Support sector'} · {item.upvotes}</button></article>)}</div>}
      {view === 'trustees' && <><p className="text-sm text-stone-600 mb-4">Meet the nominated trustees. Support here is an endorsement; election ballots appear separately when open.</p><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{p.trustees.map(item => <article key={item.id} className="bg-white border-2 rounded-2xl p-5"><p className="text-xs">Seat {item.seatNumber}</p><h2 className="text-xl font-bold">{item.name}</h2><p>{item.titleOrOrg}</p><p className="text-sm text-stone-600 my-4">{item.bio}</p><button className={button} disabled={busy !== null} aria-pressed={p.myVotes.trustees.includes(item.id)} onClick={() => act(item.id, () => p.onVoteTrustee(item.id))}>{p.myVotes.trustees.includes(item.id) ? 'Endorsed' : 'Endorse'} · {item.votes}</button></article>)}</div>{!p.trustees.length && <p>No trustees have been nominated yet.</p>}</>}
    </main>
    <footer className="text-center text-xs text-stone-600 p-6">Tin City Founders · Serious ambition. Serious collaboration.</footer>
    <SeamlessProblemWizard isOpen={submitOpen} onClose={() => setSubmitOpen(false)} onSubmit={p.onSubmit} currentProfile={p.profile} categories={p.categories} />
    {detail && <div role="dialog" aria-modal="true" aria-label="Challenge details" className="fixed inset-0 z-40 bg-black/50 p-4 overflow-y-auto flex items-start justify-center"><div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-6"><button aria-label="Close challenge details" className="float-right p-2" onClick={() => setDetailId(null)}><X /></button><h2 className="text-2xl font-bold pr-10">{detail.title}</h2><p className="my-5 whitespace-pre-wrap">{detail.description}</p><h3 className="font-bold">Squad members</h3><SquadRoster members={detail.squadMembers} legacyNames={detail.collaborators} /><h3 className="font-bold mt-5">Discussion</h3>{detail.comments.map(item => <div key={item.id} className="border-t py-3 mt-2"><strong>{item.author}</strong><p className="text-sm whitespace-pre-wrap">{item.text}</p></div>)}<form onSubmit={e => { e.preventDefault(); if (comment.trim()) void act('comment', async () => { await p.onComment(detail.id, p.profile!.name, comment.trim()); setComment(''); }); }} className="mt-4"><textarea autoFocus aria-label="Your comment" required value={comment} onChange={e => setComment(e.target.value)} className="border rounded-xl p-3 w-full" placeholder="Add to the conversation" /><button disabled={busy !== null} className={button}>Post comment</button>{error && <p role="alert" className="text-red-700 mt-3">{error}</p>}</form></div></div>}
  </div>;
}
