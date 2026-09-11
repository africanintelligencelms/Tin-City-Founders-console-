// Small formatting helpers that were written more than once across the app.

// Everything the community reads is in Nigerian time. This was implemented
// separately in RoundDeadline, PastBallots and SpotlightCard.
export function lagosDate(value: string | number | Date, style: 'date' | 'datetime' = 'date') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    ...(style === 'datetime' ? { timeStyle: 'short' as const } : {}),
    timeZone: 'Africa/Lagos'
  }).format(date);
}

// "1 ballots submitted" was on screen for a live event. English plurals are
// irregular often enough that the caller should be able to say so.
export function plural(count: number, singular: string, pluralForm?: string) {
  return `${count} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

// Lifted verbatim from AttendeeDirectory rather than "improved". Taking the
// first TWO words (not first and last) changes what four real members' avatars
// say — Samuel Onimisi Solomon reads SO, not SS — and the existing initials are
// already on screen beside their names.
export function getInitials(name: string) {
  if (!name.trim()) return 'TC';   // the modal's guard; the directory's missed a whitespace-only name
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
