package com.quizexam.config;

import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.security.keyvault.secrets.SecretClient;
import com.azure.security.keyvault.secrets.SecretClientBuilder;
import com.azure.security.keyvault.secrets.models.KeyVaultSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Component to fetch secrets from Azure Key Vault.
 * This component uses DefaultAzureCredential which supports multiple authentication methods:
 * - Environment variables
 * - System-assigned managed identity
 * - User-assigned managed identity
 * - Service principal
 */
@Component
public class KeyVaultSecretProvider {

    private final String keyVaultUri;
    private final SecretClient secretClient;
    private final Map<String, String> secretCache = new HashMap<>();
    private static final long CACHE_TTL = 3600000; // 1 hour in milliseconds
    private final Map<String, Long> cacheTimes = new HashMap<>();

    public KeyVaultSecretProvider(@Value("${azure.keyvault.uri}") String keyVaultUri) {
        this.keyVaultUri = keyVaultUri;
        
        // Initialize SecretClient with DefaultAzureCredential
        this.secretClient = new SecretClientBuilder()
            .vaultUrl(keyVaultUri)
            .credential(new DefaultAzureCredentialBuilder().build())
            .buildClient();
    }

    /**
     * Retrieves a secret from Azure Key Vault with caching.
     * 
     * @param secretName the name of the secret to retrieve
     * @return the secret value
     * @throws IllegalArgumentException if the secret is not found
     */
    public String getSecret(String secretName) {
        // Check cache first
        if (secretCache.containsKey(secretName)) {
            Long cachedTime = cacheTimes.get(secretName);
            if (System.currentTimeMillis() - cachedTime < CACHE_TTL) {
                return secretCache.get(secretName);
            } else {
                // Cache expired, remove from cache
                secretCache.remove(secretName);
                cacheTimes.remove(secretName);
            }
        }

        try {
            KeyVaultSecret secret = secretClient.getSecret(secretName);
            String secretValue = secret.getValue();
            
            // Cache the secret
            secretCache.put(secretName, secretValue);
            cacheTimes.put(secretName, System.currentTimeMillis());
            
            return secretValue;
        } catch (Exception e) {
            throw new IllegalArgumentException(
                "Failed to retrieve secret '" + secretName + "' from Azure Key Vault at " + keyVaultUri, e);
        }
    }

    /**
     * Clears the secret cache. Useful for testing or forcing refresh.
     */
    public void clearCache() {
        secretCache.clear();
        cacheTimes.clear();
    }

    /**
     * Clears the cache for a specific secret.
     *
     * @param secretName the name of the secret to clear from cache
     */
    public void clearCache(String secretName) {
        secretCache.remove(secretName);
        cacheTimes.remove(secretName);
    }
}
