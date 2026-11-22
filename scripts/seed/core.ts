/**
 * Seeds the demo school: Wattle Creek Primary School, Brunswick VIC.
 * Everyone shares the password "openschools".
 */
import type { DB } from "../../src/db/connection";
import { newId } from "../../src/db/ids";
import {
  classes,
  guardians,
  houses,
  schools,
  students,
  users,
  type House,
  type Role,
  type SchoolClass,
  type School,
  type Student,
  type User,
} from "../../src/db/schema";
import { hashPassword } from "../../src/lib/password";

/** Small deterministic PRNG so the demo data is the same every time. */
export function rng(seed = 42) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!,
    chance: (p: number) => next() < p,
  };
}

export type SeedContext = {
  school: School;
  /** principal@demo.openschools.au — admin */
  principal: User;
  /** office@demo.openschools.au — admin (business manager) */
  office: User;
  /** teacher@demo.openschools.au — teaches 6A */
  teacher: User;
  /** parent@demo.openschools.au — parent of Mia (6A) and Leo (2A) */
  parent: User;
  /** student@demo.openschools.au — Mia's own student login */
  studentUser: User;
  staff: User[];
  parents: User[];
  classes: SchoolClass[];
  houses: House[];
  students: Student[];
  /** studentId → guardian user ids */
  guardiansByStudent: Map<string, string[]>;
  /** The demo parent's children: [Mia, Leo] */
  demoChildren: Student[];
};

const FIRST = [
  "Olivia", "Noah", "Charlotte", "Oliver", "Amelia", "Jack", "Isla", "William", "Ava", "Leo",
  "Matilda", "Henry", "Grace", "Lucas", "Willow", "Thomas", "Ruby", "Hudson", "Harper", "Charlie",
  "Zara", "Archie", "Ivy", "Theo", "Sienna", "Ethan", "Chloe", "Liam", "Aria", "Kai",
  "Priya", "Arjun", "Mei", "Hamish", "Layla", "Ali", "Sofia", "Hugo", "Evie", "Jaxon",
  "Ella", "Mason", "Lily", "Harrison", "Aisha", "Finn", "Poppy", "Oscar", "Maya", "Felix",
];
const LAST = [
  "Smith", "Nguyen", "Williams", "Brown", "Wilson", "Taylor", "Johnson", "White", "Martin", "Anderson",
  "Thompson", "Tran", "Walker", "Harris", "Lee", "Ryan", "Robinson", "Kelly", "King", "Davies",
  "Patel", "Singh", "Chen", "Wright", "Murphy", "O'Brien", "Kaur", "Papadopoulos", "Rossi", "Campbell",
  "Mitchell", "Young", "Clarke", "Hughes", "Edwards", "Le", "Ali", "Hall", "Wood", "Stewart",
];
const PARENT_FIRST = [
  "Sarah", "Michael", "Jessica", "David", "Emma", "Daniel", "Rebecca", "James", "Lauren", "Matthew",
  "Kate", "Chris", "Nicole", "Ben", "Hannah", "Tom", "Rachel", "Sam", "Megan", "Josh",
  "Anh", "Raj", "Fatima", "Wei", "Maria", "Giorgos", "Aroha", "Tess", "Nadia", "Luke",
];

