import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { PasswordChangeError, maskEmail, sendPasswordChangeCode } from "@/modules/password-recovery/password-change-service";

// Step 1 of changing your own password: e-mail a verification code to the signed-in user's address.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "security:manage");
  if (!access.session) return apiError(access.error, access.status);
  const { id, name, email } = access.session.user;
  try {
    await sendPasswordChangeCode({ id, name, email }, clientIp(request));
  } catch (error) {
    if (error instanceof PasswordChangeError) return apiError(error.message, error.status, error.retryAfter ? { retryAfter: error.retryAfter } : undefined);
    throw error;
  }
  return NextResponse.json({ sent: true, email: maskEmail(email) });
}
