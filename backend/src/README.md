# CrediScore Backend Source Code

## 📁 Project Structure

```
src/
├── auth/                    # Authentication & Authorization
│   ├── auth.controller.ts   # Auth endpoints
│   ├── auth.service.ts      # Auth business logic
│   ├── auth.module.ts       # Auth module configuration
│   ├── dto/                 # Data Transfer Objects
│   │   ├── login.dto.ts     # Login request/response DTOs
│   │   ├── signup.dto.ts    # Signup request/response DTOs
│   │   ├── profile.dto.ts   # User profile DTOs
│   │   ├── error.dto.ts     # Error response DTOs
│   │   ├── user-role.enum.ts # User role enumeration
│   │   └── index.ts         # DTO exports
│   ├── guards/              # Authentication guards
│   ├── strategies/          # Passport strategies
│   └── types.ts             # Auth type definitions
├── business/                # Business management
│   ├── business.controller.ts
│   ├── business.service.ts
│   ├── business.module.ts
│   └── dto/
├── reviews/                 # Review system
│   ├── review.controller.ts
│   ├── review.service.ts
│   ├── review.module.ts
│   └── dto/
├── trust-score/             # AI-powered trust scoring
│   ├── trust-score.controller.ts
│   ├── trust-score.service.ts
│   ├── trust-score.module.ts
│   ├── ai/                  # AI integration
│   │   ├── openai.service.ts
│   │   ├── scoring.service.ts
│   │   └── fraud-detection.service.ts
│   └── dto/
├── documents/               # Document management
│   ├── document.controller.ts
│   ├── document.service.ts
│   ├── document.module.ts
│   └── dto/
├── payments/                # Payment verification
│   ├── payment.controller.ts
│   ├── payment.service.ts
│   ├── payment.module.ts
│   └── dto/
├── fraud-reports/           # Fraud reporting system
│   ├── fraud-report.controller.ts
│   ├── fraud-report.service.ts
│   ├── fraud-report.module.ts
│   └── dto/
├── categories/              # Business categories
│   ├── category.controller.ts
│   ├── category.service.ts
│   ├── category.module.ts
│   └── dto/
├── users/                   # User management
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── user.module.ts
│   └── dto/
├── common/                  # Shared utilities
│   ├── decorators/          # Custom decorators
│   ├── filters/             # Exception filters
│   ├── guards/              # Global guards
│   ├── interceptors/        # Global interceptors
│   ├── pipes/               # Custom pipes
│   └── utils/               # Utility functions
├── config/                  # Configuration
│   ├── database.config.ts
│   ├── auth.config.ts
│   ├── ai.config.ts
│   └── app.config.ts
├── prisma/                  # Database layer
│   ├── prisma.service.ts    # Prisma client service
│   └── prisma.module.ts     # Prisma module
├── app.controller.ts        # Root controller
├── app.service.ts           # Root service
├── app.module.ts            # Root module
└── main.ts                  # Application entry point
```

## 🏗️ Architecture Principles

### 1. **Modular Design**
- Each feature is a self-contained module
- Clear separation of concerns
- Reusable components across modules

### 2. **Domain-Driven Design (DDD)**
- Business logic encapsulated in services
- Rich domain models
- Clear boundaries between domains

### 3. **Clean Architecture**
- Controllers handle HTTP requests
- Services contain business logic
- Repositories handle data access
- DTOs for data validation and transformation

## 🔧 Development Rules

### **Code Organization**

1. **File Naming Convention**
   ```
   feature.controller.ts    # HTTP endpoints
   feature.service.ts       # Business logic
   feature.module.ts        # Module configuration
   feature.dto.ts          # Data transfer objects
   feature.interface.ts    # TypeScript interfaces
   feature.enum.ts         # Enumerations
   feature.guard.ts        # Authentication guards
   feature.strategy.ts     # Passport strategies
   feature.decorator.ts    # Custom decorators
   feature.pipe.ts         # Custom pipes
   feature.filter.ts       # Exception filters
   feature.interceptor.ts  # Interceptors
   ```

