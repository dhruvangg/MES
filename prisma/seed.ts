// prisma/seed.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mes.local' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@mes.local',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  })
  console.log('✅ Admin user:', adminUser.email)

  // Operations
  const opDefs = [
    { name: 'OD Grinding', code: 'ODG', description: 'External diameter grinding' },
    { name: 'ID Grinding', code: 'IDG', description: 'Internal diameter grinding' },
    { name: 'Centreless Grinding', code: 'CLG', description: 'Centreless grinding' },
    { name: 'Honing', code: 'HON', description: 'Bore honing for fine finish' },
    { name: 'Lapping', code: 'LAP', description: 'Surface lapping' },
    { name: 'Surface Grinding', code: 'SFG', description: 'Flat surface grinding' },
    { name: 'Turning', code: 'TRN', description: 'CNC / manual turning' },
    { name: 'Inspection', code: 'INS', description: 'Final quality inspection' },
    { name: 'Deburring', code: 'DBR', description: 'Edge deburring' },
    { name: 'CNC Machining', code: 'CNC', description: 'CNC milling' },
  ]

  const operations = await Promise.all(
    opDefs.map(op => prisma.operation.upsert({ where: { name: op.name }, update: {}, create: op }))
  )
  console.log(`✅ ${operations.length} operations`)
  const opMap: Record<string, string> = {}
  operations.forEach(o => { opMap[o.name] = o.id })

  // Customers
  const [ir, lq, st, jb] = await Promise.all([
    prisma.customer.upsert({ where: { code: 'IR' }, update: {}, create: { name: 'Ingersoll Rand Ltd.', code: 'IR', phone: '+91 98765 43210' } }),
    prisma.customer.upsert({ where: { code: 'LQ' }, update: {}, create: { name: 'Leo Quip Pvt. Ltd.', code: 'LQ', phone: '+91 98111 22233' } }),
    prisma.customer.upsert({ where: { code: 'ST' }, update: {}, create: { name: 'Sunita Tools & Forge', code: 'ST', phone: '+91 90000 11122' } }),
    prisma.customer.upsert({ where: { code: 'JB' }, update: {}, create: { name: 'Jassubhai Engineering', code: 'JB', phone: '+91 97777 88899' } }),
  ])
  console.log('✅ 4 customers')

  // Parts
  const [pAcc, pBolt, pShaft, pFlange] = await Promise.all([
    prisma.part.upsert({ where: { code: 'P-ACC' }, update: {}, create: { name: 'Air comp. cylinder', code: 'P-ACC' } }),
    prisma.part.upsert({ where: { code: 'P-HBM12' }, update: {}, create: { name: 'Hex bolt M12×60', code: 'P-HBM12' } }),
    prisma.part.upsert({ where: { code: 'P-AES' }, update: {}, create: { name: 'Aerospace shaft', code: 'P-AES' } }),
    prisma.part.upsert({ where: { code: 'P-FDN80' }, update: {}, create: { name: 'Flange DN80 PN16', code: 'P-FDN80' } }),
  ])

  // Drawings
  const [dAcc, dBolt, dShaft, dFlange] = await Promise.all([
    prisma.drawing.upsert({ where: { number: 'DWG-ACC-001' }, update: {}, create: { number: 'DWG-ACC-001', revision: 'B' } }),
    prisma.drawing.upsert({ where: { number: 'DWG-HBM-001' }, update: {}, create: { number: 'DWG-HBM-001', revision: 'A' } }),
    prisma.drawing.upsert({ where: { number: 'DWG-AES-005' }, update: {}, create: { number: 'DWG-AES-005', revision: 'C' } }),
    prisma.drawing.upsert({ where: { number: 'DWG-FLG-002' }, update: {}, create: { number: 'DWG-FLG-002', revision: 'A' } }),
  ])
  console.log('✅ 4 parts + 4 drawings')

  // Job 1: Overdue — Air comp. cylinder, Honing in progress
  const job1 = await prisma.job.upsert({
    where: { jobNumber: 'JOB-2025-041' },
    update: {},
    create: {
      jobNumber: 'JOB-2025-041', customerId: ir.id, poNumber: 'PO-IR-2025-88',
      dueDate: new Date('2025-05-18'), priority: 'URGENT', status: 'ACTIVE',
      notes: 'Bore diameter critical — check with CMM after honing',
    },
  })
  const jp1 = await prisma.jobPart.create({ data: { jobId: job1.id, partId: pAcc.id, drawingId: dAcc.id, totalQty: 50, rejectedQty: 2 } })
  const s1_1 = await prisma.routingStep.create({ data: { jobPartId: jp1.id, operationId: opMap['OD Grinding'], sequence: 1, status: 'COMPLETED', qtyIn: 50, qtyPassed: 50, startedAt: new Date('2025-05-15T08:00:00Z'), completedAt: new Date('2025-05-15T14:00:00Z'), updatedById: adminUser.id } })
  const s1_2 = await prisma.routingStep.create({ data: { jobPartId: jp1.id, operationId: opMap['ID Grinding'], sequence: 2, status: 'COMPLETED', qtyIn: 50, qtyPassed: 48, qtyRejected: 2, startedAt: new Date('2025-05-16T08:00:00Z'), completedAt: new Date('2025-05-16T16:00:00Z'), updatedById: adminUser.id } })
  const s1_3 = await prisma.routingStep.create({ data: { jobPartId: jp1.id, operationId: opMap['Honing'], sequence: 3, status: 'IN_PROGRESS', qtyIn: 48, qtyPassed: 44, startedAt: new Date('2025-05-17T08:00:00Z'), updatedById: adminUser.id } })
  const s1_4 = await prisma.routingStep.create({ data: { jobPartId: jp1.id, operationId: opMap['Inspection'], sequence: 4, status: 'PENDING' } })

  await prisma.productionLog.createMany({ data: [
    { jobPartId: jp1.id, routingStepId: s1_1.id, action: 'PASS', qty: 50, updatedById: adminUser.id },
    { jobPartId: jp1.id, routingStepId: s1_2.id, action: 'PASS', qty: 48, updatedById: adminUser.id },
    { jobPartId: jp1.id, routingStepId: s1_2.id, action: 'REJECT', qty: 2, notes: 'Crack on inner bore', updatedById: adminUser.id },
    { jobPartId: jp1.id, routingStepId: s1_3.id, action: 'PASS', qty: 44, updatedById: adminUser.id },
  ]})
  await prisma.discrepancyIssue.create({ data: {
    jobPartId: jp1.id, routingStepId: s1_2.id, reason: 'CRACK',
    description: 'Crack found on inner bore', qty: 2,
    disposition: 'REJECTED', isReworkable: false,
    resolvedAt: new Date('2025-05-16T17:00:00Z'), updatedById: adminUser.id,
  }})

  // Job 2: Due today — Hex bolt, Inspection in progress
  const job2 = await prisma.job.upsert({
    where: { jobNumber: 'JOB-2025-042' }, update: {},
    create: { jobNumber: 'JOB-2025-042', customerId: lq.id, poNumber: 'PO-LQ-220', dueDate: new Date(), priority: 'HIGH', status: 'ACTIVE' },
  })
  const jp2 = await prisma.jobPart.create({ data: { jobId: job2.id, partId: pBolt.id, drawingId: dBolt.id, totalQty: 200 } })
  await prisma.routingStep.createMany({ data: [
    { jobPartId: jp2.id, operationId: opMap['Centreless Grinding'], sequence: 1, status: 'COMPLETED', qtyIn: 200, qtyPassed: 198, qtyRejected: 2, startedAt: new Date(), completedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp2.id, operationId: opMap['Lapping'], sequence: 2, status: 'COMPLETED', qtyIn: 198, qtyPassed: 196, startedAt: new Date(), completedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp2.id, operationId: opMap['Surface Grinding'], sequence: 3, status: 'COMPLETED', qtyIn: 196, qtyPassed: 194, startedAt: new Date(), completedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp2.id, operationId: opMap['Inspection'], sequence: 4, status: 'IN_PROGRESS', qtyIn: 194, startedAt: new Date(), updatedById: adminUser.id },
  ]})

  // Job 3: Tomorrow — Flange
  const job3 = await prisma.job.upsert({
    where: { jobNumber: 'JOB-2025-043' }, update: {},
    create: { jobNumber: 'JOB-2025-043', customerId: st.id, dueDate: new Date(Date.now() + 86400000), priority: 'HIGH', status: 'ACTIVE' },
  })
  const jp3 = await prisma.jobPart.create({ data: { jobId: job3.id, partId: pFlange.id, drawingId: dFlange.id, totalQty: 12 } })
  await prisma.routingStep.createMany({ data: [
    { jobPartId: jp3.id, operationId: opMap['Surface Grinding'], sequence: 1, status: 'COMPLETED', qtyIn: 12, qtyPassed: 12, startedAt: new Date(), completedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp3.id, operationId: opMap['OD Grinding'], sequence: 2, status: 'IN_PROGRESS', qtyIn: 12, startedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp3.id, operationId: opMap['Inspection'], sequence: 3, status: 'PENDING' },
  ]})

  // Job 4: On track — Aerospace shaft
  const job4 = await prisma.job.upsert({
    where: { jobNumber: 'JOB-2025-044' }, update: {},
    create: { jobNumber: 'JOB-2025-044', customerId: jb.id, poNumber: 'PO-JB-55', dueDate: new Date(Date.now() + 2 * 86400000), priority: 'NORMAL', status: 'ACTIVE' },
  })
  const jp4 = await prisma.jobPart.create({ data: { jobId: job4.id, partId: pShaft.id, drawingId: dShaft.id, totalQty: 5 } })
  await prisma.routingStep.createMany({ data: [
    { jobPartId: jp4.id, operationId: opMap['Turning'], sequence: 1, status: 'COMPLETED', qtyIn: 5, qtyPassed: 5, startedAt: new Date(), completedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp4.id, operationId: opMap['ID Grinding'], sequence: 2, status: 'IN_PROGRESS', qtyIn: 5, startedAt: new Date(), updatedById: adminUser.id },
    { jobPartId: jp4.id, operationId: opMap['OD Grinding'], sequence: 3, status: 'PENDING' },
    { jobPartId: jp4.id, operationId: opMap['Honing'], sequence: 4, status: 'PENDING' },
    { jobPartId: jp4.id, operationId: opMap['Inspection'], sequence: 5, status: 'PENDING' },
  ]})

  console.log('✅ 4 jobs seeded')
  console.log('\n🎉 Done! Login: admin@mes.local / admin123')
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
