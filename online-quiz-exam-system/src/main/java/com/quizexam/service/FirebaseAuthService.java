package com.quizexam.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;

/**
 * Initialises the Firebase Admin SDK on startup and exposes a single
 * helper to verify a Firebase ID token coming from the frontend.
 *
 * Setup:
 *  1. Download a service-account JSON from Firebase Console
 *     → Project Settings → Service accounts → Generate new private key
 *  2. Place the file at:
 *       online-quiz-exam-system/src/main/resources/firebase-service-account.json
 *  3. Add it to .gitignore — it contains private credentials.
 */
@Service
public class FirebaseAuthService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthService.class);

    @Value("${firebase.service-account-path:firebase-service-account.json}")
    private String serviceAccountPath;

    @PostConstruct
    public void init() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return; // already initialised (e.g. during tests)
        }
        try {
            InputStream serviceAccount = new ClassPathResource(serviceAccountPath).getInputStream();
            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                .build();
            FirebaseApp.initializeApp(options);
            log.info("Firebase Admin SDK initialised successfully.");
        } catch (IOException e) {
            log.error("""
                    ──────────────────────────────────────────────────────────────
                    Firebase Admin SDK could NOT be initialised.
                    Missing or unreadable service account file: {}

                    To fix:
                      1. Go to Firebase Console → Project Settings → Service accounts
                      2. Click "Generate new private key" and download the JSON
                      3. Save it as: src/main/resources/firebase-service-account.json
                      4. Restart the application.
                    ──────────────────────────────────────────────────────────────
                    """, serviceAccountPath);
            // Do not throw — let the app start; /api/auth/firebase-login will return 503.
        }
    }

    /**
     * Verifies a Firebase ID token and returns the decoded token payload.
     * Throws FirebaseAuthException if the token is invalid or expired.
     */
    public FirebaseToken verifyIdToken(String idToken) throws FirebaseAuthException {
        return FirebaseAuth.getInstance().verifyIdToken(idToken);
    }
}
