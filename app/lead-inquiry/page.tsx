'use client';

import { CheckCircle2, Database } from 'lucide-react';
import GlanceTiles from '@/components/lead-inquiry/GlanceTiles';
import ClaimSection from '@/components/lead-inquiry/ClaimSection';
import Card from '@/components/lead-inquiry/Card';
import Callout from '@/components/lead-inquiry/Callout';
import FormAuditTable from '@/components/lead-inquiry/FormAuditTable';
import FixesChecklist from '@/components/lead-inquiry/FixesChecklist';
import { VerdictKey } from '@/components/lead-inquiry/VerdictChip';
import {
  MonthlyContactsChart,
  SpendVsLeadsCharts,
  GoogleLeadsChart,
  ShareBars,
  ConversionRateChart,
} from '@/components/lead-inquiry/charts';
import {
  AS_OF_LABEL,
  GOOGLE_FACTS as G,
  MISSING_PHONE,
  NON_RESPONSIVE,
  PAGE_FACTS as P,
  SOURCES,
} from '@/lib/lead-inquiry-data';

export default function LeadInquiryPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* 1. Header */}
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Mira Mar Sarasota
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
          Lead Inquiry Response
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Prepared for Heather van Workum · Mira Mar · {AS_OF_LABEL}
        </p>
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 space-y-3">
          <p>
            Thank you for the detailed spreadsheet. It made this much easier to check.
          </p>
          <p className="flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Your numbers reproduce exactly from Spark. All 434 rows in your sheet matched a Spark
              contact.
            </span>
          </p>
          <p>
            Here is what the full data shows, one claim at a time. The short version: lead volume is
            holding, cost per lead is the real problem, and one option on the new page is the only
            source of leads without a phone number. We also found two gaps in our own tracking, and
            we have fixed them.
          </p>
        </div>
      </header>

      <div className="space-y-10">
        {/* 2. At a glance */}
        <section aria-labelledby="glance-title">
          <h2 id="glance-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            At a glance
          </h2>
          <GlanceTiles />
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            October means October 1 to 12, so it is a partial month. Spend and leads per day come from
            Looker (Google plus Meta).
          </p>
          <div className="mt-4">
            <VerdictKey />
          </div>
        </section>

        {/* 3. Claim 1 */}
        <ClaimSection
          id="claim-1"
          number={1}
          claim="Contacts are trending down since June and July"
          verdict="partly"
          rightPart={
            <>
              <p>
                September did drop. It was 22% lower than August.
              </p>
              <p>And October is costing much more per lead than any month this summer.</p>
            </>
          }
          fullPicture={
            <>
              <p>June was actually the lowest month, not a high point. July and August were the peaks.</p>
              <p>
                October is holding. The first 12 days are on pace for about 75 contacts, and they are
                ahead of the same days in September.
              </p>
              <p className="font-semibold">The problem is cost per lead, not lead count.</p>
            </>
          }
        >
          <Card
            title="Buyer contacts in Spark, by month"
            subtitle="Counted your way: registered in the month, not agents, influencers, legal or team."
          >
            <MonthlyContactsChart />
          </Card>
          <Card
            title="Spend per day went up. Leads per day did not."
            subtitle="Two separate charts on purpose: dollars and leads are different units."
          >
            <SpendVsLeadsCharts />
          </Card>
        </ClaimSection>

        {/* 4. Claim 2 */}
        <ClaimSection
          id="claim-2"
          number={2}
          claim="Google dropped 40%"
          verdict="partly"
          verdictLabel="True for 12 days, not for the trend"
          rightPart={
            <>
              <p>
                Google did slip in early October. Comparing Oct 1 to 12 with Sep 1 to 12, Google Ads
                conversions fell from {G.first12Before} to {G.first12After}, while Google spend rose{' '}
                {G.first12SpendIncrease} over the same days.
              </p>
              <p>That is worth fixing, and it ties into the cost per lead problem above.</p>
            </>
          }
          fullPicture={
            <>
              <p>
                Over full months, September was Google&apos;s best month in Looker:{' '}
                {G.bestMonthConversions} conversions at {G.bestMonthCpl} per lead.
              </p>
              <p>
                The 40% figure compares 12 days to 12 days (10 Google contacts down to 6). That is a
                difference of 4 leads, so it is too early to call it a trend.
              </p>
            </>
          }
        >
          <Card
            title="Google leads by month, counted two ways"
            subtitle="Spark counts people who arrived from a Google ad. Looker counts Google Ads conversions (forms and calls). They measure different things, so they will not match."
          >
            <GoogleLeadsChart />
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              Looker shows September as Google&apos;s strongest month. Spark shows September a little
              below August (17 vs 21). Neither shows a 40% drop over full months.
            </p>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Callout title="The October cost per lead in Looker is incomplete">
              <p>
                Looker&apos;s {G.lookerOctCpl} October cost per lead covers only {G.lookerTableSpend} of
                the {G.octGoogleSpend} spent on Google in October. The table shows {G.campaignsShown}{' '}
                campaigns.
              </p>
              <p>
                About {G.unshownSpend} sits in campaigns that are not in the table. That includes two
                YouTube video ads with 0 clicks ({G.youtubeSpend}). This needs a closer look in the
                Google Ads account.
              </p>
            </Callout>
            <Callout tone="ours" title="Our mistake, now fixed">
              <p>
                Our GA4 setup did not count Google leads from the new page (/reserve/) as conversions.{' '}
                {G.reserveGoogleLeadsUncounted} Google leads from that page were missing from GA4&apos;s
                conversion reports since September 1.
              </p>
              <p>We fixed this on October 12. More on this under Claim 3.</p>
            </Callout>
          </div>
        </ClaimSection>

        {/* 5. Claim 3 */}
        <ClaimSection
          id="claim-3"
          number={3}
          claim="The new landing page leads have no phone numbers and are non-responsive"
          verdict="partly"
          verdictLabel="Half right, and we found the cause"
          rightPart={
            <>
              <p>
                You are right that the new page brings in leads without phone numbers. From June 1 to
                September 3, every lead had a phone. Since then, 4 leads arrived without one.
              </p>
              <p>
                All 4 came from the &ldquo;Send Me the Brochure&rdquo; option on /reserve/. That option
                does not ask for a phone. The page was built that way on purpose, and it was the wrong
                call for how your team follows up.
              </p>
              <p>
                Brochure leads are also the least responsive group: 9 of the 15 from September 4 to 30
                are now rated Non Responsive or Do Not Disturb.
              </p>
            </>
          }
          fullPicture={
            <>
              <p>The rest of the new page is working.</p>
              <p>
                Every &ldquo;Book a Private Tour&rdquo; lead has a phone number. And the page as a whole
                turns visitors into leads 3 to 4 times better than the original ad page.
              </p>
            </>
          }
        >
          <Card
            title="Is a phone number required?"
            subtitle="Every form on the site, checked against the live site code on October 12."
          >
            <FormAuditTable />
            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              Only one form out of 8 lets someone skip the phone number.
            </p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="Leads with no phone number"
              subtitle="Buyer leads in Spark with no phone on file."
            >
              <ShareBars rows={MISSING_PHONE} unit="missing a phone" />
            </Card>
            <Card
              title="Leads rated Non Responsive or Do Not Disturb"
              subtitle="Leads from Sep 4 to 30, so each one had at least 12 days to be worked."
            >
              <ShareBars rows={NON_RESPONSIVE} unit="rated Non Responsive or Do Not Disturb" />
              <ul className="mt-4 space-y-1.5 text-xs text-gray-600 dark:text-gray-400 list-disc pl-4">
                <li>These are small groups, so treat them as early signals.</li>
                <li>
                  Going quiet is common everywhere: {P.allLeadsNonResponsiveRange} of all June to
                  August leads are also rated Non Responsive today.
                </li>
                <li>
                  {P.brochureNonResponsiveWithPhone} of the {P.brochureNonResponsiveTotal} brochure leads
                  rated Non Responsive or Do Not Disturb (Sep 4 to Oct 12) do have a phone. A missing
                  phone is not the whole story.
                </li>
                <li>
                  Tour requests rarely go quiet, but most were rated Not A Buyer or Cold ({P.tourNegative}{' '}
                  of {P.tourTotal}).
                </li>
              </ul>
            </Card>
          </div>

          <Card
            title="How often a visit becomes a lead"
            subtitle="GA4, Sep 1 to Oct 12. Share of visits that ended in a form submission."
          >
            <ConversionRateChart />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  How far visitors scroll (Clarity, Oct 10 to 12)
                </div>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  <span className="text-xl font-bold tabular-nums">{P.scrollReserve}%</span> new page
                  <span className="mx-2 text-gray-400">vs</span>
                  <span className="text-xl font-bold tabular-nums">{P.scrollOriginal}%</span> original
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Share of paid visits sent to the new page (GA4)
                </div>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  <span className="text-xl font-bold tabular-nums">{P.googleShareToReserve}%</span> of Google
                  <span className="mx-2 text-gray-400">·</span>
                  <span className="text-xl font-bold tabular-nums">{P.metaShareToReserve}%</span> of Meta
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              The test is not a 50/50 split by channel, so compare the rates above, not lead totals.
            </p>
          </Card>

          <Callout tone="recommend" title="Our recommendation">
            <p>
              The brochure option is the single source of leads without a phone, and it has the worst
              response rate. The tour option, and the page overall, convert 3 to 4 times better than
              the original page.
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Require a phone number on the brochure option (or remove that option).</li>
              <li>Keep /reserve/ running.</li>
              <li>Look at the numbers again in 30 days.</li>
            </ol>
            <p>
              Going back to the June and July setup means going back to the original page, which turns
              only about 0.3% to 0.4% of visits into leads.
            </p>
          </Callout>
        </ClaimSection>

        {/* 6. What we fixed */}
        <section aria-labelledby="fixes-title">
          <h2 id="fixes-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            What we fixed, and what is next
          </h2>
          <Card>
            <FixesChecklist />
          </Card>
        </section>

        {/* 7. Sources */}
        <footer className="border-t border-gray-200 dark:border-gray-800 pt-6 pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Database className="w-4 h-4" aria-hidden="true" />
            Sources
          </div>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-xs text-gray-600 dark:text-gray-400 list-disc pl-4">
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Pulled {AS_OF_LABEL}. Oct 1 to 12 is a partial period. This page is a point-in-time
            snapshot and does not update.
          </p>
        </footer>
      </div>
    </div>
  );
}
