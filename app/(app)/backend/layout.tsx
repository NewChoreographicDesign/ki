import { redirect } from "next/navigation";
import { getSession, canAccessBackend } from "@/lib/auth";

// Defense in depth: middleware already blocks /backend using the JWT's role
// claim, but that claim can be stale for up to 12h after a demotion. This
// layout re-checks the live, DB-backed role on every request so a demoted
// or deactivated account loses read access to backend pages immediately,
// not just to the mutating API routes.
export default async function BackendLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canAccessBackend(session.role)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
