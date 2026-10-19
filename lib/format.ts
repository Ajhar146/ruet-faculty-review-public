/**
 * How numbers are written when a person reads them.
 *
 * DISPLAY ONLY. Nothing here is stored, compared, summed or sorted on. The
 * database keeps full precision, recalculateTeacherRating() keeps writing it,
 * and every calculation keeps using the full value. This is the last step
 * before a string reaches the screen and nothing else.
 */

/**
 * A rating, as one decimal place. Always one, including a trailing zero.
 *
 *   5      -> "5.0"
 *   4.75   -> "4.8"
 *   4.6667 -> "4.7"
 *
 * WHY THIS EXISTS. The same rating used to be written two ways: the home
 * page's top-rated card printed toFixed(2) and the profile headline printed
 * toFixed(1), so one teacher was 4.75 in one place and 4.8 in the other. Six
 * components each called toFixed themselves, which is how two of them drifted
 * apart without anyone noticing.
 *
 * So there is ONE function and every display site calls it. If the format
 * should change, it changes here, once, and it cannot change in five places
 * out of six.
 *
 * THE TRAILING ZERO IS THE POINT, not an accident of toFixed. A column of
 * 4.8 / 4.5 / 5.0 lines up on the decimal; 4.8 / 4.5 / 5 does not. Never
 * "tidy" a whole number down to "5".
 *
 * NOT FOR SORTING. Rounding before a comparison makes two different numbers
 * look equal, and two teachers that round to the same value would then swap
 * places between requests. getTopRatedTeachers() sorts on the full-precision
 * weighted score and formats only what it shows.
 *
 * It takes a number, not `number | null`. A missing rating is not a
 * formatting question: /teachers shows no number at all below the display
 * threshold, a course block shows an em dash, and the profile says "No rating
 * yet". Those are different answers and each caller owns its own.
 */
export function formatRating(value: number): string {
  return value.toFixed(1)
}
