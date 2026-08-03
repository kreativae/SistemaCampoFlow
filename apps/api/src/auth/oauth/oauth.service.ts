import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

export interface OAuthUserProfile {
  providerId: string;
  email: string;
  name: string;
}

export interface OAuthProviderStatus {
  provider: OAuthProvider;
  label: string;
  enabled: boolean;
  configured: boolean;
  /** De onde vieram as credenciais em uso. */
  source: 'banco' | 'variavel_de_ambiente' | 'nenhum';
  clientIdMasked: string | null;
  secretSet: boolean;
  /** URL que precisa ser cadastrada no console do provedor. */
  redirectUri: string;
}

interface ProviderDefinition {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  envClientId: string;
  envClientSecret: string;
  /** Normaliza o retorno do endpoint de perfil de cada provedor. */
  parseProfile: (raw: Record<string, unknown>) => OAuthUserProfile | null;
}

// Endpoint "common" do Microsoft aceita conta pessoal (Outlook/Hotmail) e conta
// corporativa/escolar. Um endpoint de tenant específico recusaria contas pessoais.
const PROVIDERS: Record<OAuthProvider, ProviderDefinition> = {
  GOOGLE: {
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
    parseProfile: (raw) => {
      const email = typeof raw.email === 'string' ? raw.email : null;
      const sub = typeof raw.sub === 'string' ? raw.sub : null;
      if (!email || !sub) return null;
      return {
        providerId: sub,
        email,
        name: typeof raw.name === 'string' && raw.name ? raw.name : email,
      };
    },
  },
  MICROSOFT: {
    label: 'Microsoft',
    authorizeUrl:
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    scope: 'openid email profile',
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
    parseProfile: (raw) => {
      // Conta pessoal às vezes não devolve `email`, só `preferred_username`.
      const email =
        (typeof raw.email === 'string' && raw.email) ||
        (typeof raw.preferred_username === 'string' && raw.preferred_username) ||
        null;
      const sub = typeof raw.sub === 'string' ? raw.sub : null;
      if (!email || !sub) return null;
      return {
        providerId: sub,
        email,
        name: typeof raw.name === 'string' && raw.name ? raw.name : email,
      };
    },
  },
  APPLE: {
    label: 'Apple',
    authorizeUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    // A Apple não tem endpoint de perfil: os dados vêm no id_token. Ainda não
    // implementado — o client secret é um JWT que expira em 6 meses e exige
    // rotação, além do tratamento do relay de e-mail.
    userInfoUrl: '',
    scope: 'name email',
    envClientId: 'APPLE_CLIENT_ID',
    envClientSecret: 'APPLE_CLIENT_SECRET',
    parseProfile: () => null,
  },
};

/** Provedores efetivamente disponíveis para login hoje. */
export const SUPPORTED_PROVIDERS: OAuthProvider[] = ['GOOGLE', 'MICROSOFT'];

