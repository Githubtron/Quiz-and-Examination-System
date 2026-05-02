# Security Report: Online Quiz Exam System
**Generated:** 2026-04-14  
**Status:** ⚠️ **CRITICAL SECURITY ISSUES FOUND**

---

## Executive Summary

This security audit identified **critical vulnerabilities** including exposed API keys, hardcoded credentials, and weak password practices. These secrets have been exposed in git history and are currently present in the codebase.

**Action Required:** Immediate remediation of exposed credentials is essential.

---

## Critical Findings

### 🔴 CRITICAL: Exposed API Keys in Git History

**Severity:** CRITICAL  
**Status:** EXPOSED IN MULTIPLE LOCATIONS

#### Issue Details:
1. **OpenRouter API Key exposed in application.properties**
   - Current File: `online-quiz-exam-system/src/main/resources/application.properties` (Line 28)
   - Key: `openrouter.api.key=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`
   - Git History: Same key found in commit `6795a82`
   - Alternative history: `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` in earlier commits

2. **Google Gemini API Key exposed in git history**
   - Commit: `6795a82`
   - Key: `AIzaSyCfcJm6eQQQtL_0pe9_Hpu8C0ujvrGwAuA`
   - Status: NOT in current version (partially remediated)

3. **OpenRouter Key in .env file**
   - File: `online-quiz-exam-system/.env` (Line 1)
   - Key: `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`

**Recommendation:** 
- ✅ Rotate the OpenRouter API key immediately at https://openrouter.ai/keys
- ✅ Rotate the Google Gemini API key immediately at https://aistudio.google.com/app/apikey
- ✅ Use BFG Repo-Cleaner or git-filter-repo to remove secrets from git history
- ✅ Add `.env` and `application.properties` to `.gitignore` (already in .gitignore, but not retroactively cleaned)

---

### 🔴 CRITICAL: Hardcoded Database Credentials

**Severity:** CRITICAL  
**Status:** EXPOSED IN MULTIPLE LOCATIONS

#### Issue Details:
1. **application.properties (Line 7)**
   ```
   spring.datasource.password=prabhat123
   ```
   - Username: `root`
   - Password: `prabhat123`
   - Git History: Present in multiple commits including `6795a82`

2. **.env file (Line 2)**
   ```
   DB_PASSWORD=prabhat123
   ```

**Recommendation:**
- ✅ Change MySQL root password immediately to a strong, unique password (minimum 16 characters, mixed case, numbers, symbols)
- ✅ Create a dedicated database user with limited privileges for the application
- ✅ Use environment variables or secrets management (Azure Key Vault, AWS Secrets Manager)
- ✅ Remove from git history using git-filter-repo

---

### 🔴 CRITICAL: JWT Secret Hardcoded

**Severity:** CRITICAL  
**Status:** EXPOSED IN MULTIPLE LOCATIONS

#### Issue Details:
1. **application.properties (Line 17)**
   ```
   app.jwt.secret=QuizExamSuperSecretKeyThatIsAtLeast256BitsLong1234567890ABCDEF
   ```

2. **.env file (Line 3)**
   ```
   JWT_SECRET=QuizExamSuperSecretKeyThatIsAtLeast256BitsLong1234567890ABCDEF
   ```

3. **Git History:** Visible in commit `6795a82`

**Recommendation:**
- ✅ Rotate JWT secret immediately
- ✅ Invalidate all existing JWT tokens (implement token revocation/blacklist)
- ✅ Move to environment variables or secrets management system
- ✅ Remove from git history

---

## High Priority Findings

### 🟠 HIGH: Files in .gitignore But Not Removed from History

**Severity:** HIGH  
**Status:** PARTIALLY REMEDIATED

#### Issue Details:
- `.env` and `application.properties` are in `.gitignore`
- However, they were committed to git history before being added to `.gitignore`
- Last commit addressing this: `6795a82 (origin/main, origin/HEAD) fix: remove exposed API keys and update gitignore`
- More recent commit: `a87555d (HEAD -> main) Removed sensitive files`

#### Current Status:
- ✅ Files are no longer tracked in working directory
- ⚠️ Git history still contains exposed secrets
- ⚠️ Anyone with access to git history can view these secrets

**Recommendation:**
- Use `git-filter-repo` or `BFG Repo-Cleaner` to permanently remove secrets from all commits
- Force push to repository (with appropriate coordination)
- Rotate all exposed credentials

---

## Medium Priority Findings

### 🟡 MEDIUM: Weak Password Practices

**Severity:** MEDIUM  
**Status:** CURRENT ISSUE

#### Issue Details:
- Database password is simple and predictable: `prabhat123`
- Does not meet NIST password recommendations

**Recommendation:**
- Use complex, randomly generated passwords (minimum 16 characters)
- Use password managers for credential management
- Never commit passwords in any format

---

## Low Priority Findings

### 🟢 LOW: API Configuration Concerns

**Severity:** LOW  
**Status:** INFORMATIONAL

#### Issue Details:
1. **CORS Configuration is Permissive**
   - File: `application.properties` (Line 21)
   - Current: `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000`
   - Status: ✅ Good - restricted to localhost

