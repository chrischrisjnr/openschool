/**
 * Child privacy helpers. Public pages never show a student's full name:
 * "Mia N." is enough for Grandma, and nothing a stranger can use.
 */

export function publicStudentName(s: { firstName: string; preferredName?: string | null; lastName: string }): string {
  const first = (s.preferredName || s.firstName).trim();
  const initial = s.lastName.trim().charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

export function firstNameOf(s: { firstName: string; preferredName?: string | null }): string {
  return (s.preferredName || s.firstName).trim();
}

/** Donor name as shown on public pages. */
export function publicDonorName(d: { donorName: string; anonymous: boolean }): string {
  return d.anonymous ? "A kind supporter" : d.donorName;
}