2. **Import Order**
   ```typescript
   // 1. Node.js built-in modules
   import { readFileSync } from 'fs';
   
   // 2. External libraries
   import { Injectable } from '@nestjs/common';
   import { PrismaService } from '../prisma/prisma.service';
   
   // 3. Internal modules (relative imports)
   import { CreateUserDto } from './dto/create-user.dto';
   import { UserRepository } from './interfaces/user.repository';
   ```

3. **Class Structure**
   ```typescript
   @Injectable()
   export class FeatureService {
     // 1. Private readonly properties
     private readonly logger = new Logger(FeatureService.name);
     
     // 2. Constructor
     constructor(
       private readonly prisma: PrismaService,
       private readonly configService: ConfigService,
     ) {}
     
     // 3. Public methods
     async createFeature(dto: CreateFeatureDto): Promise<Feature> {
       // Implementation
     }
     
     // 4. Private methods
     private validateFeature(feature: Feature): boolean {
       // Implementation
     }
   }
   ```

### **Error Handling**

1. **Use NestJS Built-in Exceptions**
   ```typescript
   throw new BadRequestException('Invalid input data');
   throw new UnauthorizedException('Invalid credentials');
   throw new NotFoundException('Resource not found');
   throw new ConflictException('Resource already exists');
   throw new InternalServerErrorException('Something went wrong');
   ```

2. **Custom Exception Filter**
   ```typescript
   @Catch()
   export class GlobalExceptionFilter implements ExceptionFilter {
     catch(exception: unknown, host: ArgumentsHost) {
       // Log error and return formatted response
     }
   }
   ```

3. **Logging Strategy**
   ```typescript
   // Always log errors with context
   this.logger.error('Failed to create user', {
     error: error.message,
     userId: dto.id,
     timestamp: new Date().toISOString(),
   });
   ```

### **Validation Rules**

1. **DTO Validation**
   ```typescript
   export class CreateUserDto {
     @IsString()
     @IsNotEmpty()
     @MinLength(2)
     @MaxLength(100)
     name: string;
     
     @IsEmail()
     @IsNotEmpty()
     email: string;
     
     @IsString()
     @IsNotEmpty()
     @MinLength(8)
     @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
     password: string;
   }
   ```

2. **Custom Validators**
   ```typescript
   @ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
   export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
     validate(phoneNumber: string): boolean {
       return /^\+?[1-9]\d{1,14}$/.test(phoneNumber);
     }
   }
   ```

### **Security Rules**

1. **Authentication**
   ```typescript
   @UseGuards(JwtAuthGuard)
   @Get('profile')
   async getProfile(@Request() req) {
     return req.user;
   }
   ```

