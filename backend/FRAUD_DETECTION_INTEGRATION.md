# Fraud Detection Integration

## Overview

CrediScore now includes a comprehensive fraud detection system that analyzes reviews and business documents in real-time to identify fraudulent content and maintain platform integrity.

## Architecture

### 1. **Python Fraud Detection Service**
- **Location**: `backend/fraud-detection-service/main.py`
- **Technology**: FastAPI with advanced ML algorithms
- **Purpose**: Core fraud detection logic and pattern analysis

### 2. **NestJS Fraud Detection Service**
- **Location**: `backend/src/shared/fraud-detection/`
- **Purpose**: Integration layer between NestJS app and Python service
- **Features**: HTTP client, error handling, fallback mechanisms

### 3. **Integration Points**
- **Review Creation**: Automatic fraud detection during review submission
- **Business Verification**: Document validation and consistency checks
- **Real-time Scanning**: Document analysis during upload process

## Features

### 1. **Review Fraud Detection**
- **Text Quality Analysis**: Length, structure, word variety scoring
- **Sentiment Analysis**: Positive/negative/neutral sentiment detection
- **Pattern Detection**: Suspicious language, spam indicators
- **Reputation Weighting**: User reputation affects fraud scoring
- **Receipt Validation**: Cross-reference with business details

### 2. **Business Document Validation**
- **Document Type Detection**: Certificates, licenses, permits
- **Consistency Checks**: Business name, address, date validation
- **Fraud Pattern Analysis**: Document authenticity verification
- **Trust Score Impact**: Fraud detection affects business trust scores

### 3. **Real-time Processing**
- **Upload-time Analysis**: Immediate fraud detection during file upload
- **Cloudinary Integration**: Seamless document processing workflow
- **Fallback Mechanisms**: Graceful degradation if service unavailable

## API Endpoints

### 1. **Fraud Detection Service**

#### Detect Fraud
```http
POST /fraud-detection/detect
Content-Type: application/json

{
  "review_text": "This place is amazing! Best service ever!",
  "receipt_data": {
    "businessName": "ABC Store",
    "amount": 25.99,
    "date": "2024-01-15",
    "confidence": 0.85
  },
  "business_details": {
    "name": "ABC Store",
    "address": "123 Main St"
  },
  "user_reputation": 75
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isFraudulent": false,
    "confidence": 0.15,
    "fraudReasons": [],
    "riskScore": 15
  }
}
```

#### Analyze Review
```http
POST /fraud-detection/analyze-review
Content-Type: application/json

{
  "reviewText": "Great service and reasonable prices.",
  "userReputation": 80,
  "receiptData": { "confidence": 0.9 },
  "businessDetails": { "name": "ABC Store" }
}
```

#### Health Check
```http
GET /fraud-detection/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. **Python Service Endpoints**

#### Detect Fraud
```http
POST http://localhost:8000/detect-fraud
```

#### Health Check
```http
GET http://localhost:8000/health
```

## Integration Workflow

### 1. **Review Creation Flow**
```
User Submits Review
    ↓
Receipt Validation (if provided)
    ↓
Fraud Detection Analysis
    ↓
Credibility Score Calculation
    ↓
Review Saved with Fraud Status
    ↓
Business Trust Score Updated
```

### 2. **Document Upload Flow**
```
User Uploads Document
    ↓
Cloudinary Storage
    ↓
Real-time Document Scanning
    ↓
Fraud Detection Analysis
    ↓
Document Verification
    ↓
Business Trust Score Update
```

### 3. **Fraud Detection Process**
```
Input Data Analysis
    ↓
Text Quality Scoring
    ↓
Pattern Detection
    ↓
Sentiment Analysis
    ↓
Receipt Validation
    ↓
Risk Score Calculation
    ↓
Fraud Decision
```

## Configuration

### Environment Variables
```env
# Python Fraud Detection Service
PYTHON_FRAUD_SERVICE_URL=http://localhost:8000

# Docker Configuration
FRAUD_RISK_THRESHOLD=60
MODEL_CONFIDENCE_THRESHOLD=0.6
```

### Docker Compose
```yaml
services:
  fraud-detection:
    build: ./fraud-detection-service
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  backend:
    environment:
      - PYTHON_FRAUD_SERVICE_URL=http://fraud-detection:8000
    depends_on:
      fraud-detection:
        condition: service_healthy
