import type { ReactNode } from "react";
import { SuiteHeader } from "@/components/shell/SuiteHeader";
import { requireUser } from "@/lib/auth";

/** Every signed-in page shares the Open Schools header and app switcher. */
export default async function SuiteLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <SuiteHeader
        user={{ name: user.name, email: user.email, role: user.role, schoolName: user.school.name }}
      />
      {children}
    </>
  );
}
