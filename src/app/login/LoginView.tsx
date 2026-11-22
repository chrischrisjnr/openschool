"use client";

import { FormControl, TextInput } from "@primer/react";
import { useActionState } from "react";
import { signIn, signInAsDemo } from "@/app/actions/auth";
import { ProductMark, SuiteMark } from "@/components/shell/ProductMark";
import { FormMessage, SubmitButton } from "@/components/ui";
import { InitialsAvatar } from "@/components/ui/Card";
import styles from "./login.module.css";

type DemoAccount = { email: string; name: string; role: string; title: string | null; blurb: string };

export function LoginView({ next, demoAccounts }: { next?: string; demoAccounts: DemoAccount[] }) {
  const [state, action] = useActionState(signIn, undefined);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <SuiteMark size={40} />
          <div>
            <h1 className={styles.title}>Open Schools</h1>
            <p className={styles.tagline}>Free, open-source software for school communities.</p>
          </div>
        </div>

        <ul className={styles.apps} aria-label="Included apps">
          <li><ProductMark product="assemble" size={20} /> Assemble</li>
          <li><ProductMark product="quad" size={20} /> Quad</li>
          <li><ProductMark product="fete" size={20} /> FETE</li>
        </ul>

        <form action={action} className={styles.form}>
          <input type="hidden" name="next" value={next ?? ""} />
          <FormMessage state={state} />
          <FormControl required>
            <FormControl.Label>Email</FormControl.Label>
            <TextInput name="email" type="email" autoComplete="email" block size="large" />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Password</FormControl.Label>
            <TextInput name="password" type="password" autoComplete="current-password" block size="large" />
          </FormControl>
          <SubmitButton block size="large" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
          <p className={styles.help}>
            Forgotten your password or don&apos;t have an account? Contact your school office.
          </p>
        </form>
      </div>

      {demoAccounts.length > 0 ? (
        <section className={styles.demo} aria-labelledby="demo-heading">
          <h2 id="demo-heading" className={styles.demoTitle}>
            Try the demo school
          </h2>
          <p className={styles.demoText}>
            Explore Wattle Creek Primary as a different person. No real money or messages are involved.
          </p>
          <div className={styles.demoList}>
            {demoAccounts.map((a) => (
              <form key={a.email} action={signInAsDemo}>
                <input type="hidden" name="email" value={a.email} />
                <button type="submit" className={styles.demoButton}>
                  <InitialsAvatar name={a.name} size={40} />
                  <span>
                    <span className={styles.demoName}>
                      {a.name}
                      {a.title ? <span className={styles.demoRole}> · {a.title}</span> : null}
                    </span>
                    <span className={styles.demoBlurb}>{a.blurb}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
          <p className={styles.demoText}>
            All demo accounts use the password <code>openschools</code>.
          </p>
        </section>
      ) : null}
    </main>
  );
}
