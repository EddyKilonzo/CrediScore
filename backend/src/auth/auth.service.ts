import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, DbUser } from './types';

// Typed wrappers to satisfy strict lint rules
const bcryptHash: (data: string, salt: number) => Promise<string> = (
  bcrypt as unknown as {
    hash: (d: string, s: number) => Promise<string>;
  }
).hash;
const bcryptCompare: (data: string, encrypted: string) => Promise<boolean> = (
  bcrypt as unknown as {
    compare: (d: string, e: string) => Promise<boolean>;
  }
).compare;

type CreateUserInput = { name: string; email: string; password: string };

interface UserRepository {
  findByEmail(email: string): Promise<DbUser | null>;
  create(data: CreateUserInput): Promise<DbUser>;
}

class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<DbUser | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = (await this.prisma.user.findUnique({
      where: { email },
    })) as DbUser | null;
    return user;
  }

  async create(data: CreateUserInput): Promise<DbUser> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = (await this.prisma.user.create({ data })) as DbUser;
    return user;
  }
}

@Injectable()
export class AuthService {
  private readonly users: UserRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.users = new PrismaUserRepository(this.prisma);
  }

  async signup(dto: SignUpDto): Promise<AuthResponse> {
    try {
      // Check if email already exists
      const existingUser = await this.users.findByEmail(dto.email);
      if (existingUser) {
        throw new BadRequestException('Email already registered.');
      }

      // Hash password
      const hashedPassword: string = await bcryptHash(dto.password, 10);

      // Create user
      const user = await this.users.create({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      });

      // Generate JWT
      const token: string = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      return {
        message: 'Signup successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('Signup error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something went wrong during signup.',
      );
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      const user = await this.users.findByEmail(dto.email);

      if (!user) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      const passwordValid: boolean = await bcryptCompare(
        dto.password,
        user.password,
      );
      if (!passwordValid) {
        throw new UnauthorizedException('Invalid email or password.');
      }

      // Generate JWT
      const token: string = this.jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      return {
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('Login error:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something went wrong during login.',
      );
    }
  }
}
