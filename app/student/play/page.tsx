import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import JoinSessionForm from "./JoinSessionForm";

export default async function JoinGamePage() {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    redirect("/student/login");
  }

  return <JoinSessionForm />;
}