const slugEmail = (first: string, last: string) =>
  `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@demo.openschools.au";

export async function seedCore(db: DB): Promise<SeedContext> {
  const r = rng(2026);
  const passwordHash = await hashPassword("openschools");
  const emails = new Set<string>();
  const uniqueEmail = (first: string, last: string) => {
    let e = slugEmail(first, last);
    for (let n = 2; emails.has(e); n++) e = e.replace(/(\d*)@/, `${n}@`);
    emails.add(e);
    return e;
  };

  const school: School = {
    id: newId(),
    name: "Wattle Creek Primary School",
    shortName: "Wattle Creek PS",
    slug: "wattle-creek",
    suburb: "Brunswick",
    state: "VIC",
    timezone: "Australia/Melbourne",
    phone: "(03) 9000 1234",
    email: "office@wattlecreek.example.edu.au",
    abn: "12 345 678 901",
    createdAt: new Date(),
  };
  db.insert(schools).values(school).run();

  const makeUser = (name: string, email: string, role: Role, title: string | null = null): User => {
    emails.add(email);
    const u: User = {
      id: newId(),
      schoolId: school.id,
      email,
      name,
      title,
      phone: null,
      passwordHash,
      role,
      disabled: false,
      createdAt: new Date(),
    };
    db.insert(users).values(u).run();
    return u;
  };

  // --- Staff --------------------------------------------------------------
  const principal = makeUser("Dr Helen Okafor", "principal@demo.openschools.au", "admin", "Principal");
  const office = makeUser("Karen Lim", "office@demo.openschools.au", "admin", "Business Manager");
  const teacher = makeUser("Mr Daniel Reyes", "teacher@demo.openschools.au", "staff", "Year 6 teacher");

  const houseRows: House[] = [
    { id: newId(), schoolId: school.id, name: "Banksia", color: "yellow" },
    { id: newId(), schoolId: school.id, name: "Waratah", color: "red" },
    { id: newId(), schoolId: school.id, name: "Kurrajong", color: "green" },
    { id: newId(), schoolId: school.id, name: "Jacaranda", color: "purple" },
  ];
  db.insert(houses).values(houseRows).run();

  const classSpec: [string, number, string][] = [
    ["FA", 0, "Ms Priya Sharma"],
    ["FB", 0, "Mrs Jo Bennett"],
    ["1A", 1, "Mr Sam Tuala"],
    ["2A", 2, "Ms Lucy Nguyen"],
    ["3A", 3, "Mr Tom Gallagher"],
    ["3B", 3, "Ms Aisha Rahman"],
    ["4A", 4, "Mrs Fiona McKenzie"],
    ["5A", 5, "Mr Marco Bianchi"],
    ["6A", 6, ""], // Mr Reyes (demo teacher)
    ["6B", 6, "Ms Grace Whitfield"],
  ];
  const staff: User[] = [principal, office, teacher];
  const classRows: SchoolClass[] = classSpec.map(([name, yearLevel, teacherName]) => {
    let t = teacher;
    if (teacherName) {
      const [first, ...rest] = teacherName.split(" ").slice(1);
      t = makeUser(teacherName, uniqueEmail(first!, rest.join("")), "staff", `Class ${name} teacher`);
      staff.push(t);
    }
    return { id: newId(), schoolId: school.id, name, yearLevel, teacherId: t.id, room: `Room ${r.int(1, 24)}` };
  });
  db.insert(classes).values(classRows).run();
  staff.push(makeUser("Coach Ben Walsh", "ben.walsh@demo.openschools.au", "staff", "PE & Sport"));

  // --- Students & families ------------------------------------------------
  const allStudents: Student[] = [];
  const parents: User[] = [];
  const guardiansByStudent = new Map<string, string[]>();
  const link = (userId: string, studentId: string, relationship: string, isPrimary = true) => {
    db.insert(guardians).values({ userId, studentId, relationship, isPrimary }).run();
    guardiansByStudent.set(studentId, [...(guardiansByStudent.get(studentId) ?? []), userId]);
  };
  const makeStudent = (first: string, last: string, cls: SchoolClass, userId: string | null = null): Student => {
    const year = 2026 - 5 - cls.yearLevel;
    const s: Student = {
      id: newId(),
      schoolId: school.id,
      userId,
      firstName: first,
      lastName: last,
      preferredName: null,
      classId: cls.id,
      houseId: r.pick(houseRows).id,
      yearLevel: cls.yearLevel,
      dateOfBirth: `${year}-${String(r.int(1, 12)).padStart(2, "0")}-${String(r.int(1, 28)).padStart(2, "0")}`,
      medicalNotes: r.chance(0.08) ? r.pick(["Asthma — puffer in office", "Anaphylaxis (peanuts) — EpiPen in bag", "Coeliac — no gluten"]) : null,
      active: true,
      createdAt: new Date(),
    };
    db.insert(students).values(s).run();
    allStudents.push(s);
    return s;
  };

  // The demo family: the Nguyen-Walker family with Mia (6A) and Leo (2A).
  const cls = (name: string) => classRows.find((c) => c.name === name)!;
  const parent = makeUser("Sarah Walker", "parent@demo.openschools.au", "parent", null);
  const partner = makeUser("Anh Nguyen", "anh.nguyen@demo.openschools.au", "parent", null);
  parents.push(parent, partner);
  const studentUser = makeUser("Mia Nguyen-Walker", "student@demo.openschools.au", "student", "Year 6");
  const mia = makeStudent("Mia", "Nguyen-Walker", cls("6A"), studentUser.id);
  const leo = makeStudent("Leo", "Nguyen-Walker", cls("2A"));
  for (const s of [mia, leo]) {
    link(parent.id, s.id, "Mother", true);
    link(partner.id, s.id, "Father", false);
  }

  // Everyone else: families of 1–3 children spread across classes, ~12 per class.
  const perClass = new Map(classRows.map((c) => [c.id, allStudents.filter((s) => s.classId === c.id).length]));
  const openClasses = () => classRows.filter((c) => (perClass.get(c.id) ?? 0) < 12);
  while (openClasses().length) {
    const last = r.pick(LAST);
    const pFirst = r.pick(PARENT_FIRST);
    const p = makeUser(`${pFirst} ${last}`, uniqueEmail(pFirst, last), "parent");
    parents.push(p);
    let second: User | null = null;
    if (r.chance(0.45)) {
      const f2 = r.pick(PARENT_FIRST);
      second = makeUser(`${f2} ${last}`, uniqueEmail(f2, last), "parent");
      parents.push(second);
    }
    const kids = r.pick([1, 1, 2, 2, 3]);
    for (let k = 0; k < kids && openClasses().length; k++) {
      const c = r.pick(openClasses());
      const s = makeStudent(r.pick(FIRST), last, c);
      perClass.set(c.id, (perClass.get(c.id) ?? 0) + 1);
      link(p.id, s.id, r.pick(["Mother", "Father", "Parent", "Carer"]), true);
      if (second) link(second.id, s.id, "Parent", false);
    }
  }

  return {
    school,
    principal,
    office,
    teacher,
    parent,
    studentUser,
    staff,
    parents,
    classes: classRows,
    houses: houseRows,
    students: allStudents,
    guardiansByStudent,
    demoChildren: [mia, leo],
  };
}
