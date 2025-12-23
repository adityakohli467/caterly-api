import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Initialize secrets from AWS Secrets Manager
 * Falls back to environment variables if not configured
 */
export async function initializeSecrets(): Promise<void> {
  const secretName = process.env.SECRET_NAME || process.env.AWS_SECRET_NAME;
  
  if (!secretName) {
    return;
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      }),
    );

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      
      // Set environment variables from secrets
      Object.keys(secrets).forEach((key) => {
        if (!process.env[key]) {
          process.env[key] = secrets[key];
        }
      });
    }
  } catch (error) {
    console.error('Error fetching secrets from AWS Secrets Manager:', error);
    throw error;
  }
}