```

## Fraud Detection Algorithms

### 1. **Text Quality Scoring**
- **Length Score**: Optimal 50-200 characters (30 points)
- **Sentence Structure**: Multiple sentences (20 points)
- **Word Variety**: Avoid repetition (20 points)
- **Grammar**: Proper punctuation (10 points)
- **Penalties**: Suspicious patterns (-15), spam indicators (-10)

### 2. **Pattern Detection**
- **Suspicious Language**: "fake", "scam", "fraud", "too good to be true"
- **Spam Indicators**: Excessive caps, multiple exclamation marks, URLs
- **Generic Phrases**: "good service", "nice place", "would recommend"
- **Repetition**: Excessive word repetition detection

### 3. **Receipt Validation**
- **Business Name Matching**: Levenshtein distance similarity
- **Address Consistency**: Address similarity checking
- **Date Validation**: Future dates, age limits
- **Amount Validation**: Positive values, reasonable ranges

### 4. **Risk Scoring**
- **Text Quality**: Up to 25 points penalty
- **Pattern Detection**: 10 points per pattern
- **Sentiment Analysis**: 15 points for overly neutral
- **User Reputation**: 20 points for low reputation
- **Receipt Issues**: 15 points per issue
- **Receipt Confidence**: 20 points for low confidence

## Database Integration

### Review Model Updates
```prisma
model Review {
  id          String    @id @default(uuid())
  rating      Int       // 1–5
  comment     String?
  credibility Int       @default(0) // AI/manual scoring
  isVerified  Boolean   @default(false)
  isActive    Boolean   @default(true)
  // Receipt validation fields
  receiptUrl  String?   // URL to uploaded receipt image
  receiptData Json?     // Extracted receipt data from AI
  validationResult Json? // AI validation result
  amount      Float?    // Amount from receipt
  reviewDate  DateTime? // Date of the reviewed transaction
  // ... other fields
}
```

### Fraud Report Model
```prisma
model FraudReport {
  id          String    @id @default(uuid())
  reporter    User      @relation(fields: [reporterId], references: [id])
  reporterId  String
  business    Business  @relation(fields: [businessId], references: [id])
  businessId  String
  // ... other fields
}
```

## Error Handling

### 1. **Service Unavailability**
- **Fallback Response**: Safe default when Python service down
- **Graceful Degradation**: Continue with basic validation
- **Health Monitoring**: Regular health checks and alerts

### 2. **API Errors**
- **Timeout Handling**: 10-second timeout for fraud detection
- **Retry Logic**: Exponential backoff for failed requests
- **Error Logging**: Comprehensive error tracking and monitoring

### 3. **Data Validation**
- **Input Sanitization**: Validate all input data
- **Type Checking**: Ensure proper data types
- **Range Validation**: Check reasonable value ranges

## Performance Considerations

### 1. **Response Time**
- **Target**: < 5 seconds for complete fraud analysis
- **Optimization**: Parallel processing where possible
- **Caching**: Cache results for repeated analysis

### 2. **Scalability**
- **Microservice Architecture**: Independent scaling
- **Load Balancing**: Multiple fraud detection instances
- **Queue Management**: Async processing for high volume

### 3. **Resource Usage**
- **Memory Management**: Efficient data structures
- **CPU Optimization**: Optimized algorithms
- **Network Efficiency**: Minimal data transfer

## Monitoring and Alerting

### 1. **Health Checks**
- **Service Health**: Regular health check endpoints
- **Dependency Monitoring**: Database and external service status
- **Performance Metrics**: Response time and throughput

### 2. **Fraud Detection Metrics**
- **Detection Rate**: Percentage of fraudulent content detected
- **False Positive Rate**: Accuracy of fraud detection
- **Processing Time**: Average analysis duration

### 3. **Business Impact**
- **Trust Score Changes**: Impact on business ratings
- **Review Quality**: Improvement in review authenticity
- **User Behavior**: Changes in user engagement

## Security Considerations

### 1. **Data Protection**
- **Sensitive Data**: Secure handling of personal information
- **API Security**: Authentication and authorization
- **Data Encryption**: Encrypt data in transit and at rest

### 2. **Fraud Prevention**
- **Rate Limiting**: Prevent abuse of fraud detection
- **Input Validation**: Sanitize all user inputs
- **Audit Logging**: Track all fraud detection activities

### 3. **Privacy Compliance**
- **Data Minimization**: Collect only necessary data
- **User Consent**: Clear privacy policies
- **Data Retention**: Appropriate data lifecycle management

## Testing

### 1. **Unit Tests**
- **Service Tests**: Test fraud detection logic
- **Integration Tests**: Test service communication
- **Mock Data**: Use realistic test scenarios

### 2. **Performance Tests**
- **Load Testing**: High volume request handling
- **Stress Testing**: System limits and breaking points
- **Benchmarking**: Performance comparison and optimization

### 3. **Security Tests**
- **Penetration Testing**: Security vulnerability assessment
- **Input Validation**: Malicious input handling
- **Access Control**: Authentication and authorization testing

## Deployment

### 1. **Development Environment**
```bash
# Start fraud detection service
cd fraud-detection-service
python -m uvicorn main:app --reload --port 8000

# Start NestJS backend
cd backend
npm run start:dev
```

### 2. **Production Deployment**
```bash
# Docker Compose
docker-compose up -d

# Health Check
curl http://localhost:8000/health
curl http://localhost:3000/fraud-detection/health
```

### 3. **Monitoring Setup**
- **Health Checks**: Automated service monitoring
- **Log Aggregation**: Centralized logging system
- **Alert Configuration**: Real-time alert notifications

## Troubleshooting

### Common Issues

1. **Service Connection Failed**
   - Check Python service status
   - Verify network connectivity
   - Review environment variables

2. **High False Positive Rate**
   - Adjust fraud detection thresholds
   - Review pattern detection rules
   - Update training data

3. **Performance Issues**
   - Monitor service response times
   - Check resource utilization
   - Optimize database queries

### Support Resources
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)

## Future Enhancements

### 1. **Machine Learning Improvements**
- **Model Training**: Continuous learning from new data
- **Feature Engineering**: Advanced pattern recognition
- **Ensemble Methods**: Multiple model combination

### 2. **Advanced Analytics**
- **Fraud Trends**: Historical fraud pattern analysis
- **Predictive Modeling**: Proactive fraud prevention
- **Risk Assessment**: Dynamic risk scoring

### 3. **Integration Expansion**
- **Third-party Services**: External fraud detection APIs
- **Blockchain Verification**: Immutable fraud records
- **Real-time Streaming**: Live fraud detection pipeline
