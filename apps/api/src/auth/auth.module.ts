import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BillingModule } from '../billing/billing.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OAuthService } from './oauth/oauth.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), BillingModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OAuthService],
  exports: [AuthService, OAuthService],
})
export class AuthModule {}
