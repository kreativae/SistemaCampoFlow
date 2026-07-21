import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: Record<string, any>;
  let stripe: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      subscription: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      farm: { count: jest.fn() },
    };

    stripe = {
      isConfigured: jest.fn().mockReturnValue(false),
      createCheckoutSession: jest.fn(),
      cancelSubscription: jest.fn(),
      constructWebhookEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('createTrialSubscription', () => {
    it('creates a TRIAL subscription with 30-day expiry', async () => {
      prisma.subscription.create.mockResolvedValue({ id: 'sub-1' });
      await service.createTrialSubscription('acc-1');

      const call = prisma.subscription.create.mock.calls[0][0];
      expect(call.data.accountId).toBe('acc-1');
      expect(call.data.planTier).toBe(PlanTier.TRIAL);
      expect(call.data.status).toBe(SubscriptionStatus.TRIALING);
      expect(call.data.trialEndsAt).toBeInstanceOf(Date);
      const diffDays = (call.data.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });
  });

  describe('getForAccount', () => {
    it('throws NotFoundException when no subscription exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.farm.count.mockResolvedValue(0);
      await expect(service.getForAccount('acc-1')).rejects.toThrow(NotFoundException);
    });

    it('returns subscription with plan details and farm count', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        accountId: 'acc-1',
        planTier: PlanTier.TRIAL,
        status: SubscriptionStatus.TRIALING,
      });
      prisma.farm.count.mockResolvedValue(1);

      const result = await service.getForAccount('acc-1');
      expect(result.farmsUsed).toBe(1);
      expect(result.farmsLimit).toBe(2);
      expect(result.plan.label).toContain('Teste gratuito');
    });
  });

  describe('assertCanCreateFarm', () => {
    it('allows when no subscription exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(service.assertCanCreateFarm('acc-1')).resolves.toBeUndefined();
    });

    it('blocks when subscription is CANCELED', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: SubscriptionStatus.CANCELED,
        planTier: PlanTier.BASICO,
      });
      await expect(service.assertCanCreateFarm('acc-1')).rejects.toThrow(ForbiddenException);
    });

    it('blocks when farm limit is reached', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: SubscriptionStatus.TRIALING,
        planTier: PlanTier.TRIAL,
      });
      prisma.farm.count.mockResolvedValue(2);
      await expect(service.assertCanCreateFarm('acc-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows when under farm limit', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        planTier: PlanTier.PROFISSIONAL,
      });
      prisma.farm.count.mockResolvedValue(3);
      await expect(service.assertCanCreateFarm('acc-1')).resolves.toBeUndefined();
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      await expect(service.cancel('acc-1')).rejects.toThrow(NotFoundException);
    });

    it('cancels Stripe subscription if stripeSubscriptionId exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        accountId: 'acc-1',
        stripeSubscriptionId: 'sub_stripe_123',
      });
      prisma.subscription.update.mockResolvedValue({});

      await service.cancel('acc-1');

      expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123');
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: expect.any(Date) },
      });
    });
  });

  describe('handleWebhook', () => {
    it('activates subscription on checkout.session.completed', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { accountId: 'acc-1', planTier: 'PROFISSIONAL' },
            subscription: 'sub_stripe_456',
          },
        },
      };
      stripe.constructWebhookEvent.mockReturnValue(event);
      prisma.subscription.update.mockResolvedValue({});

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        data: {
          status: SubscriptionStatus.ACTIVE,
          planTier: 'PROFISSIONAL',
          stripeSubscriptionId: 'sub_stripe_456',
        },
      });
    });

    it('sets PAST_DUE on invoice.payment_failed', async () => {
      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: { subscription: 'sub_stripe_789', attempt_count: 2 },
        },
      };
      stripe.constructWebhookEvent.mockReturnValue(event);
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', accountId: 'acc-1' });
      prisma.subscription.update.mockResolvedValue({});

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
    });

    it('cancels on customer.subscription.deleted', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_stripe_123', metadata: { accountId: 'acc-1' } } },
      };
      stripe.constructWebhookEvent.mockReturnValue(event);
      prisma.subscription.update.mockResolvedValue({});

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: expect.any(Date) },
      });
    });
  });

  describe('expireTrials', () => {
    it('suspends trials past their expiration date', async () => {
      prisma.subscription.updateMany.mockResolvedValue({ count: 3 });
      await service.expireTrials();

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { lt: expect.any(Date) },
        },
        data: { status: SubscriptionStatus.SUSPENDED },
      });
    });
  });
});
