import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { AuthService } from './../src/auth/auth.service';

interface AuthResponseBody {
  user?: { id: string; email: string; name: string };
  accessToken?: string;
}

describe('Login social OAuth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  const passwordUser = {
    email: `google-existing-${Date.now()}@campoflow.test`,
    password: 'password123',
    name: 'Existing Password User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(passwordUser);
  });

  afterAll(async () => {
    const identities = await prisma.oAuthIdentity.findMany({
      where: { providerId: { startsWith: 'oauth-test-' } },
      select: { userId: true },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: passwordUser.email },
          { id: { in: identities.map((i) => i.userId) } },
        ],
      },
    });
    await app.close();
  });

  // Não há credencial real de OAuth neste ambiente, então o fluxo de redirect
  // (/auth/oauth/google -> provedor -> callback) não roda de ponta a ponta aqui.
  // O que é totalmente testável sem credencial:
  // (a) as rotas se comportam corretamente quando nada está configurado, e
  // (b) a lógica de vínculo de conta em AuthService.loginWithOAuth, chamada direto
  //     com um perfil decodificado — exatamente o que o callback entregaria.

  it('não lista nenhum provedor quando não há credenciais configuradas', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/oauth/provedores')
      .expect(200);
    expect(res.body).toEqual({ providers: [] });
  });

  it('recusa iniciar login em provedor não configurado', async () => {
    await request(app.getHttpServer()).get('/auth/oauth/google').expect(400);
    await request(app.getHttpServer()).get('/auth/oauth/microsoft').expect(400);
  });

  it('recusa provedor desconhecido', async () => {
    await request(app.getHttpServer()).get('/auth/oauth/facebook').expect(400);
  });

  it('redireciona ao login com erro quando o callback vem sem código', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/oauth/google/callback')
      .expect(302);
    expect(res.headers.location).toContain('/entrar?erro=');
  });

  it('rejects password login for a Google-only account (no passwordHash)', async () => {
    const created = await authService.loginWithOAuth('GOOGLE', {
      providerId: 'oauth-test-only-account',
      email: `google-only-${Date.now()}@campoflow.test`,
      name: 'Google Only',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'anything' })
      .expect(401);
  });

  it('creates a new account on first Google login', async () => {
    const email = `google-new-${Date.now()}@campoflow.test`;
    const result = await authService.loginWithOAuth('GOOGLE', {
      providerId: 'oauth-test-new-user',
      email,
      name: 'Google New User',
    });

    expect(result.user.email).toBe(email);
    expect(result.accessToken).toBeDefined();

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.passwordHash).toBeNull();
    const identity = await prisma.oAuthIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: 'GOOGLE',
          providerId: 'oauth-test-new-user',
        },
      },
    });
    expect(identity?.userId).toBe(dbUser?.id);
  });

  it('links Google to an existing password account with the same email', async () => {
    const result = await authService.loginWithOAuth('GOOGLE', {
      providerId: 'oauth-test-link-existing',
      email: passwordUser.email,
      name: passwordUser.name,
    });

    expect((result.user as AuthResponseBody['user'])?.email).toBe(
      passwordUser.email,
    );

    const dbUser = await prisma.user.findUnique({
      where: { email: passwordUser.email },
    });
    expect(dbUser?.passwordHash).not.toBeNull();
    const identity = await prisma.oAuthIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: 'GOOGLE',
          providerId: 'oauth-test-link-existing',
        },
      },
    });
    expect(identity?.userId).toBe(dbUser?.id);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: passwordUser.email, password: passwordUser.password })
      .expect(201);
  });

  it('reconhece o mesmo usuário num login seguinte (casado pela identidade)', async () => {
    const first = await authService.loginWithOAuth('GOOGLE', {
      providerId: 'oauth-test-repeat-login',
      email: `google-repeat-${Date.now()}@campoflow.test`,
      name: 'Repeat Login',
    });

    const second = await authService.loginWithOAuth('GOOGLE', {
      providerId: 'oauth-test-repeat-login',
      email: 'should-be-ignored@campoflow.test',
      name: 'Repeat Login',
    });

    expect(second.user.id).toBe(first.user.id);
    expect(second.user.email).toBe(first.user.email);
  });
});
