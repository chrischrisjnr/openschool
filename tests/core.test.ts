import assert from "node:assert/strict";
import { test } from "node:test";
import { yearFromClassName } from "../src/lib/admin/people";
import { csvCell, parseCsv, parseCsvObjects } from "../src/lib/csv";
import { formatMoney, parseMoneyToCents, yearLabel } from "../src/lib/format";
import { hashPassword, verifyPassword } from "../src/lib/password";

test("parseCsv handles quotes, commas, escaped quotes and CRLF", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","he said ""hi"""\n'), [
    ["a", "b"],
    ["x, y", 'he said "hi"'],
  ]);
});

test("parseCsvObjects normalises headers and strips a BOM", () => {
  const rows = parseCsvObjects("﻿First Name,Guardian Email\nMia,a@b.com\n");
  assert.deepEqual(rows, [{ first_name: "Mia", guardian_email: "a@b.com" }]);
});

test("csvCell escapes and neutralises spreadsheet formulas", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
});

test("yearFromClassName", () => {
  assert.equal(yearFromClassName("3B"), 3);
  assert.equal(yearFromClassName("Year 10"), 10);
  assert.equal(yearFromClassName("FA"), 0);
  assert.equal(yearFromClassName("Prep K"), 0);
  assert.equal(yearFromClassName("Blue"), null);
});

test("money helpers", () => {
  assert.equal(formatMoney(12345), "$123.45");
  assert.equal(formatMoney(5000, { whole: true }), "$50");
  assert.equal(parseMoneyToCents("$1,234.5"), 123450);
  assert.equal(parseMoneyToCents("abc"), null);
});

test("year labels follow the state", () => {
  assert.equal(yearLabel(0, "VIC"), "Foundation");
  assert.equal(yearLabel(0, "NSW"), "Kindergarten");
  assert.equal(yearLabel(0, "QLD"), "Prep");
  assert.equal(yearLabel(4), "Year 4");
});

test("passwords hash and verify", async () => {
  const h = await hashPassword("correct horse battery");
  assert.ok(await verifyPassword("correct horse battery", h));
  assert.equal(await verifyPassword("wrong", h), false);
});
