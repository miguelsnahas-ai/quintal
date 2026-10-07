// Convenience-only cookie pointing a returning device at "the last test
// chat this browser used" so /comecar can skip straight to it. Not a
// security boundary — the caregiverId it holds is exactly as guessable (or
// not) as the /test/[caregiverId] URL itself.
export const TEST_ACCESS_COOKIE = "quintal_caregiver_id";
