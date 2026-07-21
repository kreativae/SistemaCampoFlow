import { Test, TestingModule } from '@nestjs/testing';
import { FarmsService } from './farms.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { EmailService } from '../common/email/email.service';
import { BillingService } from '../billing/billing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('FarmsService', () => {
  let service: FarmsService;
  let prisma: Record<string, any>;
  let storage: Record<string, any>;
  let billing: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      farm: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      membership: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      document: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      soilAnalysis: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
      animalEvent: { deleteMany: jest.fn() },
      vaccinationRecord: { deleteMany: jest.fn() },
      treatmentRecord: { deleteMany: jest.fn() },
      weighingRecord: { deleteMany: jest.fn() },
      reproductiveEvent: { deleteMany: jest.fn() },
      dealItem: { deleteMany: jest.fn() },
      deal: { deleteMany: jest.fn() },
      pastureOccupation: { deleteMany: jest.fn() },
      animal: { deleteMany: jest.fn() },
      pasture: { deleteMany: jest.fn() },
      machineMaintenance: { deleteMany: jest.fn() },
      machineFuelRecord: { deleteMany: jest.fn() },
      machine: { deleteMany: jest.fn() },
      supplyMovement: { deleteMany: jest.fn() },
      supply: { deleteMany: jest.fn() },
      cropApplication: { deleteMany: jest.fn() },
      cropCostEntry: { deleteMany: jest.fn() },
      cropCycle: { deleteMany: jest.fn() },
      timeEntry: { deleteMany: jest.fn() },
      employee: { deleteMany: jest.fn() },
      contact: { deleteMany: jest.fn() },
      farmInvite: { deleteMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      mapFeature: { deleteMany: jest.fn() },
      transaction: { deleteMany: jest.fn() },
      weatherRecord: { deleteMany: jest.fn() },
      task: { deleteMany: jest.fn() },
      workLog: { deleteMany: jest.fn() },
      shift: { deleteMany: jest.fn() },
      agendaEvent: { deleteMany: jest.fn() },
      notification: { deleteMany: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    storage = { delete: jest.fn().mockResolvedValue(undefined) };
    billing = { assertCanCreateFarm: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: EmailService, useValue: { isConfigured: () => false, send: jest.fn() } },
        { provide: BillingService, useValue: billing },
      ],
    }).compile();

    service = module.get(FarmsService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when farm does not exist', async () => {
      prisma.farm.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns the farm when it exists', async () => {
      const farm = { id: 'farm-1', name: 'Fazenda Boa Vista' };
      prisma.farm.findUnique.mockResolvedValue(farm);
      const result = await service.findOne('farm-1');
      expect(result).toEqual(farm);
    });
  });

  describe('create', () => {
    it('checks billing limits before creating', async () => {
      prisma.farm.create.mockResolvedValue({ id: 'farm-1' });
      await service.create('user-1', 'acc-1', { name: 'Nova Fazenda' });
      expect(billing.assertCanCreateFarm).toHaveBeenCalledWith('acc-1');
    });

    it('creates farm with OWNER membership', async () => {
      prisma.farm.create.mockResolvedValue({ id: 'farm-1' });
      await service.create('user-1', 'acc-1', { name: 'Nova Fazenda' });

      const call = prisma.farm.create.mock.calls[0][0];
      expect(call.data.memberships.create.userId).toBe('user-1');
      expect(call.data.memberships.create.role).toBe(Role.OWNER);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for nonexistent farm', async () => {
      prisma.farm.findUnique.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('deletes all related records in a transaction', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1' });
      await service.remove('farm-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      const txOps = prisma.$transaction.mock.calls[0][0];
      expect(txOps.length).toBeGreaterThan(20);
    });

    it('cleans up storage files for documents and soil analyses', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-1' });
      prisma.document.findMany.mockResolvedValue([
        { storagePath: 'docs/file1.pdf' },
        { storagePath: 'docs/file2.pdf' },
      ]);
      prisma.soilAnalysis.findMany.mockResolvedValue([
        { documentPath: 'soil/report.pdf' },
      ]);

      await service.remove('farm-1');

      expect(storage.delete).toHaveBeenCalledWith('docs/file1.pdf');
      expect(storage.delete).toHaveBeenCalledWith('docs/file2.pdf');
      expect(storage.delete).toHaveBeenCalledWith('soil/report.pdf');
    });
  });

  describe('removeMember', () => {
    it('throws NotFoundException for non-member', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.removeMember('farm-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('blocks removing the sole OWNER', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: Role.OWNER });
      prisma.membership.count.mockResolvedValue(1);
      await expect(service.removeMember('farm-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('allows removing OWNER when another exists', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: Role.OWNER, userId: 'user-1', farmId: 'farm-1' });
      prisma.membership.count.mockResolvedValue(2);
      prisma.membership.delete.mockResolvedValue({});
      await service.removeMember('farm-1', 'user-1');
      expect(prisma.membership.delete).toHaveBeenCalled();
    });
  });
});
