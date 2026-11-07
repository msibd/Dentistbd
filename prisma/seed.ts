import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { promptHidden } from "../src/lib/prompt-hidden";

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!name || !email) {
    throw new Error("Set ADMIN_NAME and ADMIN_EMAIL in your local environment.");
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (user.role !== "admin") {
      throw new Error("That email already belongs to a non-admin account. Refusing to promote it.");
    }

    console.log(`Administrator access is already enabled for ${email}.`);
    return;
  }

  const password = await promptHidden("Create administrator password (at least 10 characters): ");
  if (password.length < 10) {
    throw new Error("Administrator password must be at least 10 characters.");
  }

  await auth.api.signUpEmail({
    body: { name, email, password },
  });
  user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Unable to create the administrator account.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin" },
  });

  console.log(`Administrator access enabled for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Administrator setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
