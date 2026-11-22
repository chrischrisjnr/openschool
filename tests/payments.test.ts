import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { newId } from "../src/db/ids";
import {
  feteCampaigns,
  feteDonations,
  paymentItems,
  payments,
  schools,
  studentCharges,
  students,
} from "../src/db/schema";
import { abandonPayment, completePayment, startCheckout } from "../src/lib/payments";

delete process.env.STRIPE_SECRET_KEY;

const schoolId = newId();
db.insert(schools).values({ id: schoolId, name: "Test PS", shortName: "TPS", slug: `t-${schoolId}` }).run();

function makeCharge() {
  const studentId = newId();
  db.insert(students).values({ id: studentId, schoolId, firstName: "A", lastName: "B", yearLevel: 3 }).run();
  const itemId = newId();
  db.insert(paymentItems).values({ id: itemId, schoolId, title: "Zoo", amountCents: 2800, audienceType: "school" }).run();
  const chargeId = newId();
  db.insert(studentCharges).values({ id: chargeId, itemId, studentId, amountCents: 2800 }).run();
  return chargeId;
}

const charge = (id: string) => db.select().from(studentCharges).where(eq(studentCharges.id, id)).get()!;

test("demo checkout links charges and completes them exactly once", async () => {
  const chargeId = makeCharge();
  const { paymentId, url } = await startCheckout({
    schoolId,
    purpose: "charges",
    description: "Zoo excursion",
    amountCents: 2800,
    payer: { name: "Sam" },
    returnPath: "/assemble/payments",
    attach: (pid) => db.update(studentCharges).set({ paymentId: pid }).where(eq(studentCharges.id, chargeId)).run(),
  });
  assert.equal(url, `/pay/${paymentId}`);
  assert.equal(charge(chargeId).status, "unpaid");

  assert.equal(completePayment(paymentId), true);
  assert.equal(charge(chargeId).status, "paid");
  assert.ok(charge(chargeId).paidAt);
  assert.equal(completePayment(paymentId), false, "second completion is a no-op");
});

test("abandoning a payment releases charges so they can be paid again", async () => {
  const chargeId = makeCharge();
  const { paymentId } = await startCheckout({
    schoolId,
    purpose: "charges",
    description: "Zoo excursion",
    amountCents: 2800,
    payer: {},
    returnPath: "/x",
    attach: (pid) => db.update(studentCharges).set({ paymentId: pid }).where(eq(studentCharges.id, chargeId)).run(),
  });
  abandonPayment(paymentId);
  assert.equal(charge(chargeId).paymentId, null);
  assert.equal(charge(chargeId).status, "unpaid");
  assert.equal(db.select().from(payments).where(eq(payments.id, paymentId)).get()!.status, "cancelled");
  assert.equal(completePayment(paymentId), false, "a cancelled payment can't later succeed");
});

test("donations are marked succeeded on completion", async () => {
  const campaignId = newId();
  db.insert(feteCampaigns)
    .values({ id: campaignId, schoolId, slug: `c-${campaignId}`, name: "Run", startsAt: new Date(), endsAt: new Date(), goalCents: 100000 })
    .run();
  const donationId = newId();
  const { paymentId } = await startCheckout({
    schoolId,
    purpose: "donation",
    description: "Donation",
    amountCents: 2000,
    payer: { name: "Nan" },
    returnPath: "/give/run",
    attach: (pid) =>
      db.insert(feteDonations).values({ id: donationId, campaignId, amountCents: 2000, donorName: "Nan", paymentId: pid }).run(),
  });
  completePayment(paymentId);
  assert.equal(db.select().from(feteDonations).where(eq(feteDonations.id, donationId)).get()!.status, "succeeded");
});

test("rejects tiny amounts and absolute return URLs", async () => {
  const base = { schoolId, purpose: "donation" as const, description: "x", payer: {}, attach: () => {} };
  await assert.rejects(startCheckout({ ...base, amountCents: 10, returnPath: "/x" }));
  await assert.rejects(startCheckout({ ...base, amountCents: 1000, returnPath: "https://evil.example" }));
});
