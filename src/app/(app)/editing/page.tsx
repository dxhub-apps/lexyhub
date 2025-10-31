export default function EditingOverviewPage(): JSX.Element {
  return (
    <div className="editing-overview">
      <section className="surface-card editing-overview-card">
        <h2>Listing intelligence</h2>
        <p>
          Run on-demand quality audits that surface sentiment, tone, keyword gaps, and missing attributes. Every scan stores a
          quality audit in Supabase so follow-up edits have a baseline.
        </p>
        <ul>
          <li>Quality scoring tuned for Etsy metadata</li>
          <li>Auto-detected attribute gaps with quick fixes</li>
          <li>Keyword density heatmap to drive copy edits</li>
        </ul>
      </section>
      <section className="surface-card editing-overview-card">
        <h2>Competitor analysis</h2>
        <p>
          Benchmark any keyword or shop across pricing, review volume, adjectives, and tag overlap. Snapshot outputs log into Supabase so
          trends across runs are easy to spot.
        </p>
        <ul>
          <li>Ranks by estimated sales and review power</li>
          <li>Highlights shared phrases and tone clusters</li>
          <li>Visualizes saturation with strong vs. weak listings</li>
        </ul>
      </section>
      <section className="surface-card editing-overview-card">
        <h2>Tag optimizer</h2>
        <p>
          Blend our internal keyword database with your listing tags to flag duplicates and surface higher-demand substitutes.
          Health scores sync to Supabase for follow-up automation.
        </p>
        <ul>
          <li>Scores each tag with volume, trend, and competition data</li>
          <li>Suggests replacements that meaningfully lift demand</li>
          <li>Stores run history so editors can track progress</li>
        </ul>
      </section>
    </div>
  );
}
