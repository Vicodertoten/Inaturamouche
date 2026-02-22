# Beta Smoke Matrix (Multi-device)

Date: __________
Build/commit: __________
Owner: __________

## Devices and browsers

- iOS Safari (latest stable)
- Android Chrome (latest stable)
- Desktop Chrome (latest stable)
- Desktop Firefox (latest stable)
- Desktop Safari (latest stable)

## Mandatory scenarios

1. Open app, pick language (fr/en/nl), start Easy round.
2. Finish one Easy round (>=5 questions), reach End screen, return Home.
3. Start Hard round, submit at least 3 answers.
4. Start Daily challenge from Home and complete the round.
5. Submit a bug report from modal (valid payload), confirm success message.
6. Toggle offline mode during gameplay (or disconnect network), verify graceful error UI and recovery.
7. Reload app and verify local progression still visible.
8. Verify beta scope text is visible on Home (Easy/Hard only).
9. Open Legal page and verify privacy section text is present.

## Pass criteria

- No blocker/P0 crash.
- No stuck state (user can continue or recover).
- Report submit success >= 95% on smoke attempts.
- Core navigation works on all target devices.

## Triage policy (during smoke)

- `P0`: crash, data loss, impossible to play.
- `P1`: major UX break on core flow (start/submit/end/report).
- `P2`: cosmetic/minor non-blocking issue.

## Sign-off

- QA lead sign-off: __________
- Product sign-off: __________
- Engineering sign-off: __________
