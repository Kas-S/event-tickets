#!/bin/bash

# Script to manually update Swagger documentation
# Usage: ./scripts/update-swagger.sh

set -e

echo "🔄 Updating Swagger Documentation..."

# Get stack outputs
echo "📋 Getting stack information..."
API_ID=$(aws cloudformation describe-stacks --stack-name InfraStack-ApiStack --query "Stacks[0].Outputs[?OutputKey=='ApiId'].OutputValue" --output text)
STAGE_NAME=$(aws cloudformation describe-stacks --stack-name InfraStack-ApiStack --query "Stacks[0].Outputs[?OutputKey=='ApiStage'].OutputValue" --output text)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name InfraStack-FrontendStack --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name InfraStack-FrontendStack --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

echo "  API ID: $API_ID"
echo "  Stage: $STAGE_NAME"
echo "  Bucket: $BUCKET_NAME"
echo "  Distribution: $DISTRIBUTION_ID"

# Export OpenAPI spec
echo ""
echo "📥 Exporting OpenAPI specification..."
aws apigateway get-export \
  --rest-api-id "$API_ID" \
  --stage-name "$STAGE_NAME" \
  --export-type oas30 \
  --accepts application/json \
  /tmp/openapi.json

echo "✅ Spec exported to /tmp/openapi.json"

# Upload to S3
echo ""
echo "📤 Uploading to S3..."
aws s3 cp /tmp/openapi.json "s3://$BUCKET_NAME/swagger/openapi.json" \
  --content-type application/json \
  --cache-control no-cache

echo "✅ Uploaded to S3"

# Invalidate CloudFront cache
echo ""
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/swagger/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✅ Invalidation created: $INVALIDATION_ID"

# Clean up
rm /tmp/openapi.json

echo ""
echo "✨ Swagger documentation updated successfully!"
echo "🌐 View at: https://$(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.DomainName' --output text)/swagger/"
