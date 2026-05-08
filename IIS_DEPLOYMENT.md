# Checklist App IIS Deployment

This project is deployed on IIS as:

- React/Vite frontend served from `frontend/dist`
- Node/Express backend running separately on `127.0.0.1:5000`
- IIS reverse proxy for `/api/*` and `/uploads/*`
- React Router fallback to `/index.html`

The IIS rewrite file is kept at `frontend/public/web.config`. Vite copies it to `frontend/dist/web.config` when you run the production build.

## Project Path

Current local project root:

```powershell
C:\Users\REPPLEN\Desktop\Checklist test file\Employee_app_copy
```

## Prerequisites

Install these on the Windows/IIS machine:

- IIS with Static Content
- IIS URL Rewrite module
- IIS Application Request Routing (ARR)
- Node.js LTS
- MongoDB local service or MongoDB Atlas
- NSSM, if you want the backend to run as a Windows service

ARR must have proxy enabled. The included `scripts/setup-iis.ps1` tries to enable it automatically when ARR is installed.

## Quick Setup

Run PowerShell as Administrator:

```powershell
cd "C:\Users\REPPLEN\Desktop\Checklist test file\Employee_app_copy"
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm run build
```

Create or update the IIS site:

```powershell
npm run iis:setup -- -SiteName ChecklistApp -Port 812 -EnableWindowsFeatures -OpenFirewall
```

Install or update the backend Windows service:

```powershell
npm run service:install -- -ServiceName ChecklistBackend -Port 5000
```

If `nssm.exe` is not on PATH, pass it directly:

```powershell
npm run service:install -- -NssmPath "C:\tools\nssm\nssm.exe"
```

## Backend Environment

Update `backend\.env` before production use:

```dotenv
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/employeeapp
JWT_SECRET=replace-with-a-long-random-production-secret
JWT_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:812,http://your-domain.com
REQUEST_LOG_ENABLED=true
```

Use your real IIS URL in `CORS_ORIGIN`. If you bind HTTPS, include the `https://...` origin.

For IIS hosting, do not set `VITE_API_BASE_URL` unless the API is hosted on a different domain. The frontend defaults to same-origin `/api`, and IIS proxies that to the backend.

## Manual IIS Setup

If you prefer IIS Manager instead of the script:

1. Build the frontend with `npm run build`.
2. Create an IIS app pool named `ChecklistApp-AppPool`.
3. Set `.NET CLR Version` to `No Managed Code`.
4. Create an IIS site named `ChecklistApp`.
5. Set physical path to `C:\Users\REPPLEN\Desktop\Checklist test file\Employee_app_copy\frontend\dist`.
6. Bind HTTP to port `812`, or use your real hostname/SSL binding.
7. Open IIS server node, then `Application Request Routing Cache`, then `Server Proxy Settings`.
8. Enable `Proxy`.
9. Run the backend on port `5000`, preferably with NSSM.

## Verify

After IIS and the backend service are running:

```powershell
Invoke-WebRequest http://localhost:812/
Invoke-WebRequest http://localhost:812/api/health
Invoke-WebRequest http://127.0.0.1:5000/api/health
```

Expected API health response:

```json
{"ok":true}
```

## Deploy Updates

Frontend update:

```powershell
cd "C:\Users\REPPLEN\Desktop\Checklist test file\Employee_app_copy"
npm run build
iisreset
```

Backend update:

```powershell
cd "C:\Users\REPPLEN\Desktop\Checklist test file\Employee_app_copy"
npm --prefix backend ci
nssm restart ChecklistBackend
```

## Troubleshooting

`HTTP Error 403.14 - Forbidden`

IIS is pointing to the wrong folder. Set the site physical path to:

```powershell
C:\Users\REPPLEN\Desktop\Checklist test file\Employee_app_copy\frontend\dist
```

`HTTP Error 500.19`

IIS cannot read the rewrite rules. Install IIS URL Rewrite and confirm `frontend\dist\web.config` exists.

`502` or `/api/health` fails through IIS

Check that ARR is installed, ARR proxy is enabled, and the backend service is running on `127.0.0.1:5000`.

```powershell
Get-Service ChecklistBackend
Invoke-WebRequest http://127.0.0.1:5000/api/health
```

`Origin not allowed by CORS`

Add the exact browser origin to `backend\.env`:

```dotenv
CORS_ORIGIN=http://localhost:812,http://your-domain.com
```

Then restart the backend service:

```powershell
nssm restart ChecklistBackend
```
