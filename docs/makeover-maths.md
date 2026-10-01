# Makeover Maths

A standalone, local browser game at `/games/makeover-maths`. Start the normal
development server with `yarn dev`, then open
`http://localhost:5175/games/makeover-maths`.

The game includes an illustrated room, tap-to-walk and keyboard movement, a
fully clothed teen character, 15 gown colourways across three silhouettes,
three hairstyles, five hair colours, four makeup looks, a runway, judges and
a celebration ballroom with treats and dancing.

## Play loop

- Two independent player profiles, with editable names and Year 1/Year 3
  starting points.
- Every correct answer earns $1,000 in fictional play money. Mistakes cost
  nothing; hints and retries are available without a timer.
- Three correct answers finish each of 50 levels. Random questions adjust
  gently after successful answers or mistakes, within the selected track.
- Practice a surprise mix or one chosen topic: addition, subtraction, place
  value, multiplication, division, fractions, money, measures and shapes,
  time, or charts. UK money questions use pounds and pence.
- Studios unlock once. Purchased styles stay owned; changing into them is
  free. Insufficient funds lead to a new maths challenge.
- Each show requires one fresh correct answer. Judges score outfit style,
  creativity and maths confidence. Wins pay $2,000; participation pays $500.
  Three consecutive wins earn a party invitation.
- Level 50 ends with an achievement screen. The player can keep styling,
  practising and entering shows afterwards.

## Progress and ownership

This is a self-contained prototype, separate from verified EzStudy identities
and canonical learner records. It uses transient React state. It does not
write to the API, send learner data, or persist profiles in browser storage.

Use **Save game** before closing or refreshing. A downloaded JSON file keeps
both players, their wardrobes, maths progress and play money. Use **How to
play → Load game** to resume. Imported saves are validated before replacing
current state. Game money is fictional; there are no real payments.

The art and exact generation prompts are documented in
[makeover-maths-art.md](makeover-maths-art.md). Character alpha is retained;
runtime CSS layers provide clothes and hair colourways without a 3D engine.
No additional npm dependencies are required. Reduced-motion settings suppress
cosmetic animation. Sound is optional and begins only after a player enables it.

## Checks

Run `node --test qa/makeover.test.ts` from `web/` with a current Node version
that supports TypeScript type stripping (Node 22.18+). The focused checks cover
one-time rewards/purchases, the 150-answer completion path, invitations,
save validation, player isolation, and question choices/arithmetic across all
topics and difficulties. Run `pnpm build` from `web/` for TypeScript and Vite.

This game is a playable first version for family feedback; its generated
question bank is not a formal assessment or a complete curriculum planner.

Keep source changes local until separately authorized for deployment. Pushing
public `main` triggers the existing Vercel frontend deployment.
