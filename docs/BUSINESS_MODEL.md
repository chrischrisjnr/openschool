# Open Schools business model

*Draft v0.1, November 2026. All dollar figures are AUD and exclude GST. The
scenario numbers are planning assumptions to test with pilot schools, not
forecasts or financial advice.*

## In one line

The software stays free and open source. The company earns from **Open Schools
Cloud**, the hosted version, where Fete fundraising carries an optional
supporter tip (or a small flat fee), with paid plans for support and compliance.

## What never changes

- All three apps (Assemble, Quad, Fete) stay free under the AGPL v3 licence.
- A school that hosts Open Schools itself pays nothing, and its payments go
  straight to its own Stripe account with no cut.
- No advertising, no selling data, and no charging families to use the apps.

## Why fundraising pays for everything

Schools already hand over a large share of what they raise. On a $25,000 fun
run:

| Who runs it | Their cut | Leaves the school |
|---|---|---|
| Traditional fun-run company (40%, prizes and event kit included) | $10,000 | $15,000 |
| Lower-fee school fundraising service (10%) | $2,500 | $22,500 |
| **Fete on Open Schools Cloud (4% flat, or supporter tips)** | **$1,000** | **$24,000** |
| Fete, self-hosted | $0 | $25,000 |

Card processing is extra on any software route (Stripe's standard Australian
rate is about 1.65% + 30c per domestic card payment). The 40% operators bundle
prizes and event kit; with Fete a school buys its own, so the true saving is
$9,000 less whatever it spends on prizes.

## Revenue streams, in order

1. **Fete on Cloud (from day one).** Supporters are offered an optional tip at
   checkout. A school that prefers certainty can switch tips off and pay a flat
   4% of funds raised instead.
2. **Cloud Plus (from year two).** A yearly plan, assumed at $1,500 per school,
   for priority support, single sign-on, onboarding help and a compliance pack.
   Aimed first at Catholic and independent schools.
3. **Certified partners (year three onwards).** Companies that host or
   customise Open Schools for school systems pay a royalty of about 10% of that
   revenue, the way Moodle funds its open-source core. Not counted below.

## Three-year scenarios

| | Cautious | Base | Stretch |
|---|---|---|---|
| Raised through Fete per school, per year | $20,000 | $25,000 | $30,000 |
| Effective take (tips and flat fee blended) | 2.5% | 4% | 5% |
| Fete revenue per school | $500 | $1,000 | $1,500 |
| Schools on Fete: year 1 / 2 / 3 | 10 / 40 / 120 | 25 / 120 / 400 | 40 / 250 / 800 |
| Cloud Plus schools: year 1 / 2 / 3 | 0 / 5 / 20 | 0 / 15 / 60 | 0 / 30 / 120 |
| **Revenue, year 1** | **$5,000** | **$25,000** | **$60,000** |
| **Revenue, year 2** | **$27,500** | **$142,500** | **$420,000** |
| **Revenue, year 3** | **$90,000** | **$490,000** | **$1,380,000** |
| Share of Australia's 9,673 schools, year 3 | 1.2% | 4.1% | 8.3% |

**Break-even.** Assuming a lean team costs $350,000 a year (two people,
hosting, compliance), the base case needs about 350 schools on Fete. The base
case reaches that during year three.

## Gates and risks

- **ST4S assessment.** Australian school systems use the Safer Technologies 4
  Schools assessment to decide what schools may adopt. An assessment takes
  about three months and lasts two years. Start the readiness check before
  selling to any government school. Cost to the vendor is still to be confirmed.
- **Victorian School Software Panel.** Victoria is moving in-scope school
  software onto a mandatory panel. Parent and teacher communications is a
  listed category, so Assemble may need panel membership to be bought by
  Victorian government schools. Fundraising is not a listed category, which is
  another reason to lead with Fete.
- **Card surcharge ban.** Since 1 October 2026, Australian businesses cannot
  add a surcharge for paying by card. The supporter tip must be clearly
  optional and separate from the donation. Get payments advice before launch.
- **Tips are unpredictable.** The cautious case assumes most supporters skip
  the tip. The flat-fee option is the safety net.
- **Fundraising is seasonal.** Most schools run one large event a year. Event
  tickets and other community payments on Cloud would smooth revenue.
- **Market ceiling.** Australia has 9,673 schools and about 4.16 million
  students. That supports a solid business; larger scale means New Zealand
  (which also uses ST4S) and the UK.
- **Conflicts of interest.** Where a founder or team member holds a governance
  role at a school, that school's decision to pilot or adopt Open Schools must
  be declared and made without them.

## Next steps

1. Update the README payments note so it separates self-hosting (no cut, ever)
   from Open Schools Cloud (optional tip or flat fee).
2. Build Cloud payments on Stripe Connect so the fee is taken at checkout and
   schools are paid directly.
3. Complete the ST4S readiness check.
4. Pilot Fete with three to five schools in the 2027 fundraising season and
   measure funds raised per school and the share of supporters who tip.
5. Set up the company and its ownership with an accountant.

## Sources

- Fun-run company fees (schools keep 60%): [Australian Fundraising](https://australianfundraising.com.au/fundraising-products/fun-run/)
- 10% flat-fee school fundraising: [Go Raise It](https://www.goraiseit.com.au/school-colour-run-fundraising/)
- Optional tips or a 4% flat fee: [Raisely pricing](https://raisely.com/pricing)
- Card processing rates: [Stripe, card pricing in Australia from October 2026](https://support.stripe.com/questions/updates-to-card-pricing-in-australia-from-october-2026)
- School and student numbers: [ABS, Schools 2025](https://www.abs.gov.au/statistics/people/education/schools/2025)
- School Software Panel and ST4S rules: [Victorian Department of Education](https://www2.education.vic.gov.au/pal/software-administration-systems/policy)
- ST4S program: [Education Services Australia](https://esa.edu.au/solutions/our-solutions/safer-technologies-4-schools)
- Card surcharge removal: [Reserve Bank of Australia FAQ](https://www.rba.gov.au/payments-and-infrastructure/review-of-retail-payments-regulation/2026-03/conclusions-paper/faqs/)
- Partner royalties: [Moodle](https://moodle.com/news/how-will-moodle-workplace-help-improve-moodle-lms-a-message-from-our-ceo/)
