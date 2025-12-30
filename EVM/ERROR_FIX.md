# 🔧 Common Errors & Fixes

## Git Push Errors

### Error: "Author identity unknown"
**Fix:**
```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
git commit --amend --reset-author
git push
```

### Error: "Permission denied" or "Authentication failed"
**Fix:**
- Use GitHub Personal Access Token instead of password
- Or use SSH keys: `git remote set-url origin git@github.com:username/repo.git`

### Error: "Everything up-to-date" but changes exist
**Fix:**
```bash
git add .
git commit -m "Your commit message"
git push
```

## Netlify Deployment Errors

### Error: "Functions not found"
**Fix:**
- Verify `netlify/functions/server.ts` exists
- Check `netlify.toml` has `functions = "netlify/functions"`
- Redeploy: `netlify deploy --prod --build`

### Error: "Module not found" in functions
**Fix:**
- Ensure `package.json` has `@netlify/functions` dependency
- Check imports in `server.ts` use correct paths

### Error: "API endpoints return 404"
**Fix:**
- Check `netlify.toml` redirects are correct
- Verify function is deployed (check Functions tab)
- Test: `https://your-site.netlify.app/.netlify/functions/server?path=/api/test`

## Browser Console Errors

### Error: "Failed to fetch" or CORS errors
**Fix:**
- Check serverless function includes CORS headers
- Verify API endpoint URLs are correct (relative paths `/api/...`)

### Error: "404 Not Found" for API calls
**Fix:**
- Functions may not be deployed
- Check Netlify Functions tab
- Verify redirects in `netlify.toml`

## Current Status

✅ **1 commit ready to push** - Run `git push`  
✅ **No linter errors**  
✅ **All files staged correctly**

If you see a specific error, share it and I'll help fix it!



