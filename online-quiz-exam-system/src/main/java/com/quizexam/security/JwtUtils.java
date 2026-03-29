package com.quizexam.security;

import com.quizexam.config.KeyVaultSecretProvider;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT utility component for token generation and validation.
 * 
 * Secrets are fetched from Azure Key Vault for enhanced security and centralized management.
 * This migrates from using environment variables to Azure Key Vault to address CWE-321
 * (Use of Hardcoded Cryptographic Keys) vulnerability.
 */
@Component
public class JwtUtils {

    private final KeyVaultSecretProvider keyVaultSecretProvider;

    @Value("${app.jwt.secret-name}")
    private String jwtSecretName;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    public JwtUtils(KeyVaultSecretProvider keyVaultSecretProvider) {
        this.keyVaultSecretProvider = keyVaultSecretProvider;
    }

    /**
     * Fetches the JWT secret from Azure Key Vault and creates a SecretKey.
     * 
     * @return the SecretKey for JWT signing/verification
     */
    private SecretKey key() {
        // Fetch the JWT secret from Azure Key Vault
        String jwtSecret = keyVaultSecretProvider.getSecret(jwtSecretName);
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generates a JWT token for the given username.
     *
     * @param username the username for which to generate the token
     * @return the generated JWT token
     */
    public String generateToken(String username) {
        return Jwts.builder()
            .subject(username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
            .signWith(key())
            .compact();
    }

    /**
     * Extracts the username from a JWT token.
     *
     * @param token the JWT token
     * @return the username extracted from the token
     */
    public String getUsernameFromToken(String token) {
        return Jwts.parser().verifyWith(key()).build()
            .parseSignedClaims(token).getPayload().getSubject();
    }

    /**
     * Validates the JWT token.
     *
     * @param token the JWT token to validate
     * @return true if the token is valid, false otherwise
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key()).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}

