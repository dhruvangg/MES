// scripts/repair-stuck-steps.js
// One-time fix: find steps that are COMPLETED but whose next step is still PENDING
// with qtyIn=0, and activate those next steps.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all COMPLETED steps where the next step is still PENDING with qtyIn=0
  const completedSteps = await prisma.routingStep.findMany({
    where: { status: 'COMPLETED', qtyPassed: { gt: 0 } },
    orderBy: [{ jobPartId: 'asc' }, { sequence: 'asc' }],
  });

  let fixed = 0;
  for (const step of completedSteps) {
    const nextStep = await prisma.routingStep.findFirst({
      where: {
        jobPartId: step.jobPartId,
        sequence: step.sequence + 1,
        status: 'PENDING',
        qtyIn: 0,
      },
    });
    if (nextStep) {
      await prisma.routingStep.update({
        where: { id: nextStep.id },
        data: {
          status: 'IN_PROGRESS',
          qtyIn: step.qtyPassed,
          startedAt: new Date(),
        },
      });
      console.log(`Fixed: step seq ${nextStep.sequence} (${nextStep.id}) — set IN_PROGRESS, qtyIn=${step.qtyPassed}`);
      fixed++;
    }
  }

  console.log(`\nDone. Fixed ${fixed} stuck steps.`);
}

main().catch(console.error).finally(() => prisma['$disconnect']());
