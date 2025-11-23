import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../shared/decorators/public.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../shared/interfaces';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user and return access token and refresh token',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User credentials for authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful or 2FA required',
    schema: {
      oneOf: [
        {
          type: 'object',
          description: 'Successful login (2FA not enabled)',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '550e8400-e29b-41d4-a716-446655440000',
                },
                email: { type: 'string', example: 'user@example.com' },
                username: { type: 'string', example: 'john_doe' },
                firstName: { type: 'string', example: 'John' },
                lastName: { type: 'string', example: 'Doe' },
                role: {
                  type: 'string',
                  enum: [
                    'SUPER_ADMIN',
                    'FINANCE_MANAGER',
                    'OPERATIONS_CLERK',
                    'PAYMENT_CLERK',
                    'CUSTOMER',
                  ],
                },
              },
            },
            accessToken: {
              type: 'string',
              example: 'REDACTED_JWT...',
            },
            refreshToken: {
              type: 'string',
              example: 'REDACTED_JWT...',
            },
          },
        },
        {
          type: 'object',
          description: '2FA required (user has 2FA enabled)',
          properties: {
            requiresTwoFactor: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example: 'Two-factor authentication required',
            },
            userId: {
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Validation failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['email must be a valid email'],
        },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generate new access token using refresh token',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token to generate new access token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'REDACTED_JWT...',
        },
        refreshToken: {
          type: 'string',
          example: 'REDACTED_JWT...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired refresh token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid refresh token' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user',
    description: 'Get information about the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        email: { type: 'string', example: 'user@example.com' },
        username: { type: 'string', example: 'john_doe' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        role: {
          type: 'string',
          enum: [
            'SUPER_ADMIN',
            'FINANCE_MANAGER',
            'OPERATIONS_CLERK',
            'PAYMENT_CLERK',
            'CUSTOMER',
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  getMe(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'User logout',
    description: 'Logout user and invalidate refresh token(s)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Optional refresh token to invalidate specific session',
          example: 'REDACTED_JWT...',
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logout successful' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async logout(
    @Request() req: AuthenticatedRequest,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.logout(req.user.id, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description:
      'Logout user from all sessions and invalidate all refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout from all devices successful',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Logout from all devices successful',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async logoutAll(@Request() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password',
    description: 'Change user password using current password verification',
  })
  @ApiBody({
    type: ChangePasswordDto,
    description: 'Password change request with current and new passwords',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Password changed successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or password requirements not met',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Current password is incorrect',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Validation failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['newPassword must be longer than or equal to 8 characters'],
        },
        error: { type: 'string', example: 'Unprocessable Entity' },
      },
    },
  })
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  // Two-Factor Authentication endpoints
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enable 2FA',
    description:
      'Generate QR code and secret for enabling two-factor authentication',
  })
  @ApiResponse({
    status: 200,
    description: '2FA setup initiated successfully',
    schema: {
      type: 'object',
      properties: {
        secret: { type: 'string', example: 'JBSWY3DPEHPK3PXP' },
        qrCode: { type: 'string', example: 'data:image/png;base64,...' },
        manualEntryKey: { type: 'string', example: 'JBSWY3DPEHPK3PXP' },
        otpAuthUrl: { type: 'string', example: 'otpauth://totp/...' },
      },
    },
  })
  async enableTwoFactor(@Request() req: AuthenticatedRequest) {
    return this.authService.enableTwoFactor(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify and enable 2FA',
    description: 'Verify TOTP token and enable two-factor authentication',
  })
  @ApiBody({ type: VerifyTwoFactorDto })
  @ApiResponse({
    status: 200,
    description: '2FA enabled successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: '2FA has been enabled successfully',
        },
      },
    },
  })
  async verifyAndEnableTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() verifyDto: VerifyTwoFactorDto,
  ) {
    return this.authService.verifyAndEnableTwoFactor(
      req.user.id,
      verifyDto,
      verifyDto.phoneNumber,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable 2FA',
    description: 'Disable two-factor authentication',
  })
  @ApiBody({ type: VerifyTwoFactorDto })
  @ApiResponse({
    status: 200,
    description: '2FA disabled successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: '2FA has been disabled successfully',
        },
      },
    },
  })
  async disableTwoFactor(
    @Request() req: AuthenticatedRequest,
    @Body() verifyDto: VerifyTwoFactorDto,
  ) {
    return this.authService.disableTwoFactor(req.user.id, verifyDto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/backup-code')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request SMS backup code',
    description: 'Send SMS backup verification code for 2FA',
  })
  @ApiResponse({
    status: 200,
    description: 'Backup code sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Backup verification code sent via SMS',
        },
      },
    },
  })
  async requestSmsBackupCode(@Request() req: AuthenticatedRequest) {
    return this.authService.requestSmsBackupCode(req.user.id);
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with 2FA',
    description: 'Login with username/password and 2FA token',
  })
  @ApiBody({
    schema: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/LoginDto' },
        {
          type: 'object',
          properties: {
            twoFactorToken: {
              type: 'string',
              description: '6-digit 2FA token',
              example: '123456',
            },
          },
          required: ['twoFactorToken'],
        },
      ],
    },
  })
  @ApiResponse({
    status: 200,
    description: '2FA login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  async loginWithTwoFactor(
    @Body() loginDto: LoginDto,
    @Body('twoFactorToken') twoFactorToken: string,
  ) {
    return this.authService.loginWithTwoFactor(loginDto, twoFactorToken);
  }
}
