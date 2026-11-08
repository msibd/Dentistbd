import dotenv from "dotenv";
import { promptHidden } from "../src/lib/prompt-hidden";

dotenv.config({ path: [".env.local", ".env"] });

async function main() {
  const [{ auth }, { prisma }] = await Promise.all([
    import("../src/lib/auth"),
    import("../src/lib/prisma"),
  ]);
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
      throw new Error("Set ADMIN_EMAIL in your local environment.");
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "admin") {
      // ADMIN_EMAIL may not match the seeded admin; fall back only when there is exactly one.
      const admins = await prisma.user.findMany({ where: { role: "admin" } });
      if (admins.length !== 1) {
        throw new Error(
          `No administrator with email ${email} (admins in database: ${admins.map((a) => a.email).join(", ") || "none"}). Set ADMIN_EMAIL to one of them.`,
        );
      }
      user = admins[0];
      console.log(`ADMIN_EMAIL does not match an administrator; resetting the only administrator: ${user.email}`);
    }

    const password = await promptHidden("Enter a new administrator password (at least 10 characters): ");
    const confirmation = await promptHidden("Confirm the new password: ");
    if (password.length < 10 || password.length > 128) {
      throw new Error("Administrator password must be between 10 and 128 characters.");
    }
    if (password !== confirmation) {
      throw new Error("The passwords do not match.");
    }

    const context = await auth.$context;
    const credential = await context.internalAdapter.findCredentialAccount(user.id);
    if (!credential) {
      throw new Error("The administrator does not have a password-based login.");
    }

    const hashedPassword = await context.password.hash(password);
    await context.internalAdapter.updateAccount(credential.id, { password: hashedPassword });
    await prisma.session.deleteMany({ where: { userId: user.id } });

    console.log("Administrator password updated. Sign in with the new password.");
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    console.error("Password reset failed:", error);
    process.exitCode = 1;
  });
