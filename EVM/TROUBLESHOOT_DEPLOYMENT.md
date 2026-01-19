# 🔧 Troubleshooting Deployment Issues

## If Data Isn't Loading After Deployment

### 1. Check if Functions Are Deployed

In Netlify Dashboard:
- Go to your site → Functions tab
- Check if `server` function is listed
- Check function logs for errors

### 2. Verify API Endpoints

Test your API endpoints:
```bash
# Replace YOUR_SITE_URL with your actual Netlify URL
curl https://YOUR_SITE_URL.netlify.app/api/test
curl https://YOUR_SITE_URL.netlify.app/api/defi/trends
```

### 3. Check Browser Console

Open your deployed site and check browser console (F12):
- Look for failed API calls (404, 500 errors)
- Check Network tab to see which endpoints are failing

### 4. Common Issues & Fixes

#### Issue: Functions Not Deploying
**Fix:**
- Ensure `netlify/functions/server.ts` exists
- Check `netlify.toml` has `functions = "netlify/functions"`
- Redeploy: `netlify deploy --prod`

#### Issue: API Calls Returning 404
**Fix:**
- Check `netlify.toml` redirects are correct:
  ```toml
  [[redirects]]
    from = "/api/*"
    to = "/.netlify/functions/server"
    status = 200
    force = true
  ```
- Verify function is deployed in Netlify dashboard

#### Issue: CORS Errors
**Fix:**
- Check serverless function includes CORS headers
- Verify `Access-Control-Allow-Origin: *` in function response

#### Issue: Old Content Showing
**Fix:**
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Check Netlify deploy logs to confirm latest deployment succeeded

### 5. Force Redeploy

```powershell
cd "C:\Users\takun\OneDrive\Documents\Blockchain AI Agent\Blockchain-AI-Agent\EVM"
netlify deploy --prod --build
```

### 6. Check Deployment Logs

In Netlify Dashboard:
- Go to Deploys tab
- Click on latest deployment
- Check build logs for errors
- Check function logs

### 7. Verify File Structure

Ensure these files exist:
```
EVM/
├── netlify.toml ✅
├── dashboard/
│   ├── regulator.html ✅
│   └── index.html ✅
└── netlify/
    └── functions/
        └── server.ts ✅
```

### 8. Test Locally First

Before deploying, test locally:
```powershell
bun run start:dashboard
# Visit http://localhost:3001/regulator
# Check if APIs work locally
```

### 9. Check Function Runtime

Ensure `package.json` has:
```json
{
  "dependencies": {
    "@netlify/functions": "^2.4.0"
  }
}
```

### 10. Verify Environment

Check Netlify build settings match:
- Node version: 18
- Build command: (blank or `npm install`)
- Publish directory: `dashboard`
- Functions directory: `netlify/functions`

## Quick Debug Checklist

- [ ] Functions deployed? (Check Functions tab)
- [ ] API endpoints accessible? (Test `/api/test`)
- [ ] No errors in browser console?
- [ ] No errors in Netlify function logs?
- [ ] `netlify.toml` redirects correct?
- [ ] Latest deployment successful?
- [ ] Browser cache cleared?

## Still Not Working?

1. **Check Netlify Function Logs:**
   - Dashboard → Functions → server → Logs
   - Look for runtime errors

2. **Test Function Directly:**
   ```
   https://your-site.netlify.app/.netlify/functions/server?path=/api/test
   ```

3. **Redeploy from scratch:**
   ```powershell
   netlify deploy --prod --build
   ```




