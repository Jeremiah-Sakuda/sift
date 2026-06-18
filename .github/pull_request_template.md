<!-- Thanks for contributing to Sift! -->

## What & why

<!-- What does this change and why? Link any issue. -->

## If this touches the selector list

- [ ] Selectors are anchored on stable hooks (data-*, custom tags, vendor hrefs), not obfuscated classes
- [ ] Multiple fallbacks, ordered most-stable-first, each with an honest `confidence`
- [ ] `notes` explain how to re-verify in DevTools when it breaks
- [ ] A fixture in `tests/fixtures.test.ts` matches the surface and not the decoy page
- [ ] Bumped `version` + `updatedAt` in `lib/selectors/list.ts`

## Checklist

- [ ] `npm run compile` and `npm test` pass
- [ ] Extension-API calls stay behind `lib/browser.ts`
- [ ] Added a test for any new pure logic

## How I verified

<!-- Which page/surface did you test on, and what did you see? -->
