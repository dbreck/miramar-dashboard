---
description: Kick off the biweekly Mira Mar marketing report (Looker extract → build → deploy → update Reports tab) from the dashboard repo
argument-hint: [period — e.g. "2w", "--start 2026-07-30 --end 2026-08-13", optionally "--dry-run"]
---

Generate the Mira Mar marketing performance report for the period: **$ARGUMENTS**

The report pipeline lives in the separate report repo. Do this:

1. Read and follow `/Users/dannybreckenridge/Documents/Clear ph/Clients/Mira Mar/Looker Analysis/.claude/commands/regen-report.md`, passing it the arguments above verbatim. Work in that repo for all extraction/build/commit steps. It covers: browser connection (multiple Chromes may be connected — ask which; Looker filter state is per-tab), the optional date handoff to the user, per-page extraction via `get_page_text`, the fan-out agent build (json-builder + nav-updater in parallel, then html-builder), local preview approval, and commit/push (Vercel auto-deploys mira-mar-report.vercel.app).
2. After the deploy is live, complete the post-ship step **in this repo**: update `LATEST_REPORT_URL` and the "Latest · <date>" kicker in `components/tabs/ReportsTab.tsx`, commit only that file, and push (expect to `git pull --rebase` over snapshot-cron commits first; stash dirty working-tree files around the rebase).
3. Report back: period, comparison period, headline deltas, section statuses, live URL.
