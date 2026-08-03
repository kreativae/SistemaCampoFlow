import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import { OAuthService, SUPPORTED_PROVIDERS } from './oauth/oauth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  // Tighter-than-global limits on the routes most attractive to brute-force/abuse
  // (credential stuffing on login, spam registrations, password-reset flooding).
  // The global ThrottlerModule default (100 req/min) still applies everywhere else.
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Limit set above LOGIN_LOCKOUT_THRESHOLD so the account-lockout check (which is
  // per-account, not per-IP) is what kicks in first for a slow/targeted attack —
  // this throttle exists to cap raw request volume, not replace the lockout.
  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('esqueci-senha')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('redefinir-senha')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user.id, user.email);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  enableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyMfaDto) {
    return this.authService.enableMfa(user.id, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  disableMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.disableMfa(user.id);
  }

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  exportPersonalData(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.exportPersonalData(user.id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.deleteAccount(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('me/alterar-senha')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  async registerPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { token: string; platform?: string },
  ) {
    await this.authService.savePushToken(user.id, body.token);
    return { success: true };
  }

  // Provedores que a tela de login deve exibir. Público: é consultado antes do login.
  @Get('oauth/provedores')
  async oauthProviders() {
    return { providers: await this.oauthService.availableProviders() };
  }

  @Get('oauth/:provider')
  async oauthStart(
    @Param('provider') providerParam: string,
    @Res() res: Response,
  ) {
    const provider = this.parseProvider(providerParam);
    if (!(await this.oauthService.isAvailable(provider))) {
      throw new BadRequestException('Provedor de login indisponível');
    }
    // `state` assinado protege contra CSRF: o callback só aceita um state emitido
    // por nós e ainda válido.
    const state = await this.oauthService.issueState(provider);
    res.redirect(await this.oauthService.buildAuthorizeUrl(provider, state));
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') providerParam: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const webBase = (process.env.WEB_BASE_URL || 'http://localhost:3100').replace(
      /\/$/,
      '',
    );
    const failRedirect = (message: string) =>
      res.redirect(`${webBase}/entrar?erro=${encodeURIComponent(message)}`);

    try {
      const provider = this.parseProvider(providerParam);
      // O usuário pode ter cancelado na tela do provedor.
      if (error) return failRedirect('Login cancelado');
      if (!code || !state) return failRedirect('Resposta inválida do provedor');
      await this.oauthService.verifyState(provider, state);

      const profile = await this.oauthService.exchangeCodeForProfile(
        provider,
        code,
      );
      const { accessToken, refreshToken } = await this.authService.loginWithOAuth(
        provider,
        profile,
      );

      const redirectBase =
        process.env.WEB_OAUTH_REDIRECT_URL || `${webBase}/oauth/callback`;
      res.redirect(
        `${redirectBase}?accessToken=${encodeURIComponent(
          accessToken,
        )}&refreshToken=${encodeURIComponent(refreshToken)}`,
      );
    } catch (err) {
      return failRedirect(
        err instanceof BadRequestException
          ? (err.getResponse() as { message?: string }).message ||
              'Falha no login social'
          : 'Falha no login social',
      );
    }
  }

  private parseProvider(value: string): OAuthProvider {
    const upper = value.toUpperCase();
    if (!SUPPORTED_PROVIDERS.includes(upper as OAuthProvider)) {
      throw new BadRequestException('Provedor não suportado');
    }
    return upper as OAuthProvider;
  }
}
