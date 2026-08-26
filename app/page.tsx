import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function RootPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const existingUsers = await db.user.count();
  redirect(existingUsers === 0 ? "/setup" : "/login");
}
