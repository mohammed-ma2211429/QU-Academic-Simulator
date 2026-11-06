const SEASONS = ["Fall", "Spring"];

// Maps an abstract simulation term number (1, 2, 3...) to a real academic
// semester label given the chosen starting term, e.g. termLabel("Fall 2024", 3)
// -> "Fall 2025". Term 1 is always the starting term itself.
export function termLabel(startingTerm, termNumber) {
  const [season, yearStr] = (startingTerm || "Fall 2024").split(" ");
  let idx = Math.max(0, SEASONS.indexOf(season));
  let year = parseInt(yearStr, 10) || 2024;
  for (let i = 1; i < termNumber; i++) {
    if (SEASONS[idx] === "Fall") {
      idx = 1;
      year += 1;
    } else {
      idx = 0;
    }
  }
  return `${SEASONS[idx]} ${year}`;
}

// The real academic semester happening "right now" -- used to label the
// Live enrollment imports. Jan-Jun reads as Spring of that year,
// Jul-Dec as Fall of that year (matches when each term's registration/
// coursework is actually underway).
export function currentSemesterLabel(date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month <= 6 ? `Spring ${year}` : `Fall ${year}`;
}
