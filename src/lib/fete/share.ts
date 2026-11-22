/** Public URLs and share links for Fete pages. Pure, safe on the client. */

export function studentPath(campaignSlug: string, code: string): string {
  return `/give/${campaignSlug}/${code}`;
}

export function campaignPath(campaignSlug: string): string {
  return `/give/${campaignSlug}`;
}

/** "https://school.org/give/x/y" → "school.org/give/x/y" for printing. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function shareLinks(url: string, message: string) {
  const text = `${message} ${url}`;
  return {
    sms: `sms:?&body=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n\n${url}\n\nThank you!`)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
  };
}
