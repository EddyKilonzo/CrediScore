# CrediScore Fraud Detection Service

A FastAPI microservice for advanced fraud detection in reviews and receipts using machine learning and pattern analysis.

## Features

- **Text Quality Analysis**: Evaluates review text quality based on length, structure, and grammar
- **Pattern Detection**: Identifies suspicious patterns and spam indicators
- **Sentiment Analysis**: Analyzes review sentiment for authenticity
- **Receipt Validation**: Validates receipt data consistency with business details
- **User Reputation Integration**: Considers user reputation in fraud assessment
- **Machine Learning Models**: Uses TensorFlow/PyTorch for advanced fraud detection

## Installation

### Using Docker (Recommended)

```bash
# Build the Docker image
docker build -t crediscore-fraud-detection .

# Run the container
docker run -p 8000:8000 crediscore-fraud-detection
```

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Health Check
```
GET /health
```

### Fraud Detection
```
POST /detect-fraud
```

**Request Body:**
```json
{
  "review_text": "This business is amazing! Great service!",
  "receipt_data": {
    "businessName": "Example Business",
    "businessAddress": "123 Main St",
    "businessPhone": "+1234567890",
    "amount": 25.50,
    "date": "2024-01-15",
    "items": ["Item 1", "Item 2"],
    "receiptNumber": "R123456",
    "confidence": 0.95
  },
  "business_details": {
    "name": "Example Business",
    "address": "123 Main St",
    "phone": "+1234567890",
    "email": "contact@example.com"
  },
  "user_reputation": 85
}
```

**Response:**
```json
{
  "isFraudulent": false,
  "confidence": 0.15,
  "fraudReasons": [],
  "riskScore": 15
}
```

## Fraud Detection Algorithms

### 1. Text Quality Analysis
- **Length Score**: Optimal review length (50-200 characters)
- **Sentence Structure**: Proper sentence formation
- **Word Variety**: Avoids excessive repetition
- **Grammar Check**: Basic punctuation and grammar

### 2. Pattern Detection
- **Suspicious Keywords**: Detects fraud-related terms
- **Spam Indicators**: Identifies spam patterns
- **Generic Phrases**: Flags overly generic reviews
- **Repetition Analysis**: Detects excessive word repetition

### 3. Sentiment Analysis
- **Positive/Negative Word Detection**: Simple sentiment scoring
- **Neutrality Check**: Flags overly neutral reviews
- **Emotional Extremes**: Detects suspicious emotional patterns

### 4. Receipt Validation
- **Business Name Matching**: Compares receipt business name with registered business
- **Address Validation**: Validates business address consistency
- **Amount Validation**: Checks for valid transaction amounts
- **Date Validation**: Ensures receipt dates are reasonable

### 5. User Reputation Integration
- **Reputation Scoring**: Considers user's historical reputation
- **Trust Factors**: Weighted scoring based on user trust level

## Configuration

### Environment Variables
```bash
# Service Configuration
PYTHON_FRAUD_SERVICE_URL=http://localhost:8000
LOG_LEVEL=INFO

# Model Configuration
MODEL_CONFIDENCE_THRESHOLD=0.6
FRAUD_RISK_THRESHOLD=60
```

### Model Parameters
- **Risk Score Threshold**: 60 (above this is considered fraudulent)
- **Confidence Threshold**: 0.6 (minimum confidence for validation)
- **Text Quality Threshold**: 30 (minimum quality score)

## Integration with NestJS Backend

The service is designed to be called from the NestJS backend:

```typescript
// In your NestJS service
const fraudResult = await this.aiService.detectFraudWithPythonService(
  reviewText,
  receiptData,
  businessDetails,
  userReputation
);

if (fraudResult.isFraudulent) {
  // Handle fraudulent review
  console.log('Fraud detected:', fraudResult.fraudReasons);
}
```

## Performance Considerations

- **Response Time**: Average response time < 500ms
- **Concurrency**: Supports up to 100 concurrent requests
- **Memory Usage**: ~200MB base memory usage
- **CPU Usage**: Optimized for efficient processing

## Monitoring and Logging

- **Health Checks**: Built-in health check endpoint
- **Structured Logging**: JSON-formatted logs for monitoring
- **Error Handling**: Comprehensive error handling and reporting
- **Metrics**: Request/response metrics for performance monitoring

## Security

- **Input Validation**: Comprehensive input validation using Pydantic
- **Rate Limiting**: Built-in rate limiting (configurable)
- **Error Sanitization**: Sanitized error messages to prevent information leakage
- **CORS Support**: Configurable CORS for cross-origin requests

## Development

### Adding New Fraud Detection Patterns

1. Add pattern to `SUSPICIOUS_PATTERNS` or `SPAM_INDICATORS`
2. Update `detect_review_patterns()` function
3. Test with sample data
4. Deploy and monitor

### Extending ML Models

1. Add new model files to `/models` directory
2. Update `requirements.txt` with new dependencies
3. Modify detection logic in `main.py`
4. Test and validate performance

## Deployment

### Docker Compose
```yaml
version: '3.8'
services:
  fraud-detection:
    build: .
    ports:
      - "8000:8000"
    environment:
      - LOG_LEVEL=INFO
    restart: unless-stopped
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fraud-detection
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fraud-detection
  template:
    metadata:
      labels:
        app: fraud-detection
    spec:
      containers:
      - name: fraud-detection
        image: crediscore-fraud-detection:latest
        ports:
        - containerPort: 8000
        env:
        - name: LOG_LEVEL
          value: "INFO"
```

## Testing

### Unit Tests
```bash
pytest tests/unit/
```

### Integration Tests
```bash
pytest tests/integration/
```

### Load Testing
```bash
# Using locust
locust -f tests/load/locustfile.py --host=http://localhost:8000
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.
