/**
 * The one address the site publishes.
 *
 * It is here, in one place, because it appears on /privacy, /terms and
 * /contact, and an address that is right on two pages out of three is worse
 * than no address at all.
 *
 * Deliberately NOT the owner's personal address, and deliberately not read
 * from ADMIN_EMAIL. ADMIN_EMAIL is where the site sends its own mail and is
 * private; this one goes on public pages that anyone, including a spam
 * crawler, can read. Keeping them separate means the inbox that receives
 * cron digests is not the inbox that receives whatever arrives from the
 * open internet.
 *
 * CHANGE THIS before launch if you want a different address, and make sure
 * somebody actually reads it: all three pages promise a reply within a week.
 */
export const CONTACT_EMAIL = 'ruetfacultyreview@gmail.com'
