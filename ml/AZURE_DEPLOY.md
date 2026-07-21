# Deploying the TrainWise ML service to Azure

The code is **already prepared** for Azure (see `db.py` dual-mode + the Linux
markers in `requirements.txt`). Running locally is unaffected — this file is the
checklist for when you actually want the coach analytics / trainee "My analytics"
screens to work from anywhere instead of only on the home WiFi.

Nothing here is installed on your Windows PC: `gunicorn` and `pymssql` are marked
`sys_platform == "linux"` in `requirements.txt`, so **Azure installs them itself**
at deploy time, and your local `pip install -r requirements.txt` skips them.

---

## What the code does

`db.py` picks the driver at import time:

| Condition | Driver | Auth | Used where |
|---|---|---|---|
| `AZURE_SQL_USER` **and** `AZURE_SQL_PASSWORD` set | `pymssql` | SQL login | Azure |
| otherwise (default) | `pyodbc` | Windows Integrated Security | your PC (local) |

So the local behaviour is byte-for-byte what it was; the Azure path only turns on
when those two env vars exist (i.e. only on the Azure Web App).

---

## Step-by-step

### 1. Create the Web App (Azure Portal)
Create a resource → **Web App**:
- **Publish**: Code
- **Runtime**: **Python 3.12** (or 3.11 — NOT 3.13; pymssql wheels lag the newest)
- **OS**: **Linux**
- **Plan**: F1 (Free), same region + resource group as the C# API
- **Name**: e.g. `trainwise-ml` → URL becomes `https://trainwise-ml.azurewebsites.net`

### 2. Application settings (env vars)
Web App → **Configuration → Application settings → + New** for each:

| Name | Value |
|---|---|
| `AZURE_SQL_USER` | `TrainWiseAdmin` |
| `AZURE_SQL_PASSWORD` | *(your Azure SQL password — never commit it)* |
| `TRAINWISE_SQL_SERVER` | `trainwiseadmin.database.windows.net` |
| `TRAINWISE_SQL_DATABASE` | `TrainWiseDB` |

(Optionally `ML_AUTH_ENFORCE=true` + `JWT_KEY=<same as C# API>` to require the
signed token — leave off for the first deploy.)

**Save** (this restarts the app).

### 3. Startup command
Web App → **Configuration → General settings → Startup Command**:
```
gunicorn --bind=0.0.0.0:8000 app:app
```

### 4. Let Azure reach the database
Azure SQL **server** (`trainwiseadmin`) → **Networking** →
**"Allow Azure services and resources to access this server" = ON** → Save.
(Without this every DB call from the Web App is refused.)

### 5. Deploy the `ml/` folder (pick one)
- **VS Code**: Azure App Service extension → right-click `ml/` → *Deploy to Web App* → pick `trainwise-ml`.
- **CLI**: `cd ml && az login && az webapp up --name trainwise-ml --resource-group <rg> --runtime "PYTHON:3.12"`
- **GitHub**: Web App → Deployment Center → connect the repo (point at `ml/`).

Deploy **only the `ml/` folder contents** — `app.py` must be at the app root.

### 6. Verify
```
curl https://trainwise-ml.azurewebsites.net/health
```
First hit after ~20 min idle takes 10-30 s (F1 cold start + serverless DB wake) —
that is normal, not a failure.

### 7. Point the app at Azure
`TrainWiseExpo/src/services/mlApi.js`:
```js
const ML_BASE_URL = 'https://trainwise-ml.azurewebsites.net';
```
Then rebuild the APK (the URL is baked into the JS bundle at build time).

---

## Gotchas
- **pymssql login format**: if login fails with "Login failed", set
  `AZURE_SQL_USER` to the `user@servershortname` form: `TrainWiseAdmin@trainwiseadmin`.
  `db.py` passes whatever you give it verbatim.
- **Serverless auto-pause**: an auto-paused Azure SQL DB takes ~30 s to resume;
  the first request may time out then succeed on retry (`login_timeout=30` in db.py).
- **Python version**: keep the Web App on 3.11/3.12 so `pymssql` has prebuilt
  wheels. 3.13 wheels can lag and force a source build that fails on the container.
- **Cost**: this keeps everything on free tiers, but a running Web App + a
  non-paused serverless DB will nudge Azure spend. Scale the DB to serverless with
  a short auto-pause (see CLAUDE.md "Mode A") if you leave it on.
