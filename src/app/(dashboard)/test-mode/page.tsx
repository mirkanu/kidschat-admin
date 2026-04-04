import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TestModePage from "./test-mode-client";

export default async function TestModePageWrapper() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return <TestModePage />;
}