function maskClientId(value: string): string {
  if (value.length <= 10) return '••••';
  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly jwt: JwtService,
  ) {}

  // O state é um JWT curto: o callback só aceita um valor emitido por nós, para o
  // provedor, ainda dentro da validade. Sem isso, um terceiro poderia forjar um
  // callback e completar um login em nome da vítima (CSRF de OAuth).
  async issueState(provider: OAuthProvider): Promise<string> {
    return this.jwt.signAsync(
      { provider, nonce: Math.random().toString(36).slice(2) },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? '',
        expiresIn: '10m',
      },
    );
  }

  async verifyState(provider: OAuthProvider, state: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<{ provider: OAuthProvider }>(
        state,
        { secret: process.env.JWT_ACCESS_SECRET ?? '' },
      );
      if (payload.provider !== provider) {
        throw new Error('provider mismatch');
      }
    } catch {
      throw new BadRequestException('Sessão de login expirada, tente de novo');
    }
  }

  definition(provider: OAuthProvider): ProviderDefinition {
    return PROVIDERS[provider];
  }

  redirectUri(provider: OAuthProvider): string {
    const base = (process.env.API_PUBLIC_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return `${base}/auth/oauth/${provider.toLowerCase()}/callback`;
  }

  // Credencial do banco tem prioridade; sem ela, cai nas variáveis de ambiente,
  // preservando as instalações que já configuraram o Google por env.
  async resolveConfig(provider: OAuthProvider): Promise<{
    clientId: string | null;
    clientSecret: string | null;
    enabled: boolean;
    source: OAuthProviderStatus['source'];
  }> {
    const def = PROVIDERS[provider];
    const row = await this.prisma.oAuthProviderConfig.findUnique({
      where: { provider },
    });

    if (row?.clientId && row.clientSecret) {
      return {
        clientId: row.clientId,
        clientSecret: this.encryption.decrypt(row.clientSecret),
        enabled: row.enabled,
        source: 'banco',
      };
    }

    const envId = process.env[def.envClientId] || null;
    const envSecret = process.env[def.envClientSecret] || null;
    if (envId && envSecret) {
      // Sem linha no banco, a presença das variáveis já habilita o provedor —
      // é como o Google funcionava antes desta tela existir.
      return {
        clientId: envId,
        clientSecret: envSecret,
        enabled: row?.enabled ?? true,
        source: 'variavel_de_ambiente',
      };
    }

    return { clientId: null, clientSecret: null, enabled: false, source: 'nenhum' };
  }

  async isAvailable(provider: OAuthProvider): Promise<boolean> {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return false;
    const config = await this.resolveConfig(provider);
    return Boolean(config.clientId && config.clientSecret && config.enabled);
  }

  /** Provedores que a tela de login deve exibir. */
  async availableProviders(): Promise<{ provider: OAuthProvider; label: string }[]> {
    const result: { provider: OAuthProvider; label: string }[] = [];
    for (const provider of SUPPORTED_PROVIDERS) {
      if (await this.isAvailable(provider)) {
        result.push({ provider, label: PROVIDERS[provider].label });
      }
    }
    return result;
  }

  async statusList(): Promise<OAuthProviderStatus[]> {
    const list: OAuthProviderStatus[] = [];
    for (const provider of SUPPORTED_PROVIDERS) {
      const config = await this.resolveConfig(provider);
      list.push({
        provider,
        label: PROVIDERS[provider].label,
        enabled: config.enabled,
        configured: Boolean(config.clientId && config.clientSecret),
        source: config.source,
        clientIdMasked: config.clientId ? maskClientId(config.clientId) : null,
        secretSet: Boolean(config.clientSecret),
        redirectUri: this.redirectUri(provider),
      });
    }
    return list;
  }

  async updateConfig(
    provider: OAuthProvider,
    dto: { clientId?: string; clientSecret?: string; enabled?: boolean },
  ): Promise<OAuthProviderStatus[]> {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new BadRequestException('Provedor não suportado');
    }

    // Campo vazio significa "não alterar", para o admin poder ligar/desligar sem
    // reenviar o segredo (que a tela nunca mostra por completo).
    const data: {
      clientId?: string;
      clientSecret?: string;
      enabled?: boolean;
    } = {};
    if (dto.clientId !== undefined && dto.clientId !== '') {
      data.clientId = dto.clientId.trim();
    }
    if (dto.clientSecret !== undefined && dto.clientSecret !== '') {
      data.clientSecret = this.encryption.encrypt(dto.clientSecret.trim());
    }
    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled;
    }

    await this.prisma.oAuthProviderConfig.upsert({
      where: { provider },
      create: { provider, ...data },
      update: data,
    });

    return this.statusList();
  }

  async buildAuthorizeUrl(
    provider: OAuthProvider,
    state: string,
  ): Promise<string> {
    const def = PROVIDERS[provider];
    const config = await this.resolveConfig(provider);
    if (!config.clientId) {
      throw new BadRequestException(`${def.label} não está configurado`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      scope: def.scope,
      state,
    });
    if (provider === 'GOOGLE') {
      // Garante que a conta possa ser trocada em vez de reusar a sessão ativa.
      params.set('prompt', 'select_account');
    }

    return `${def.authorizeUrl}?${params.toString()}`;
  }

  // Troca o código pelo access token e busca o perfil. Falhas de rede ou de
  // credencial viram BadRequest com mensagem em português — o callback redireciona
  // o usuário de volta ao login com esse texto.
  async exchangeCodeForProfile(
    provider: OAuthProvider,
    code: string,
  ): Promise<OAuthUserProfile> {
    const def = PROVIDERS[provider];
    const config = await this.resolveConfig(provider);
    if (!config.clientId || !config.clientSecret) {
      throw new BadRequestException(`${def.label} não está configurado`);
    }

    const tokenResponse = await fetch(def.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri(provider),
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text();
      this.logger.error(
        `Falha ao trocar código por token (${def.label}): ${tokenResponse.status} ${detail}`,
      );
      throw new BadRequestException(
        `Não foi possível concluir o login com ${def.label}`,
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new BadRequestException(
        `Não foi possível concluir o login com ${def.label}`,
      );
    }

    const userResponse = await fetch(def.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userResponse.ok) {
      this.logger.error(
        `Falha ao buscar perfil (${def.label}): ${userResponse.status}`,
      );
      throw new BadRequestException(
        `Não foi possível ler seu perfil no ${def.label}`,
      );
    }

    const raw = (await userResponse.json()) as Record<string, unknown>;
    const profile = def.parseProfile(raw);
    if (!profile) {
      throw new BadRequestException(
        `Sua conta ${def.label} não expôs um e-mail utilizável`,
      );
    }
    return profile;
  }
}
