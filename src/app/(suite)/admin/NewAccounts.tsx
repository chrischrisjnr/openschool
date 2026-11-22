"use client";

import { DownloadIcon } from "@primer/octicons-react";
import { Banner, Button } from "@primer/react";
import type { CreatedAccount } from "@/lib/admin/people";
import { toCsv } from "@/lib/csv";
import styles from "./admin.module.css";

/**
 * Shows sign-in details for newly created accounts. Temporary passwords are
 * only shown once, so offer a download the office can use for letters/emails.
 */
export function NewAccounts({ accounts }: { accounts: CreatedAccount[] }) {
  if (!accounts.length) return null;
  const download = () => {
    const csv = toCsv([["Name", "Email", "Role", "Temporary password"], ...accounts.map((a) => [a.name, a.email, a.role, a.password])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "new-open-schools-accounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className={styles.form}>
      <Banner
        variant="warning"
        title="Save these sign-in details now"
        description="Temporary passwords are only shown once. Share them privately — each person can change theirs under “Your account”."
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Temporary password</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.email}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>
                  <span className={styles.code}>{a.password}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button leadingVisual={DownloadIcon} onClick={download}>
          Download as CSV
        </Button>
      </div>
    </div>
  );
}
