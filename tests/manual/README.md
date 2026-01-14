# Manual Testing for Discord Integration

This directory contains manual test scripts to help debug Discord authentication and reactions.

## Prerequisites

1. Development server running: `npm run dev`
2. You are logged in to the application via Discord OAuth

## Tests Available

### 1. Check Discord Authentication

**File:** `check-discord-auth.ts`

**Purpose:** Verifies that your session contains a valid Discord access token

**Usage:**
```bash
npx tsx tests/manual/check-discord-auth.ts
```

**What it checks:**
- ✅ Session exists
- ✅ Access token is present in session
- ✅ Access token is valid (tests against Discord API)
- ✅ Token expiration info

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "Access token is MISSING from session" | Log out and log back in to get a fresh session |
| "Access token is invalid or expired" | Log out and log back in |
| "No user in session" | Make sure you're logged in to the app |

### 2. Test Discord Reactions

**File:** `test-reaction.ts`

**Purpose:** Tests adding and removing reactions via the API

**Usage:**
1. Edit the file and update `TEST_CHANNEL_ID` and `TEST_MESSAGE_ID` with real values
2. Run:
   ```bash
   npx tsx tests/manual/test-reaction.ts
   ```

**What it tests:**
- ✅ Adding a ⭐ reaction
- ✅ Removing a ⭐ reaction
- ✅ API authentication
- ✅ Error handling

**Common Errors:**

| Status Code | Meaning | Solution |
|-------------|---------|----------|
| 401 | Unauthorized | Session missing or expired - re-login |
| 500 | Server Error | Check `[Discord Reactions]` logs in dev server |
| 403 | Forbidden | User doesn't have permission in that channel |
| 404 | Not Found | Invalid channel or message ID |

## Debugging Workflow

When the favorite button returns a 401 error:

1. **Check if access token is in session:**
   ```bash
   npx tsx tests/manual/check-discord-auth.ts
   ```

2. **If token is missing:**
   - Log out of the application
   - Log back in via Discord OAuth
   - Run the check script again

3. **If token is present but API still fails:**
   - Check the browser console for errors
   - Check the dev server logs for `[Discord Reactions]` messages
   - Try the manual test script

4. **Check the dev server logs:**
   Look for these log messages:
   - `[Auth] New token stored:` - Shows token was stored on login
   - `[Discord Reactions] Session:` - Shows session state in API
   - `[Discord Reactions] Access token found` - Confirms token is available

## Understanding the Flow

```
User Login (Discord OAuth)
    ↓
NextAuth stores access_token in JWT
    ↓
JWT is passed to session
    ↓
session.user.accessToken is available
    ↓
API routes use session.user.accessToken
    ↓
Discord API receives Bearer token
    ↓
Reaction added as the user
```

## Token Refresh

Discord tokens expire after ~7 days. The auth system now includes automatic token refresh:

- Tokens are refreshed automatically when they have <5 minutes remaining
- If refresh fails, user will need to re-login
- Watch for `[Auth] Token refreshed successfully` in logs

## Need More Help?

If you're still having issues:

1. Check all `[Auth]` and `[Discord Reactions]` logs in your dev server
2. Verify your Discord application has the correct OAuth2 redirect URIs
3. Make sure `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` are set in `.env`
4. Check that you have permission to react in the target channel
