require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const stepId = 'cmpfmehp9000rk0eq13x4aovx';
  const step = await prisma.routingStep.findUnique({
    where: { id: stepId },
    include: {
      operation: true,
      discrepancyIssues: { include: { updatedBy: { select: { name: true } } } },
      jobPart: { include: { routingSteps: { include: { operation: true }, orderBy: { sequence: 'asc' } } } }
    }
  });
  if (!step) { console.log('Step not found'); return; }

  const pending = step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected;
  console.log('Step:', step.operation.name, '| seq:', step.sequence, '| status:', step.status);
  console.log('  in:', step.qtyIn, '| passed:', step.qtyPassed, '| rework:', step.qtyRework, '| reject:', step.qtyRejected, '| pending:', pending);
  console.log('\nDIs:');
  step.discrepancyIssues.forEach(d => {
    console.log(' ', d.id, '| reason:', d.reason, '| qty:', d.qty, '| disposition:', d.disposition, '| reworkTargetStepId:', d.reworkTargetStepId);
  });
  console.log('\nAll steps for this part:');
  step.jobPart.routingSteps.forEach(s => {
    const p = s.qtyIn - s.qtyPassed - s.qtyRework - s.qtyRejected;
    console.log(' ', s.sequence, s.operation.name, '|', s.status, '| in:', s.qtyIn, '| pass:', s.qtyPassed, '| rework:', s.qtyRework, '| reject:', s.qtyRejected, '| pending:', p);
  });
}

main().catch(console.error).finally(() => prisma['$disconnect']());
