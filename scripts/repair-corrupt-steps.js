// scripts/repair-corrupt-steps.js
// Fix steps where qtyRework was over-counted (pending went negative)
// and activate stuck next steps.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const allSteps = await prisma.routingStep.findMany({
    include: { operation: true },
    orderBy: [{ jobPartId: 'asc' }, { sequence: 'asc' }],
  });

  let repaired = 0;

  for (const step of allSteps) {
    const pending = step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected;

    if (pending < 0) {
      // Over-counted rework — clamp qtyRework so pending = 0
      const correctedRework = step.qtyIn - step.qtyPassed - step.qtyRejected;
      console.log(`[CORRUPT] Step ${step.id} (${step.operation.name} seq ${step.sequence})`);
      console.log(`  in:${step.qtyIn} passed:${step.qtyPassed} rework:${step.qtyRework} reject:${step.qtyRejected} → pending:${pending}`);
      console.log(`  Correcting qtyRework: ${step.qtyRework} → ${correctedRework}`);

      await prisma.routingStep.update({
        where: { id: step.id },
        data: {
          qtyRework: correctedRework < 0 ? 0 : correctedRework,
          status: 'COMPLETED',
          completedAt: step.completedAt ?? new Date(),
        },
      });

      // Activate next step if not already
      if (step.qtyPassed > 0) {
        const nextStep = await prisma.routingStep.findFirst({
          where: { jobPartId: step.jobPartId, sequence: step.sequence + 1 },
        });
        if (nextStep && nextStep.status === 'PENDING' && nextStep.qtyIn === 0) {
          await prisma.routingStep.update({
            where: { id: nextStep.id },
            data: { status: 'IN_PROGRESS', qtyIn: step.qtyPassed, startedAt: new Date() },
          });
          console.log(`  → Activated next step (seq ${nextStep.sequence}) with qtyIn=${step.qtyPassed}`);
        }
      }
      repaired++;
    }
  }

  if (repaired === 0) {
    console.log('No corrupt steps found.');
  } else {
    console.log(`\nRepaired ${repaired} corrupt step(s).`);
  }

  // Also handle stuck-pending (normal case, not negative)
  let fixed = 0;
  const completedSteps = await prisma.routingStep.findMany({ where: { status: 'COMPLETED', qtyPassed: { gt: 0 } } });
  for (const cs of completedSteps) {
    const nextStep = await prisma.routingStep.findFirst({
      where: { jobPartId: cs.jobPartId, sequence: cs.sequence + 1, status: 'PENDING', qtyIn: 0 },
    });
    if (nextStep) {
      await prisma.routingStep.update({
        where: { id: nextStep.id },
        data: { status: 'IN_PROGRESS', qtyIn: cs.qtyPassed, startedAt: new Date() },
      });
      console.log(`Fixed stuck step seq ${nextStep.sequence} → IN_PROGRESS, qtyIn=${cs.qtyPassed}`);
      fixed++;
    }
  }
  if (fixed > 0) console.log(`Activated ${fixed} stuck next-step(s).`);
}

main().catch(console.error).finally(() => prisma['$disconnect']());