2. **Authorization**
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles('ADMIN', 'BUSINESS_OWNER')
   @Post('business')
   async createBusiness(@Body() dto: CreateBusinessDto) {
     // Implementation
   }
   ```

3. **Input Sanitization**
   ```typescript
   @Transform(({ value }) => value?.trim())
   @IsString()
   name: string;
   ```

### **Database Rules**

1. **Prisma Service Usage**
   ```typescript
   // Always use transactions for multiple operations
   await this.prisma.$transaction(async (tx) => {
     const user = await tx.user.create({ data: userData });
     const business = await tx.business.create({ data: businessData });
     return { user, business };
   });
   ```

2. **Query Optimization**
   ```typescript
   // Use select to limit fields
   const users = await this.prisma.user.findMany({
     select: {
       id: true,
       name: true,
       email: true,
     },
   });
   
   // Use include for relations
   const business = await this.prisma.business.findUnique({
     where: { id },
     include: {
       reviews: true,
       trustScore: true,
     },
   });
   ```

### **Testing Rules**

1. **Unit Tests**
   ```typescript
   describe('UserService', () => {
     let service: UserService;
     let prismaService: PrismaService;
     
     beforeEach(async () => {
       const module: TestingModule = await Test.createTestingModule({
         providers: [UserService, PrismaService],
       }).compile();
       
       service = module.get<UserService>(UserService);
       prismaService = module.get<PrismaService>(PrismaService);
     });
     
     it('should create a user', async () => {
       const createUserDto = { name: 'John', email: 'john@example.com' };
       const result = await service.create(createUserDto);
       
       expect(result).toBeDefined();
       expect(result.name).toBe(createUserDto.name);
     });
   });
   ```

2. **E2E Tests**
   ```typescript
   describe('Users (e2e)', () => {
     let app: INestApplication;
     
     beforeEach(async () => {
       const moduleFixture: TestingModule = await Test.createTestingModule({
         imports: [AppModule],
       }).compile();
       
       app = moduleFixture.createNestApplication();
       await app.init();
     });
     
     it('/users (POST)', () => {
       return request(app.getHttpServer())
         .post('/users')
         .send({ name: 'John', email: 'john@example.com' })
         .expect(201);
     });
   });
   ```

## 🤖 AI Integration Guidelines

### **AI Service Structure**
```typescript
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  
  constructor(
    private readonly openaiService: OpenAIService,
    private readonly configService: ConfigService,
  ) {}
  
  async analyzeReview(review: string): Promise<ReviewAnalysis> {
    try {
      const prompt = this.buildReviewAnalysisPrompt(review);
      const response = await this.openaiService.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      
      return this.parseReviewAnalysis(response.choices[0].message.content);
    } catch (error) {
      this.logger.error('Failed to analyze review', error);
      throw new InternalServerErrorException('AI analysis failed');
    }
  }
  
  private buildReviewAnalysisPrompt(review: string): string {
    return `
      Analyze this business review for credibility and authenticity:
      "${review}"
      
      Return a JSON response with:
      - credibility_score: number (0-100)
      - is_authentic: boolean
      - sentiment: 'positive' | 'negative' | 'neutral'
      - key_indicators: string[]
    `;
  }
}
```

### **AI Configuration**
```typescript
// config/ai.config.ts
export const aiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3,
  },
  trustScoring: {
    enabled: process.env.AI_TRUST_SCORING_ENABLED === 'true',
    updateInterval: parseInt(process.env.AI_UPDATE_INTERVAL) || 24, // hours
  },
  fraudDetection: {
    enabled: process.env.AI_FRAUD_DETECTION_ENABLED === 'true',
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.8,
  },
};
```

## 📊 API Documentation

### **Swagger Configuration**
```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('CrediScore API')
  .setDescription('Business Trust & Review Platform API')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('Authentication', 'User authentication endpoints')
  .addTag('Business', 'Business management endpoints')
  .addTag('Reviews', 'Review system endpoints')
  .addTag('Trust Score', 'AI-powered trust scoring')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### **API Response Standards**
```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [ ... ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🚀 Deployment Rules

### **Environment Configuration**
```typescript
// config/app.config.ts
export const appConfig = {
  port: parseInt(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
};
```

### **Health Checks**
```typescript
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthCheckService,
  ) {}
  
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.$queryRaw`SELECT 1`,
      () => this.checkExternalServices(),
    ]);
  }
}
```

## 📝 Code Review Checklist

- [ ] Code follows naming conventions
- [ ] Proper error handling implemented
- [ ] Input validation added
- [ ] Security measures applied
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Performance considerations addressed
- [ ] Logging added for debugging
- [ ] Environment variables properly configured
- [ ] Database queries optimized

## 🔍 Monitoring & Observability

### **Logging Standards**
```typescript
// Use structured logging
this.logger.log('User created successfully', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});

this.logger.warn('Rate limit exceeded', {
  ip: request.ip,
  endpoint: request.url,
  timestamp: new Date().toISOString(),
});

this.logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
});
```

### **Metrics Collection**
```typescript
// Track business metrics
@Injectable()
export class MetricsService {
  private readonly userCreatedCounter = new Counter({
    name: 'users_created_total',
    help: 'Total number of users created',
  });
  
  private readonly reviewCreatedCounter = new Counter({
    name: 'reviews_created_total',
    help: 'Total number of reviews created',
  });
  
  incrementUserCreated() {
    this.userCreatedCounter.inc();
  }
  
  incrementReviewCreated() {
    this.reviewCreatedCounter.inc();
  }
}
```

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

---

**Remember**: Always prioritize security, performance, and maintainability in your code. Follow these guidelines to ensure consistency and quality across the entire codebase.
