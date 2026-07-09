import "server-only";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "ritmo_student_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.STUDENT_SESSION_SECRET;
  if (!secret) {
    throw new Error("STUDENT_SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export interface StudentSessionPayload {
  studentId: string;
  classId: string;
  name: string;
}

export async function createStudentSessionToken(
  payload: StudentSessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyStudentSessionToken(
  token: string
): Promise<StudentSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.studentId === "string" &&
      typeof payload.classId === "string" &&
      typeof payload.name === "string"
    ) {
      return {
        studentId: payload.studentId,
        classId: payload.classId,
        name: payload.name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export { COOKIE_NAME as STUDENT_SESSION_COOKIE, SESSION_DURATION_SECONDS };