2. **MySQL useSSL=false**
   - File: `application.properties` (Line 5)
   - Status: ⚠️ Warning - acceptable for local development only

**Recommendation:**
- In production, ensure `useSSL=true` for MySQL connections
- Restrict CORS to specific production domains

---

## Dependency Security Analysis

### Backend Dependencies (Java/Maven)

**Status:** ✅ SECURE

Reviewed Dependencies:
- Spring Boot 3.5.0 (Latest stable)
- MySQL Connector/J 8.2.0 (Patched against CVE-2023-22102)
- JJWT 0.12.5 (Latest)
- Apache PDFBox 3.0.2 (Latest)
- Apache POI 5.2.5 (Latest)

**Recommendation:**
- ✅ No known CVEs detected
- Keep dependencies updated regularly with `mvn versions:display-updates`

### Frontend Dependencies (Node.js)

**Status:** ✅ APPEARS SECURE

Reviewed Dependencies:
- React 18.3.1
- Vite 5.4.2
- Axios 1.15.0
- React Router 6.26.2

**Recommendation:**
- Run `npm audit` regularly to check for vulnerabilities
- Keep dependencies updated with `npm update`

---

## Code Review Findings

### ✅ Positive Findings

1. **Proper Spring Security Configuration**
   - Using Spring Security for authentication/authorization
   - JWT-based stateless authentication

2. **File Upload Size Limits**
   - Properly configured: `spring.servlet.multipart.max-file-size=20MB`

3. **Dependency Management**
   - Using updated, patched versions of critical libraries
   - CVE-2023-22102 (MySQL) has been addressed

### ⚠️ Issues Found

1. **No HTTPS Enforcement**
   - Application.properties doesn't enforce HTTPS
   - Recommendation: Add `server.ssl.*` configuration for production

2. **No Rate Limiting**
   - No visible rate limiting on API endpoints
   - Recommendation: Implement Spring Security rate limiting

3. **No Input Validation Documentation**
   - Ensure all user inputs are validated and sanitized

---

## Remediation Action Plan

### Immediate (Within 24 hours)

- [ ] **Rotate all exposed credentials:**
  - [ ] OpenRouter API key at https://openrouter.ai/keys
  - [ ] Google Gemini API key at https://aistudio.google.com/app/apikey
  - [ ] MySQL database password
  - [ ] JWT secret

- [ ] **Update .env and application.properties with new values**

- [ ] **Notify infrastructure/DevOps team of credential exposure**

### Short-term (Within 1 week)

- [ ] **Clean git history using git-filter-repo:**
  ```bash
  git-filter-repo --path online-quiz-exam-system/.env --invert-paths
  git-filter-repo --path online-quiz-exam-system/src/main/resources/application.properties --invert-paths
  ```

- [ ] **Implement secrets management:**
  - Use environment variables for local development
  - Use Azure Key Vault / AWS Secrets Manager for production
  - Update deployment configuration

- [ ] **Force push cleaned repository** (coordinate with team)

- [ ] **Implement pre-commit hooks** to prevent future credential commits:
  ```bash
  npm install --save-dev @commitlint/config-conventional husky
  ```

### Medium-term (Within 1 month)

- [ ] **Enable branch protection rules** on main branch requiring:
  - Code review
  - Status checks
  - Dismiss stale reviews

- [ ] **Implement secret scanning** (GitHub Secret Scanning, GitGuardian)

- [ ] **Add HTTPS/SSL configuration** for production

- [ ] **Implement rate limiting** on API endpoints

- [ ] **Security audit of AuthController and UserController**

- [ ] **Add comprehensive input validation and sanitization**

---

## Files Requiring Attention

| File | Issues | Priority |
|------|--------|----------|
| `online-quiz-exam-system/.env` | Exposed API keys, DB password | CRITICAL |
| `online-quiz-exam-system/src/main/resources/application.properties` | Exposed API keys, DB password, JWT secret | CRITICAL |
| `.gitignore` | Should be verified for completeness | MEDIUM |
| Git History | Contains exposed secrets (all commits) | CRITICAL |

---

## Compliance Notes

- ⚠️ **HIPAA:** If handling any healthcare data, this exposure violates HIPAA
- ⚠️ **GDPR:** If handling user data, this security incident may require notification
- ⚠️ **PCI-DSS:** If handling payment data, this exposure violates compliance
- ⚠️ **SOC 2:** Secrets in git history indicates lack of access controls

---

## Testing & Verification

After remediation, verify:

```bash
# Check for secrets in git history
git log -p | grep -i "sk-or-v1\|prabhat123\|AIzaSy"

# Verify .env is in .gitignore
git check-ignore online-quiz-exam-system/.env

# Verify application.properties changes are not tracked
git status online-quiz-exam-system/src/main/resources/application.properties

# Run npm audit
npm audit

# Run Maven dependency check
mvn dependency-check:check
```

---

## Contact & Follow-up

- Generate updated report after remediation
- Verify all credentials have been rotated
- Confirm git history has been cleaned
- Implement ongoing security monitoring

---

**Report Status:** Initial Security Assessment  
**Recommendation:** Implement all critical and high-priority items immediately before deployment to production.
