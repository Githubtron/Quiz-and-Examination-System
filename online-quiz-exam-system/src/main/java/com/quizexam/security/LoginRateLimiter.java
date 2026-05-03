package com.quizexam.security;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 5;
    private static final long WINDOW_MS = 60_000;

    private final ConcurrentHashMap<String, Deque<Long>> attempts = new ConcurrentHashMap<>();

    public boolean isAllowed(String key) {
        long now = System.currentTimeMillis();
        Deque<Long> deque = attempts.compute(key, (k, d) -> {
            if (d == null) d = new ArrayDeque<>();
            while (!d.isEmpty() && now - d.peekFirst() > WINDOW_MS) d.pollFirst();
            d.addLast(now);
            return d;
        });
        return deque.size() <= MAX_ATTEMPTS;
    }
}
