import { PrismaClient, Role, Priority } from "@prisma/client";

const prisma = new PrismaClient();

function parseDDMMYYYY(input: string): Date {
  const [day, month, year] = input.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  console.log("Seeding database...");

  const admin = await prisma.user.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      birthDate: parseDDMMYYYY("01-01-1980"),
      role: Role.ADMIN,
    },
  });

  const anna = await prisma.user.upsert({
    where: { name: "Anna Jansen" },
    update: {},
    create: {
      name: "Anna Jansen",
      birthDate: parseDDMMYYYY("12-05-1985"),
      role: Role.COORDINATOR,
    },
  });

  const mark = await prisma.user.upsert({
    where: { name: "Mark de Vries" },
    update: {},
    create: {
      name: "Mark de Vries",
      birthDate: parseDDMMYYYY("03-11-1990"),
      role: Role.EMPLOYEE,
    },
  });

  const clientsData = [
    { firstName: "Jan", lastName: "Bakker", dateOfBirth: parseDDMMYYYY("14-03-1998") },
    { firstName: "Els", lastName: "Visser", dateOfBirth: parseDDMMYYYY("22-07-2001") },
    { firstName: "Tom", lastName: "Peters", dateOfBirth: parseDDMMYYYY("09-12-1995") },
  ];

  const clients = [];
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { id: `${c.firstName}-${c.lastName}`.toLowerCase() },
      update: {},
      create: { id: `${c.firstName}-${c.lastName}`.toLowerCase(), ...c },
    });
    clients.push(client);
  }

  await prisma.medication.upsert({
    where: { id: "seed-med-1" },
    update: {},
    create: {
      id: "seed-med-1",
      clientId: clients[0].id,
      name: "Paracetamol",
      dosage: "500mg",
      instructions: "Bij hoofdpijn, max 3x per dag",
      times: "08:00,14:00,20:00",
    },
  });

  await prisma.medication.upsert({
    where: { id: "seed-med-2" },
    update: {},
    create: {
      id: "seed-med-2",
      clientId: clients[1].id,
      name: "Vitamine D",
      dosage: "1 capsule",
      instructions: "Elke ochtend bij het ontbijt",
      times: "08:00",
    },
  });

  await prisma.protocol.upsert({
    where: { id: "seed-protocol-1" },
    update: {},
    create: {
      id: "seed-protocol-1",
      title: "Algemeen noodprotocol",
      content: "Bij een noodgeval: bel 112 en waarschuw de coördinator direct.",
    },
  });

  await prisma.todo.upsert({
    where: { id: "seed-todo-1" },
    update: {},
    create: {
      id: "seed-todo-1",
      title: "Voorraad medicatiekastje controleren",
      priority: Priority.MEDIUM,
      createdById: anna.id,
    },
  });

  const settings: Record<string, string> = {
    GENERAL_EMAIL: process.env.GENERAL_EMAIL || "algemeen@example.com",
    COORDINATOR_EMAIL: process.env.COORDINATOR_EMAIL || "coordinator@example.com",
    ORG_NAME: "Woongroep",
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("Seed complete:");
  console.log("- Admin / 01-01-1980 (admin)");
  console.log("- Anna Jansen / 12-05-1985 (coordinator)");
  console.log("- Mark de Vries / 03-11-1990 (medewerker)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
