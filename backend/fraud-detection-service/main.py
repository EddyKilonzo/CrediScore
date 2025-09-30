"""
FastAPI microservice for advanced fraud detection in reviews
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
import re
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CrediScore Fraud Detection Service",
    description="Advanced fraud detection for reviews and receipts",
    version="1.0.0"
)

# Pydantic models
class ReceiptData(BaseModel):
    businessName: Optional[str] = None
    businessAddress: Optional[str] = None
    businessPhone: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    items: Optional[List[str]] = None
    receiptNumber: Optional[str] = None
    confidence: float = 0.0

class BusinessDetails(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class FraudDetectionRequest(BaseModel):
    review_text: str
    receipt_data: ReceiptData
    business_details: BusinessDetails
    user_reputation: int

class FraudDetectionResponse(BaseModel):
    isFraudulent: bool
    confidence: float
    fraudReasons: List[str]
    riskScore: int

class HealthResponse(BaseModel):
    status: str
    timestamp: str

# Fraud detection patterns
SUSPICIOUS_PATTERNS = [
    r'\b(fake|scam|fraud|cheat|steal|rob)\b',
    r'\b(too good to be true|amazing|incredible|perfect)\b',
    r'\b(avoid|stay away|don\'t go|terrible|awful|horrible)\b',
    r'\b(paid review|sponsored|advertisement)\b',
    r'\b(click here|visit|call now|limited time)\b',
]

SPAM_INDICATORS = [
    r'[A-Z]{3,}',  # Excessive caps
    r'!{3,}',      # Multiple exclamation marks
    r'\$+',        # Dollar signs
    r'www\.|http', # URLs
    r'\d{10,}',    # Long number sequences
]

def calculate_text_quality_score(text: str) -> float:
    """Calculate text quality score based on various factors"""
    if not text or len(text.strip()) < 10:
        return 0.0
    
    score = 0.0
    
    # Length score (optimal around 50-200 characters)
    length = len(text)
    if 50 <= length <= 200:
        score += 30
    elif 20 <= length < 50 or 200 < length <= 500:
        score += 20
    else:
        score += 10
    
    # Sentence structure
    sentences = text.split('.')
    if len(sentences) > 1:
        score += 20
    
    # Word variety (avoid repetition)
    words = text.lower().split()
    unique_words = len(set(words))
    if unique_words > len(words) * 0.7:
        score += 20
    
    # Punctuation and grammar
    if any(p in text for p in ['.', '!', '?']):
        score += 10
    
    # Penalty for suspicious patterns
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            score -= 15
    
    # Penalty for spam indicators
    for pattern in SPAM_INDICATORS:
        if re.search(pattern, text):
            score -= 10
    
    return max(0.0, min(100.0, score))

def analyze_review_sentiment(text: str) -> Dict[str, float]:
    """Simple sentiment analysis"""
    positive_words = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best']
    negative_words = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'disgusting', 'disappointed']
    
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    total_words = len(text.split())
    if total_words == 0:
        return {'positive': 0.0, 'negative': 0.0, 'neutral': 1.0}
    
    positive_score = positive_count / total_words
    negative_score = negative_count / total_words
    neutral_score = 1.0 - positive_score - negative_score
    
    return {
        'positive': positive_score,
        'negative': negative_score,
        'neutral': max(0.0, neutral_score)
    }

def detect_review_patterns(text: str) -> List[str]:
    """Detect suspicious review patterns"""
    patterns = []
    
    # Check for excessive repetition
    words = text.lower().split()
    if len(words) > 10:
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        max_freq = max(word_freq.values())
        if max_freq > len(words) * 0.3:
            patterns.append("Excessive word repetition")
    
    # Check for suspicious patterns
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            patterns.append(f"Suspicious language pattern: {pattern}")
    
    # Check for spam indicators
    for pattern in SPAM_INDICATORS:
        if re.search(pattern, text):
            patterns.append(f"Spam indicator: {pattern}")
    
    # Check for generic reviews
    generic_phrases = [
        "good service", "nice place", "would recommend", "great experience",
        "bad service", "terrible experience", "would not recommend"
    ]
    
    if any(phrase in text.lower() for phrase in generic_phrases):
        patterns.append("Generic review phrases")
    
    return patterns

def validate_receipt_consistency(receipt_data: ReceiptData, business_details: BusinessDetails) -> List[str]:
    """Validate receipt data consistency with business details"""
    issues = []
    
    if receipt_data.businessName and business_details.name:
        # Simple name similarity check
        name_similarity = calculate_string_similarity(
            receipt_data.businessName.lower(),
            business_details.name.lower()
        )
        if name_similarity < 0.7:
            issues.append(f"Business name mismatch (similarity: {name_similarity:.2f})")
    
    if receipt_data.businessAddress and business_details.address:
        address_similarity = calculate_string_similarity(
            receipt_data.businessAddress.lower(),
            business_details.address.lower()
        )
        if address_similarity < 0.6:
            issues.append(f"Address mismatch (similarity: {address_similarity:.2f})")
    
    if receipt_data.amount and receipt_data.amount <= 0:
        issues.append("Invalid amount in receipt")
    
    if receipt_data.date:
        try:
            receipt_date = datetime.fromisoformat(receipt_data.date.replace('Z', '+00:00'))
            now = datetime.now()
            if receipt_date > now:
                issues.append("Future date in receipt")
            elif (now - receipt_date).days > 365:
                issues.append("Receipt too old (>1 year)")
        except ValueError:
            issues.append("Invalid date format in receipt")
    
    return issues

def calculate_string_similarity(str1: str, str2: str) -> float:
    """Calculate string similarity using Levenshtein distance"""
    if not str1 or not str2:
        return 0.0
    
    longer = str1 if len(str1) > len(str2) else str2
    shorter = str2 if len(str1) > len(str2) else str1
    
    if len(longer) == 0:
        return 1.0
    
    distance = levenshtein_distance(longer, shorter)
    return (len(longer) - distance) / len(longer)

def levenshtein_distance(str1: str, str2: str) -> int:
    """Calculate Levenshtein distance between two strings"""
    matrix = [[0] * (len(str2) + 1) for _ in range(len(str1) + 1)]
    
    for i in range(len(str1) + 1):
        matrix[i][0] = i
    for j in range(len(str2) + 1):
        matrix[0][j] = j
    
    for i in range(1, len(str1) + 1):
        for j in range(1, len(str2) + 1):
            if str1[i-1] == str2[j-1]:
                matrix[i][j] = matrix[i-1][j-1]
            else:
                matrix[i][j] = min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + 1
                )
    
    return matrix[len(str1)][len(str2)]

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat()
    )

@app.post("/detect-fraud", response_model=FraudDetectionResponse)
async def detect_fraud(request: FraudDetectionRequest):
    """Detect fraud in review and receipt data"""
    try:
        logger.info(f"Processing fraud detection request for review: {request.review_text[:50]}...")
        
        fraud_reasons = []
        risk_score = 0
        
        # Analyze review text quality
        text_quality = calculate_text_quality_score(request.review_text)
        if text_quality < 30:
            fraud_reasons.append(f"Low text quality score: {text_quality:.1f}")
            risk_score += 25
        
        # Detect suspicious patterns
        patterns = detect_review_patterns(request.review_text)
        fraud_reasons.extend(patterns)
        risk_score += len(patterns) * 10
        
        # Analyze sentiment
        sentiment = analyze_review_sentiment(request.review_text)
        if sentiment['neutral'] > 0.8:
            fraud_reasons.append("Overly neutral sentiment")
            risk_score += 15
        
        # Check user reputation
        if request.user_reputation < 30:
            fraud_reasons.append(f"Low user reputation: {request.user_reputation}")
            risk_score += 20
        
        # Validate receipt consistency
        if request.receipt_data:
            receipt_issues = validate_receipt_consistency(
                request.receipt_data, 
                request.business_details
            )
            fraud_reasons.extend(receipt_issues)
            risk_score += len(receipt_issues) * 15
            
            # Check receipt confidence
            if request.receipt_data.confidence < 0.5:
                fraud_reasons.append(f"Low receipt confidence: {request.receipt_data.confidence:.2f}")
                risk_score += 20
        
        # Determine if fraudulent
        is_fraudulent = risk_score > 60
        confidence = min(risk_score / 100, 1.0)
        
        logger.info(f"Fraud detection completed. Risk score: {risk_score}, Fraudulent: {is_fraudulent}")
        
        return FraudDetectionResponse(
            isFraudulent=is_fraudulent,
            confidence=confidence,
            fraudReasons=fraud_reasons,
            riskScore=risk_score
        )
        
    except Exception as e:
        logger.error(f"Error in fraud detection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fraud detection failed: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CrediScore Fraud Detection Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "detect_fraud": "/detect-fraud"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
