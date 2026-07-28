"""
Generate the comprehensive TrainWise project documentation PDF using PyMuPDF.

This file is the canonical reference for TrainWise. It documents every screen,
every API call, every controller/BL/DAL class, the SQL schema, the AC-Ratio
training-load algorithm, the frontend navigation tree, and known architectural
gaps. Future Claude / Claude Code conversations should use this PDF (or this
script) as the single source of truth.

Output: TrainWise_Project_Documentation.pdf
"""
import fitz  # PyMuPDF
import os

OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "TrainWise_Project_Documentation.pdf")

# ----- Page layout -----
PAGE_W, PAGE_H = 595, 842  # A4
MARGIN_L = 50
MARGIN_R = 50
MARGIN_T = 60
MARGIN_B = 60
LINE_H = 14
TEXT_W = PAGE_W - MARGIN_L - MARGIN_R

# Colors (RGB 0-1) -- TrainWise palette
NAVY        = (0.04, 0.09, 0.16)
PINK        = (0.91, 0.12, 0.39)
DARK_GRAY   = (0.20, 0.20, 0.20)
LIGHT_GRAY  = (0.55, 0.55, 0.55)
CARD_BG     = (0.96, 0.96, 0.98)
CODE_BG     = (0.93, 0.93, 0.95)
WARN_BG     = (1.00, 0.96, 0.90)
WARN_BAR    = (0.95, 0.55, 0.10)
WHITE       = (1, 1, 1)


class PDFBuilder:
    def __init__(self):
        self.doc = fitz.open()
        self.page = None
        self.y = MARGIN_T
        self.new_page()

    # ---------------- page chrome ----------------
    def new_page(self):
        self.page = self.doc.new_page(width=PAGE_W, height=PAGE_H)
        self.page.draw_rect(fitz.Rect(0, 0, PAGE_W, 30), color=NAVY, fill=NAVY)
        self.page.insert_text(
            (MARGIN_L, 20),
            "TrainWise  |  Project Documentation",
            fontsize=10, color=WHITE, fontname="helv"
        )
        self.page.draw_line(
            fitz.Point(MARGIN_L, PAGE_H - 30),
            fitz.Point(PAGE_W - MARGIN_R, PAGE_H - 30),
            color=PINK, width=1.5
        )
        page_num = len(self.doc)
        self.page.insert_text(
            (PAGE_W - MARGIN_R - 30, PAGE_H - 18),
            f"Page {page_num}",
            fontsize=8, color=LIGHT_GRAY
        )
        self.y = MARGIN_T

    def ensure_space(self, needed):
        if self.y + needed > PAGE_H - MARGIN_B:
            self.new_page()

    # ---------------- typography ----------------
    def h1(self, text):
        self.ensure_space(50)
        self.y += 8
        self.page.insert_text(
            (MARGIN_L, self.y + 16),
            text, fontsize=20, color=PINK, fontname="hebo"
        )
        self.y += 24
        self.page.draw_line(
            fitz.Point(MARGIN_L, self.y),
            fitz.Point(PAGE_W - MARGIN_R, self.y),
            color=PINK, width=1.2
        )
        self.y += 12

    def h2(self, text):
        self.ensure_space(28)
        self.y += 6
        self.page.insert_text(
            (MARGIN_L, self.y + 12),
            text, fontsize=14, color=NAVY, fontname="hebo"
        )
        self.y += 18

    def h3(self, text):
        self.ensure_space(20)
        self.page.insert_text(
            (MARGIN_L, self.y + 11),
            text, fontsize=11, color=PINK, fontname="hebo"
        )
        self.y += 16

    def wrap_text(self, text, font_size=10, max_width=None):
        if max_width is None:
            max_width = TEXT_W
        char_w = font_size * 0.5
        max_chars = max(20, int(max_width / char_w))
        lines = []
        for paragraph in text.split("\n"):
            if not paragraph:
                lines.append("")
                continue
            words = paragraph.split(" ")
            current = ""
            for w in words:
                if len(current) + len(w) + 1 <= max_chars:
                    current = (current + " " + w).strip()
                else:
                    if current:
                        lines.append(current)
                    # word longer than line: hard wrap
                    while len(w) > max_chars:
                        lines.append(w[:max_chars])
                        w = w[max_chars:]
                    current = w
            if current:
                lines.append(current)
        return lines

    def body(self, text):
        lines = self.wrap_text(text, 10)
        for line in lines:
            self.ensure_space(LINE_H)
            self.page.insert_text(
                (MARGIN_L, self.y + 10),
                line, fontsize=10, color=DARK_GRAY
            )
            self.y += LINE_H

    def small(self, text):
        lines = self.wrap_text(text, 9)
        for line in lines:
            self.ensure_space(12)
            self.page.insert_text(
                (MARGIN_L, self.y + 9),
                line, fontsize=9, color=LIGHT_GRAY
            )
            self.y += 12

    def bullet(self, text):
        lines = self.wrap_text(text, 10, TEXT_W - 14)
        first = True
        for line in lines:
            self.ensure_space(LINE_H)
            if first:
                self.page.draw_circle(
                    fitz.Point(MARGIN_L + 4, self.y + 5),
                    2, color=PINK, fill=PINK
                )
                first = False
            self.page.insert_text(
                (MARGIN_L + 14, self.y + 10),
                line, fontsize=10, color=DARK_GRAY
            )
            self.y += LINE_H

    def kv(self, key, value):
        """Render a key:value row (key in pink, value in dark)."""
        self.ensure_space(LINE_H)
        self.page.insert_text(
            (MARGIN_L, self.y + 10),
            key, fontsize=10, color=PINK, fontname="hebo"
        )
        # measure key width approximation
        key_w = len(key) * 5.5 + 6
        value_lines = self.wrap_text(value, 10, TEXT_W - key_w)
        for i, line in enumerate(value_lines):
            if i > 0:
                self.ensure_space(LINE_H)
            self.page.insert_text(
                (MARGIN_L + key_w, self.y + 10),
                line, fontsize=10, color=DARK_GRAY
            )
            self.y += LINE_H

    def code_block(self, text):
        lines = []
        for raw in text.split("\n"):
            # hard wrap at 88 chars
            while len(raw) > 88:
                lines.append(raw[:88])
                raw = raw[88:]
            lines.append(raw)
        block_h = len(lines) * 11 + 10
        self.ensure_space(block_h + 4)
        self.page.draw_rect(
            fitz.Rect(MARGIN_L, self.y, PAGE_W - MARGIN_R, self.y + block_h),
            color=CODE_BG, fill=CODE_BG
        )
        self.page.draw_line(
            fitz.Point(MARGIN_L, self.y),
            fitz.Point(MARGIN_L, self.y + block_h),
            color=PINK, width=2
        )
        cy = self.y + 12
        for line in lines:
            self.page.insert_text(
                (MARGIN_L + 8, cy),
                line, fontsize=8, color=NAVY, fontname="cour"
            )
            cy += 11
        self.y += block_h + 6

    def card(self, title, body_text):
        body_lines = self.wrap_text(body_text, 10, TEXT_W - 20)
        block_h = 24 + len(body_lines) * LINE_H + 10
        self.ensure_space(block_h + 4)
        self.page.draw_rect(
            fitz.Rect(MARGIN_L, self.y, PAGE_W - MARGIN_R, self.y + block_h),
            color=CARD_BG, fill=CARD_BG
        )
        self.page.draw_rect(
            fitz.Rect(MARGIN_L, self.y, MARGIN_L + 4, self.y + block_h),
            color=PINK, fill=PINK
        )
        self.page.insert_text(
            (MARGIN_L + 14, self.y + 16),
            title, fontsize=11, color=PINK, fontname="hebo"
        )
        cy = self.y + 30
        for line in body_lines:
            self.page.insert_text(
                (MARGIN_L + 14, cy + 8),
                line, fontsize=9.5, color=DARK_GRAY
            )
            cy += LINE_H
        self.y += block_h + 6

    def warning(self, title, body_text):
        body_lines = self.wrap_text(body_text, 10, TEXT_W - 20)
        block_h = 24 + len(body_lines) * LINE_H + 10
        self.ensure_space(block_h + 4)
        self.page.draw_rect(
            fitz.Rect(MARGIN_L, self.y, PAGE_W - MARGIN_R, self.y + block_h),
            color=WARN_BG, fill=WARN_BG
        )
        self.page.draw_rect(
            fitz.Rect(MARGIN_L, self.y, MARGIN_L + 4, self.y + block_h),
            color=WARN_BAR, fill=WARN_BAR
        )
        self.page.insert_text(
            (MARGIN_L + 14, self.y + 16),
            "WARNING:  " + title, fontsize=11, color=WARN_BAR, fontname="hebo"
        )
        cy = self.y + 30
        for line in body_lines:
            self.page.insert_text(
                (MARGIN_L + 14, cy + 8),
                line, fontsize=9.5, color=DARK_GRAY
            )
            cy += LINE_H
        self.y += block_h + 6

    def spacer(self, h=8):
        self.y += h

    # ---------------- cover ----------------
    def cover_page(self):
        self.doc.delete_page(0)
        self.page = self.doc.new_page(width=PAGE_W, height=PAGE_H)
        self.page.draw_rect(fitz.Rect(0, 0, PAGE_W, PAGE_H), color=NAVY, fill=NAVY)
        self.page.draw_rect(fitz.Rect(0, 200, PAGE_W, 206), color=PINK, fill=PINK)
        self.page.draw_rect(fitz.Rect(0, 420, PAGE_W, 426), color=PINK, fill=PINK)
        self.page.insert_text((MARGIN_L, 280), "TrainWise",
                              fontsize=48, color=PINK, fontname="hebo")
        self.page.insert_text((MARGIN_L, 320),
                              "Full-Stack Fitness + Injury-Prevention Platform",
                              fontsize=16, color=WHITE, fontname="helv")
        self.page.insert_text((MARGIN_L, 360),
                              "React Native + Expo  /  ASP.NET Core 8  /  Python ML  /  SQL Server",
                              fontsize=12, color=(0.7, 0.75, 0.85))
        self.page.insert_text((MARGIN_L, 460),
                              "Architecture, ML, security and deployment, current.",
                              fontsize=13, color=WHITE, fontname="hebo")
        self.page.insert_text((MARGIN_L, 480),
                              "Use this document as the canonical reference for any",
                              fontsize=10, color=(0.85, 0.85, 0.9))
        self.page.insert_text((MARGIN_L, 494),
                              "future Claude / Claude Code conversation on this project.",
                              fontsize=10, color=(0.85, 0.85, 0.9))
        self.page.insert_text((MARGIN_L, PAGE_H - 100),
                              "Author: Liron Vaknin",
                              fontsize=11, color=WHITE)
        self.page.insert_text((MARGIN_L, PAGE_H - 80),
                              "Generated: 2026-07-26",
                              fontsize=11, color=WHITE)
        self.page.insert_text((MARGIN_L, PAGE_H - 60),
                              "Document built by Claude Code (claude-opus-4-8)",
                              fontsize=9, color=(0.6, 0.65, 0.75))
        self.new_page()

    def save(self):
        self.doc.save(OUTPUT)
        self.doc.close()
        print(f"PDF saved -> {OUTPUT}")
        print(f"Size: {os.path.getsize(OUTPUT) / 1024:.1f} KB")


# ============================================================================
#                              CONTENT
# ============================================================================

def build():
    p = PDFBuilder()
    p.cover_page()

    # ===== TABLE OF CONTENTS =====
    p.h1("Table of Contents")
    toc = [
        "1.  Project Overview",
        "2.  Technology Stack",
        "3.  Repository Layout",
        "4.  Architecture (4 tiers: App / API / ML / DB)",
        "5.  Backend Deployment Modes (Azure / Local LAN)",
        "6.  Authentication & Security",
        "7.  SQL Server Database (schema, migrations, seed)",
        "8.  AC-Ratio Training-Load Algorithm",
        "9.  Backend - C# ASP.NET Core 8",
        "       9.1  Controllers (29)",
        "       9.2  Business Logic (39) & Data Access (29)",
        "       9.3  Models (47)",
        "10. Frontend - React Native Expo",
        "       10.1  Navigation tree (4 tabs)",
        "       10.2  Module layout & theme system",
        "       10.3  Screens (by group)",
        "       10.4  Health Connect integration",
        "11. ML Service - Python / Flask (the smart element)",
        "12. Feature Inventory (grouped)",
        "13. End-to-End Data Flows",
        "14. Build, Run & Deploy",
        "15. Known Issues & Backlog",
        "16. File Index & Change Log",
    ]
    for line in toc:
        p.body(line)
    p.spacer(6)
    p.small("This edition supersedes the 2026-04-16 draft. Major changes since then: "
            "JWT auth + security hardening, the intensityFactor removal, the dynamic "
            "cold-start load math, the Python ML service, and dozens of shipped features.")

    # ========================================================================
    # 1. PROJECT OVERVIEW
    # ========================================================================
    p.h1("1.  Project Overview")
    p.body(
        "TrainWise is a full-stack fitness and injury-prevention platform for "
        "runners, gym-goers and their coaches. Its reason to exist is one "
        "sports-science idea: the Acute:Chronic Workload Ratio (ACWR), the "
        "relationship between the last 7 days of training (acute) and the 28-day "
        "baseline (chronic). Spiking that ratio is one of the best-known "
        "predictors of soft-tissue injury. TrainWise logs every workout (typed "
        "in by hand or synced automatically from Android Health Connect), "
        "computes the ACWR with a colour-coded Green / Yellow / Red warning, and "
        "layers a Python machine-learning service on top that forecasts where a "
        "trainee's load is heading and classifies overload risk."
    )
    p.body(
        "Around that core sits a complete consumer app: coach/trainee linking "
        "and chat, a social layer (friends, gyms, live presence), gamification "
        "(badges, coins, streaks, shop, leaderboards), an AI assistant, "
        "nutrition, GPS run tracking, assigned training programs, a calendar, "
        "and more. It is a real three-tier system deployable fully on Azure or "
        "on a local LAN."
    )
    p.spacer(4)
    p.h2("Primary user stories")
    p.bullet("As an athlete, I log a workout and immediately see whether my "
             "load is in the safe zone or trending to overload (traffic light).")
    p.bullet("As an athlete, my workouts import automatically from Health "
             "Connect so I do not have to enter them by hand.")
    p.bullet("As an athlete, I report an injury and the system tightens my load "
             "thresholds for the recovery window.")
    p.bullet("As a coach, I connect to a trainee (QR / coach-offer) and see "
             "their PMC, ACWR trend, monthly forecast and risk on one screen.")
    p.bullet("As a coach or trainee, I run a 'what-if' simulation to see where "
             "my risk lands before I train the extra sessions.")
    p.spacer(4)
    p.h2("At a glance")
    p.kv("Author:", "Liron Vaknin")
    p.kv("Tiers:", "Mobile app / REST API / ML service / SQL database")
    p.kv("Scale:", "~163 frontend files, ~145 C# files, ~10 ML modules, 32 SQL scripts")
    p.kv("Features:", "~109 shipped (see section 12); backlog in tasks/feature_backlog.md")
    p.kv("Canonical docs:", "CLAUDE.md (engineering), PROJECT_SUMMARY.md (overview), this PDF")

    # ========================================================================
    # 2. TECH STACK
    # ========================================================================
    p.h1("2.  Technology Stack")

    p.h2("Frontend")
    p.bullet("React Native 0.81.5 + React 19.1.0, Expo SDK 54 (New Architecture required)")
    p.bullet("JavaScript only (no TypeScript despite tsconfig.json)")
    p.bullet("React Navigation v7 (native stack + bottom tabs)")
    p.bullet("axios; @react-native-async-storage; react-native-svg (custom charts)")
    p.bullet("react-native-reanimated / worklets; react-native-health-connect")
    p.bullet("expo-maps / location / task-manager (GPS), camera, notifications, "
             "local-authentication, image-picker, audio, video, sharing")
    p.bullet("@react-native-google-signin; react-native-qrcode-svg; webview (reCAPTCHA)")

    p.h2("Backend")
    p.bullet("ASP.NET Core 8.0 Web API, raw ADO.NET (Microsoft.Data.SqlClient)")
    p.bullet("JWT bearer auth (Microsoft.AspNetCore.Authentication.JwtBearer)")
    p.bullet("Built-in rate limiting; Swagger (Development only)")
    p.bullet("FirebaseAdmin (FCM push); Google token + reCAPTCHA server verification")

    p.h2("ML / Data Science")
    p.bullet("Python 3.10+, Flask (port 8000), pandas, numpy")
    p.bullet("scikit-learn: LinearRegression, PolynomialFeatures, RandomForest, KMeans")
    p.bullet("matplotlib / seaborn (notebooks), joblib (model export)")
    p.bullet("pyodbc (local, Windows auth) / pymssql + gunicorn (Azure)")

    p.h2("Database & Cloud")
    p.bullet("SQL Server: Azure SQL (cloud) or SQL Express Lirone\\SQLEXPRESS (local)")
    p.bullet("Azure App Service (API + ML), Azure SQL Serverless (auto-pause)")
    p.bullet("External: Google Health Connect / Maps / Weather / Air-Quality / "
             "Places, Google Sign-In, OpenAI, Firebase Cloud Messaging, Open Food Facts")

    # ========================================================================
    # 3. REPO LAYOUT
    # ========================================================================
    p.h1("3.  Repository Layout")
    p.body("The real project root is c:\\Dev\\TrainWise. Four cooperating "
           "sub-projects, no shared package manager.")
    p.code_block(
        "TrainWise/                          <-- project root\n"
        "  CLAUDE.md                         master engineering doc (592 lines)\n"
        "  PROJECT_SUMMARY.md                full project overview\n"
        "  generate_docs_pdf.py              THIS script (PyMuPDF)\n"
        "  TrainWise_Project_Documentation.pdf   output of this script\n"
        "\n"
        "  TrainWise/TrainWise/              <-- C# backend (TrainWise.sln)\n"
        "    Controllers/   (29)   BL/  (39)   DAL/  (29)   Models/ (47)\n"
        "    Program.cs   appsettings.json   wwwroot/images/\n"
        "  TrainWise/TrainWise.Tests/        xUnit: pins the load-window math\n"
        "\n"
        "  TrainWiseExpo/                    <-- React Native / Expo app\n"
        "    App.js  index.js  app.json  app.config.js  eas.json  package.json\n"
        "    android/                        native project (manual HC edits)\n"
        "    src/  api/  services/  navigation/  screens/ (~60)\n"
        "          components/ (~55)  utils/ (~55)  theme/  i18n/  config/\n"
        "\n"
        "  ml/                               <-- Python ML microservice\n"
        "    app.py db.py config.py features.py forecast.py risk.py auth.py\n"
        "    models/*.pkl   notebook/*.ipynb (gradeable)\n"
        "  ml_deploy_clean/                  clean copy for the Azure deploy\n"
        "\n"
        "  sql/                              32 schema + migration + seed scripts\n"
        "  tasks/                            session resumes, checklists, lessons.md\n"
        "  Python Course ML/                 the 7-lesson ML course (context)\n"
    )

    # ========================================================================
    # 4. ARCHITECTURE
    # ========================================================================
    p.h1("4.  Architecture - 4 tiers")
    p.body(
        "The mobile app talks to two services: the C# REST API for all app "
        "data, and the Python ML service for analytics/forecast. Both read the "
        "same SQL database. The C# backend keeps a strict three-layer shape."
    )
    p.code_block(
        "  Mobile app (React Native)\n"
        "    |  axios -> services/api.js  (all app data)\n"
        "    |  axios -> services/mlApi.js (analytics / forecast / what-if)\n"
        "    v                          v\n"
        "  C# REST API                Python ML service (Flask :8000)\n"
        "  Controller -> BL -> DAL       features / forecast / risk\n"
        "    |  (ADO.NET)                 |  (pyodbc / pymssql)\n"
        "    v                           v\n"
        "  ===============  SQL Server  ===============\n"
    )
    p.card("One formula, four implementations",
           "The ACWR load math is the single source of truth in C# "
           "LoadCalculationBL (internal static helpers), and is mirrored "
           "byte-for-byte by ml/features.py (Python) and by utils/acwr.js + "
           "utils/loadSeries.js (on-device JS). The C# xUnit test project pins "
           "hand-computed vectors so the four never drift. Keeping them in "
           "lockstep is a defining challenge of the project.")
    p.card("Backend three-layer",
           "Controllers are thin REST surfaces (Route api/[controller], "
           "[FromBody] on POST/PUT). BL holds business logic. DAL is manual "
           "ADO.NET over stored procedures (older features) or inline "
           "parameterised SQL (newer features). No EF Core, no migrations "
           "folder; the schema is managed by the scripts in sql/.")

    # ========================================================================
    # 5. DEPLOYMENT MODES
    # ========================================================================
    p.h1("5.  Backend Deployment Modes")
    p.body(
        "Two interchangeable modes, flipped by a one-line switch plus an APK "
        "rebuild. BACKEND_MODE lives in src/config/backend.js (both axios "
        "clients import API_BASE_URL from it, so they can never drift). ML_MODE "
        "lives in src/services/mlApi.js. As of this writing both are 'local'."
    )
    p.h2("Mode A - Azure (works anywhere)")
    p.bullet("API on Azure App Service; Azure SQL (trainwiseadmin01.database."
             "windows.net / TrainWiseDB).")
    p.bullet("ML service live at trainwise-ml-...azurewebsites.net (/health -> db:true).")
    p.bullet("DB connection injected via the App Service Connection-strings "
             "blade; DBservice.Connect() reads env vars so it wins over appsettings.json.")
    p.bullet("Cost kept low by Azure SQL Serverless (auto-pause; first call after "
             "idle can take ~30s to wake).")
    p.h2("Mode B - Local LAN")
    p.bullet("API in VS 2022 (bind 0.0.0.0:5249), SQL Express, ML service "
             "(python app.py, :8000), phone over the same WiFi (or adb reverse over USB).")
    p.bullet("Requires: firewall rules (TCP 5249 + 8000, Private profile), "
             "usesCleartextTraffic=true in the manifest, and LOCAL_PC_IP current.")
    p.warning("The C# backend code is identical in both modes",
              "Nothing in Controllers/BL/DAL changes when switching. Only client "
              "config (backend.js / mlApi.js) and the DB connection source differ.")

    # ========================================================================
    # 6. AUTH & SECURITY
    # ========================================================================
    p.h1("6.  Authentication & Security")
    p.body(
        "Since the 2026-07-02 security pass the API has a real identity layer "
        "(the old 'no auth, trusts a client-supplied userId' model is gone)."
    )
    p.h2("JWT bearer auth")
    p.bullet("JwtService (HS256) mints a token on login / signup / google-login, "
             "carrying uid, isCoach/isTrainee, and a session id (sid).")
    p.bullet("Program.cs validates a token when present. AUTH_ENFORCE (env flag) "
             "is the stage-2 switch: when true, every endpoint without "
             "[AllowAnonymous] requires a valid token. Off by default so older "
             "tokenless APKs keep working during rollout.")
    p.bullet("BaseApiController exposes ownership gates (CallerMayAct, "
             "CallerOwnsOrCoaches, ...) that DENY a token belonging to a "
             "different user even while enforcement is off - closing IDOR/BOLA.")
    p.bullet("Session revocation: OnTokenValidated checks sid against "
             "SessionBL.IsSessionActive, so 'log out this device' is real.")
    p.h2("Other hardening")
    p.bullet("PBKDF2 password hashing (PasswordHasher: SHA-256 / 100k / salted, "
             "verify-and-upgrade from legacy plaintext).")
    p.bullet("Rate limiting (10/min/IP on auth endpoints, 300/min/IP global).")
    p.bullet("Generic 500 body (never leak ex.Message / SQL / paths); the detail "
             "stays in the server log.")
    p.bullet("Upload validation (UploadValidator: 6 MB cap + magic-byte sniff, "
             "server-derived extension; client filename ignored).")
    p.bullet("Server-side Google ID-token verification (GoogleTokenVerifier) and "
             "signup reCAPTCHA (CaptchaVerifier, fail-open when unset).")
    p.warning("Secrets discipline",
              "After a Google API key leaked via a push (now rotated), the "
              "project enforces a pre-commit secret scan and a safe-push "
              "checklist. Keys live in .env (gitignored) + app.config.js "
              "injection; appsettings.json carries the Azure SQL password "
              "locally but its committed version has only the clean local string "
              "and must never be committed with the password. EXPO_PUBLIC_* vars "
              "(the Maps + OpenAI keys) are baked into the APK in plaintext - do "
              "not distribute the APK publicly.")

    # ========================================================================
    # 7. DATABASE
    # ========================================================================
    p.h1("7.  SQL Server Database")
    p.body(
        "Raw ADO.NET against SQL Server. The base schema + stored procedures "
        "live in sql/TWDB.sql; 30+ dated migration scripts layer on the newer "
        "features. There is no EF migration runner, so every script must be run "
        "on BOTH the local and Azure databases."
    )
    p.h2("7.1  Table families (roughly 40 tables)")
    p.bullet("Core: Users, ActivityTypes, ActivityLogs, DailyLoad, "
             "LoadParameters, Recommendations.")
    p.bullet("Coaching: Coaches, CoachTrainees, CoachRecommendations, "
             "WorkoutComments (coach feedback), MonthlyForecasts (ML snapshots).")
    p.bullet("Injuries: InjuryTypes, InjuryCategories, InjuriesReports, InjuryPainLog.")
    p.bullet("Messaging: Messages, MessageReactions, MessageTyping.")
    p.bullet("Social: Friendships, Gyms, GymCoaches, CoachOffers (+ Users.LastSeen "
             "/ Latitude / Longitude for presence + geo).")
    p.bullet("Community / gamification: WorkoutBoard posts + likes + comments, "
             "WorkoutKudos, Challenges + participants, Events + RSVPs, cosmetics, records.")
    p.bullet("Planning: PlannedWorkouts (calendar), TrainingPrograms / "
             "ProgramWorkouts / ProgramAssignments + program chat tables.")
    p.bullet("Health & sessions: BodyMeasurements, NutritionLog, WorkoutTemplates, "
             "UserSessions, UserDevices (+ push token).")
    p.h2("7.2  Stored procedures & inline SQL")
    p.body(
        "Older features use ~49+ stored procedures (naming sp_VerbNoun); the "
        "newest features (programs, calendar, community, event chat) use inline "
        "parameterised SQL in the DAL. Both are parameterised - the project "
        "never string-concatenates user input into SQL."
    )
    p.h2("7.3  Reference / seed data (required on any fresh DB)")
    p.body(
        "sql/seed_reference_data.sql (idempotent) seeds the lookup tables the "
        "dropdowns and the load algorithm need: 20 ActivityTypes, 20 InjuryTypes "
        "+ categories, 20 TrainingGoals, and the single LoadParameters tuning "
        "row. The social migration additionally seeds fake demo users + 10 real "
        "Netanya gyms (from Google Places). Without the seed, a fresh DB has "
        "empty dropdowns and a broken load calc."
    )

    # ========================================================================
    # 8. AC-RATIO ALGORITHM
    # ========================================================================
    p.h1("8.  AC-Ratio Training-Load Algorithm")
    p.body(
        "Implemented in BL/LoadCalculationBL.cs (CalculateAndSave) and mirrored "
        "in Python + JS. This is the app's reason to exist."
    )
    p.h3("Per-session load")
    p.code_block(
        "sessionLoad = Duration (min)  x  Exertion (RPE 1-10)\n"
        "\n"
        "NOTE: the old IntensityFactor multiplier was REMOVED across DB,\n"
        "backend and frontend. Load is duration x exertion only.\n"
    )
    p.h3("Acute, chronic, ratio (mirrors LoadCalculationBL)")
    p.code_block(
        "sessions bucketed per LOCAL calendar day (tzOffsetMinutes); pending\n"
        "Health-Connect imports (IsConfirmed = 0) are EXCLUDED, NULL = confirmed\n"
        "\n"
        "acute   = sum of session loads in the last 7 days\n"
        "chronic = EffectiveChronic(28-day window)  (see below)\n"
        "ratio   = acute / chronic     (NULL/Green when chronic = 0)\n"
    )
    p.h3("EffectiveChronic - dynamic cold-start floor + covered-days ramp")
    p.code_block(
        "if < 7 active days in the 28-day window (cold start / layoff):\n"
        "    chronic = max(sum28 / 4, experienceBootstrap)\n"
        "    bootstrap weekly = Beginner 150 / Regular 280 / Advance 420\n"
        "else (>= 7 active days):\n"
        "    covered = days from the first loaded day through today (7..28)\n"
        "    chronic = sum28 / min(4, covered / 7)     # ramp\n"
    )
    p.body(
        "The floor is DYNAMIC (based on the trailing window), not the one-shot "
        "IsBaselineEstablished flag - so a returning-from-layoff athlete no "
        "longer stores a false Red. The covered-days ramp stops a steady "
        "2-week-old user reading a false 2.0; a full 28-day history is unchanged (/4)."
    )
    p.h3("Traffic-light classification (DetermineLoadLevel)")
    p.code_block(
        "healthy:   ratio < 0.8 Green | 0.8..1.3 Yellow | > 1.3 Red\n"
        "injured:   ratio < 0.8 Green | 0.8..<1.2 Yellow | >= 1.2 Red\n"
        "\n"
        "Levels are graded from the UNROUNDED ratio (1.3049 is Red, not the\n"
        "displayed 1.30). An active injury tightens the Red line with no gap.\n"
    )

    # ========================================================================
    # 9. BACKEND
    # ========================================================================
    p.h1("9.  Backend - C# ASP.NET Core 8")
    p.h2("9.1  Controllers (29)")
    p.body("All follow the same shape: instantiate the matching BL, gate via "
           "BaseApiController, return Ok / BadRequest / generic 500.")
    p.bullet("Auth & users: Auth, Users, UserDevices, Sessions")
    p.bullet("Load & activity: ActivityLog, ActivityType, DailyLoad, "
             "LoadParameters, Recommendation")
    p.bullet("Injuries: InjuryReport, InjuryTypes")
    p.bullet("Coach: Coach, CoachTrainee, CoachRecommendations, Calendar, Programs")
    p.bullet("Messaging & social: Messages, Social, Gyms, Community")
    p.bullet("Workouts+: Nutrition, Records, WorkoutTemplates, WorkoutBoard, "
             "WorkoutComments")
    p.bullet("Goals & prefs: TrainingGoals, UserGoals, UserActivityPreferences")
    p.h2("9.2  Business Logic (39) & Data Access (29)")
    p.bullet("Core load: LoadCalculationBL (the algorithm), LoadAnalyticsBL "
             "(rolling + EWMA trend), LoadParametersBL")
    p.bullet("Auth/security services: JwtService, PasswordHasher, "
             "GoogleTokenVerifier, CaptchaVerifier, AuthRecoveryBL, SessionBL, "
             "InputValidator, UploadValidator, EmailSender")
    p.bullet("Domain BL: User, ActivityLog, InjuryReport, Coach, CoachTrainee, "
             "Message, Social, Gym, Nutrition, Records, Board, Community, "
             "Calendar, Program, WorkoutTemplate, WorkoutComment, "
             "Recommendation, CoachRecommendation, UserDevice")
    p.bullet("Integrations: PushSender (FCM/FirebaseAdmin), PlacesService (Google Places)")
    p.bullet("DAL: one per domain over DBservice.cs (Connect + sproc helper); "
             "newer DALs (Program, Calendar, Community, Board) use inline "
             "parameterised SQL.")
    p.h2("9.3  Models (47)")
    p.body("POCOs shared between layers (User, ActivityLog, DailyLoad, "
           "LoadParameters, UserLoadContext, Coach*, Message*, Social*, "
           "Program*, Calendar*, Community*, Records*, Nutrition*, ...) plus a "
           "handful of Create*/Update* request objects. Unlike the 2026-04 "
           "draft, the models now carry the full column set (Email, IsCoach, "
           "IsTrainee, ExperienceLevel, baseline fields, ExertionLevel, "
           "Duration, CalculatedLoadForSession, IsConfirmed).")

    # ========================================================================
    # 10. FRONTEND
    # ========================================================================
    p.h1("10. Frontend - React Native Expo")
    p.h2("10.1  Navigation tree (4 tabs)")
    p.code_block(
        "AppNavigator (auth vs app based on the session)\n"
        "+-- AuthStack: Welcome -> Login | SignUp -> SignUpFinal\n"
        "+-- AppTabs (Home / Load / Health / Connect)\n"
        "      HomeTab   -> Home, Stats, Warnings, AddWorkout, Injury,\n"
        "                   ActiveInjuries, WorkoutSummary/Route, Settings,\n"
        "                   ConnectQR, Shop, AIChat/Plan, Chat, MyNetwork,\n"
        "                   CoachTraineeDetail -> CoachTraineeAnalytics,\n"
        "                   Profile, PersonalRecords, TrainingCalendar,\n"
        "                   Programs, Timer, Achievements, LiveRun\n"
        "      LoadTab   -> WarningsDashboard (load trend + analytics)\n"
        "      HealthTab -> HealthConnect (GoogleFitScreen) + WorkoutRoute\n"
        "      ConnectTab-> Connect, Requests, MyNetwork, Chat, Board,\n"
        "                   Leaderboard, Feed, Challenges, Events, EventChat\n"
        "\n"
        "Coach-only users see only Home + Connect (Load/Health hidden).\n"
    )
    p.h2("10.2  Module layout & theme system")
    p.bullet("config/backend.js - the single BACKEND_MODE + API_BASE_URL source.")
    p.bullet("api/ + services/ - AuthContext + JWT token store, the axios "
             "clients, Health Connect service + sync, messages/social contexts, "
             "weather + OpenAI + Google-auth helpers. services/mlApi.js = the ML client.")
    p.bullet("theme/ - a MUTABLE Colors singleton swapped by applyTheme(); every "
             "screen must read it via the useThemedStyles(makeStyles) hook "
             "(a StyleSheet.create at module scope freezes colours and never "
             "theme-switches).")
    p.bullet("i18n/ - EN / HE / FR translations foundation.")
    p.bullet("utils/ (~55) - pure logic: acwr / loadSeries mirrors, badges, "
             "quests, calories, recovery, injuryRisk, achievements, etc.")
    p.h2("10.3  Screens (by group)")
    p.bullet("Auth: Welcome, Login, SignUp, SignUpFinal, ForgotPassword")
    p.bullet("Load core: Home, HomeRouter, Stats, WarningsDashboard, "
             "WorkoutSummary; components LoadAnalyticsSection + AcwrTrendChart")
    p.bullet("Workouts: AddWorkout, Timer, LiveRun, WorkoutRoute, ExerciseLibrary, "
             "PersonalRecords, NutritionScreen")
    p.bullet("Injuries: InjuryReport, ActiveInjuries")
    p.bullet("Coach: CoachDashboard, CoachTraineeDetail, CoachTraineeAnalytics "
             "(PMC/ACWR/forecast/what-if), CoachPrograms, ProgramBuilder, "
             "CoachMarketplace")
    p.bullet("Programs/calendar: TrainingCalendar, MyPrograms, ProgramDetail")
    p.bullet("Social/community: Connect, ConnectQR, Requests, MyCoach (MyNetwork), "
             "WorkoutBoard, Leaderboard, Feed, Challenges, Events, EventChat, "
             "SharedWorkout")
    p.bullet("Chat & AI: Chat, AIChat, AIPlan")
    p.bullet("Gamification & misc: Shop, Achievements, Profile, Settings, Health "
             "Connect (GoogleFitScreen)")
    p.h2("10.4  Health Connect integration")
    p.body(
        "Read-only sync from Google Health Connect into backend ActivityLogs "
        "(HealthConnectService -> SyncService -> useSyncWorkouts). A persistent "
        "tombstone set stops deleted workouts re-importing. Getting the app to "
        "APPEAR in Health Connect on Android 14+/16 required a "
        "VIEW_PERMISSION_USAGE + HEALTH_PERMISSIONS activity-alias in the "
        "manifest (the months-long 'Android 16 wall'). Six read permissions; "
        "the app ships as a RELEASE APK (not Expo Go), and expo prebuild / EAS "
        "must NOT be used (they wipe the manual native edits)."
    )

    # ========================================================================
    # 11. ML SERVICE
    # ========================================================================
    p.h1("11. ML Service - Python / Flask (the smart element)")
    p.body(
        "A standalone Flask microservice (ml/app.py, port 8000) the app calls "
        "directly. It reads the same SQL database and mirrors the C# load "
        "formula exactly. It implements the spec in "
        "Python Course ML/TrainWise_Smart_Injury_Prevention_Updated.pdf and is "
        "the project's ML / Data-Science deliverable. It is live on Azure "
        "(trainwise-ml) but the app uses the local instance by default."
    )
    p.h3("Endpoints")
    p.code_block(
        "GET /health\n"
        "GET /api/ml/trainee/<id>/pmc         Fitness / Fatigue / Form series\n"
        "GET /api/ml/trainee/<id>/acwr        AC ratio + safe-zone thresholds\n"
        "GET /api/ml/trainee/<id>/analytics   rolling + bias-corrected EWMA\n"
        "GET /api/ml/trainee/<id>/forecast    monthly projection + risk (+snapshot)\n"
        "GET /api/ml/trainee/<id>/forecast/history\n"
        "GET /api/ml/trainee/<id>/whatif?addSessions=&intensity=easy|medium|hard\n"
    )
    p.h3("Task 1 - Regression (monthly forecast)")
    p.body(
        "Splits the month into fixed weeks and fits the COMPLETED weeks: recent "
        "pace under 2 weeks, LinearRegression at 2, PolynomialFeatures(2) at 4+ "
        "only if it clearly fits better. Chronic is recomputed day-by-day in a "
        "forward simulation (so a rising acute is divided by a rising chronic "
        "and the ratio converges, instead of the old frozen-chronic bug that "
        "produced impossible ratios). Confidence = R-squared. Snapshots append "
        "to MonthlyForecasts, so a month refines weekly and past months stay "
        "reviewable. A global model (forecast_model.pkl, trained on documented "
        "synthetic data) runs alongside as a secondary comparison."
    )
    p.h3("Task 2 - Classification (overload risk)")
    p.body(
        "Labels each state Safe / Warning / High. Loads risk_model.pkl (a "
        "RandomForest chosen in the notebook over LogisticRegression) when "
        "present, else falls back to the threshold rule so the badge always "
        "renders. Features: AC ratio, acute, chronic, experience, age, "
        "active-injury count."
    )
    p.h3("Charts, clustering, what-if")
    p.bullet("PMC: Fitness (chronic) / Fatigue (acute) / Form (fitness - fatigue).")
    p.bullet("ACWR chart: ratio over time, 0.8-1.3 safe band shaded, 1.5 danger line.")
    p.bullet("KMeans clustering segments trainees by load profile.")
    p.bullet("What-if: injects N easy/medium/hard sessions (150/300/450) onto "
             "today and recomputes with the SAME rolling math; verified "
             "+3 hard: 1.06 Warning -> 1.93 High.")
    p.h3("Notebooks (gradeable, course-style)")
    p.body(
        "ml/notebook/*.ipynb follow the course flow: clean, EDA (seaborn "
        "heatmaps), regression (MAE/MSE/RMSE/R2 + residuals), classification "
        "(Accuracy/Precision/Recall/F1 + confusion matrix + multiclass ROC/AUC), "
        "KMeans, and joblib export. Real data drives the charts; synthetic data "
        "trains the global models, and the split is documented for the grader."
    )
    p.card("Sports-science basis",
           "ACWR (Gabbett 2016), bias-corrected EWMA (Williams 2017 + the Adam "
           "zero-init correction, Kingma & Ba 2015), the PMC fitness-fatigue "
           "model, and Foster's monotony & strain (1998). Real, cited methods.")

    # ========================================================================
    # 12. FEATURE INVENTORY
    # ========================================================================
    p.h1("12. Feature Inventory (grouped)")
    p.body("~109 shipped features. Highlights by area:")
    p.h3("Load & injury core")
    p.body("ACWR dashboard (Home + Load tab), Warnings dashboard, load-trend "
           "analytics (rolling + EWMA), injury reporting + active tracking + "
           "mark-recovered, body-map picker, pain logging, rehab suggestions, "
           "injury-risk gauge.")
    p.h3("Workouts & wearables")
    p.body("Manual add-workout, Health Connect sync, workout templates, interval "
           "timer, live GPS run (background tracking), HR zones, CSV/PDF export, "
           "notes/photos, exercise library, personal bests, deep-link share.")
    p.h3("Coach / trainee")
    p.body("QR + coach-offer linking, per-trainee dashboard, ML analytics "
           "(PMC/ACWR/forecast/what-if), assigned programs (fan out to calendar), "
           "coach comments, video form-check, progress reports, marketplace + reviews.")
    p.h3("Social & community")
    p.body("Friends, gyms map (real Netanya gyms), live presence, workout board + "
           "comments + kudos, activity feed, friend challenges, group events, "
           "leaderboards + seasonal divisions.")
    p.h3("Chat, gamification, AI, health")
    p.body("User chat (text/image/voice) + reactions + typing + group chat + FCM "
           "push; badges + coins + shop + streaks + quests + confetti; weather "
           "smart card, AI week-in-review / plan / ask-my-data / injury-photo "
           "advice; nutrition + barcode + calorie ring, weight/body composition, "
           "sleep/HRV readiness.")
    p.h3("Platform / UX")
    p.body("Dark + light themes + accent picker, i18n (EN/HE/FR), biometric "
           "login, forgot/reset password + email verification, multi-device "
           "sessions, notification preferences, What's-New changelog, accessibility pass.")

    # ========================================================================
    # 13. DATA FLOWS
    # ========================================================================
    p.h1("13. End-to-End Data Flows")
    p.h2("Add workout")
    p.code_block(
        "AddWorkoutScreen (or LiveRun / Health Connect confirm)\n"
        "  -> services/api.createActivityLog(payload)  # duration x exertion\n"
        "       POST /api/activitylog -> ActivityLogBL -> ActivityLogDAL\n"
        "  -> services/api.calculateDailyLoad(userId, date, tzOffsetMinutes) x2\n"
        "       POST /api/dailyload/user/{id}/calculate\n"
        "         LoadCalculationBL.CalculateAndSave\n"
        "           bucket-by-local-day, acute 7d, EffectiveChronic 28d,\n"
        "           ratio, level, stress -> sp_SaveDailyLoad\n"
        "  -> navigate WorkoutSummary { summary }\n"
    )
    p.h2("Coach analytics / forecast (ML)")
    p.code_block(
        "CoachTraineeAnalyticsScreen (also the trainee's 'My analytics')\n"
        "  -> services/mlApi.getTrainee{Pmc|Acwr|Analytics|Forecast|WhatIf}\n"
        "       GET http://<host>:8000/api/ml/trainee/{id}/...\n"
        "         features.py (rolling + EWMA) / forecast.py / risk.py\n"
        "         reads ActivityLogs directly (never stale DailyLoad rows)\n"
        "  -> SVG charts (PMC, ACWR safe-zone), forecast card, what-if planner\n"
        "  If the ML service is unreachable, the screen degrades to the C#\n"
        "  fallback (LoadAnalyticsBL) and then the on-device JS mirror.\n"
    )

    # ========================================================================
    # 14. BUILD, RUN & DEPLOY
    # ========================================================================
    p.h1("14. Build, Run & Deploy")
    p.h2("Database")
    p.bullet("Run sql/TWDB.sql, then the dated migrations in order, then "
             "seed_reference_data.sql (see CLAUDE.md for the exact run-order). "
             "Run on BOTH local and Azure DBs.")
    p.h2("Backend")
    p.bullet("Open TrainWise.sln in VS 2022, run (Swagger at "
             "https://localhost:5249/swagger in Development). For Azure: "
             "right-click Publish.")
    p.bullet("Local LAN: bind 0.0.0.0:5249, firewall TCP 5249 (Private).")
    p.h2("ML service")
    p.code_block(
        "cd ml\n"
        "python -m venv venv & venv\\Scripts\\activate\n"
        "pip install -r requirements.txt\n"
        "python app.py            # http://0.0.0.0:8000  (firewall TCP 8000)\n"
        "# Azure: deploy the ml_deploy_clean folder; 4 App Settings for SQL auth\n"
    )
    p.h2("Frontend APK")
    p.code_block(
        "cd TrainWiseExpo\n"
        "npm install\n"
        "npx expo run:android --variant release     # or:\n"
        "cd android & gradlew assembleRelease        # delete app/.cxx + app/build\n"
        "                                            # first to force a fresh build\n"
        "# output: android/app/build/outputs/apk/release/app-release.apk\n"
    )
    p.warning("Do NOT run expo prebuild / EAS Build",
              "Both regenerate android/ from app.json + plugins and WIPE the "
              "manual Health-Connect manifest edits (the activity-alias for "
              "Android 14+), which silently breaks HC. Use gradlew / "
              "expo run:android instead. Verify a fresh APK by its timestamp, "
              "not the 'BUILD SUCCESSFUL' line.")

    # ========================================================================
    # 15. KNOWN ISSUES & BACKLOG
    # ========================================================================
    p.h1("15. Known Issues & Backlog")
    p.warning("ML service is local-only by default",
              "mlApi.js ML_MODE defaults to 'local', so the coach analytics, "
              "trainee Load Trend and the what-if planner need the local Python "
              "service reachable on the same WiFi. The code is Azure-ready "
              "(ml/db.py dual-mode, the trainwise-ml resource is live); flip "
              "ML_MODE to 'azure' + rebuild to use the cloud.")
    p.warning("mlApi.js hardcodes its own ML IP",
              "It carries its own ML_BASE_URL instead of importing LOCAL_ML_URL "
              "from config/backend.js, so the PC-IP change is a two-file edit "
              "(backend.js AND mlApi.js) rather than one.")
    p.warning("AI key shipped in the APK",
              "The OpenAI + Google Maps keys use the EXPO_PUBLIC_ prefix, so "
              "they are baked into the APK in plaintext. Fine for the demo; do "
              "not distribute the APK publicly. Production fix: proxy the calls "
              "through the backend.")
    p.warning("wwwroot/images on Azure",
              "Profile-pic + chat-image uploads write to wwwroot/images, which "
              "Azure App Service may wipe on restart. Migrate to Azure Blob "
              "Storage or a persisted disk for production persistence.")
    p.small("Resolved since the 2026-04 draft: the login/AuthController now "
            "exists (JWT), passwords are PBKDF2-hashed (not plaintext), the "
            "controller-attribute and model-column gaps are closed, "
            "intensityFactor is removed, and the two axios clients now share one "
            "API_BASE_URL. The forward backlog (IDs 110-185) lives in "
            "tasks/feature_backlog.md.")

    # ========================================================================
    # 16. FILE INDEX & CHANGE LOG
    # ========================================================================
    p.h1("16. File Index & Change Log")
    p.h2("Key documents")
    p.body("CLAUDE.md                         master engineering doc (architecture, "
           "HC rules, secrets, deploy)")
    p.body("PROJECT_SUMMARY.md                full project overview")
    p.body("tasks/lessons.md                  the self-learning log (~90 entries)")
    p.body("tasks/feature_backlog.md          forward backlog (IDs 110-185)")
    p.body("sql/seed_reference_data.sql       required lookup + demo seed")
    p.body("ml/notebook/*.ipynb               gradeable ML notebooks")
    p.h2("What changed in this edition (vs 2026-04-16)")
    p.bullet("Added: JWT auth + security hardening (section 6).")
    p.bullet("Added: the Python ML service (section 11) and the 4-tier architecture.")
    p.bullet("Added: deployment modes, the feature inventory, and the corrected "
             "cold-start load math.")
    p.bullet("Corrected: intensityFactor removed; counts (29 controllers, ~60 "
             "screens, ~40 tables); release APK (not Expo Go); PBKDF2 passwords.")
    p.bullet("Removed: obsolete 'no auth' / 'broken controller' / 'plaintext "
             "password' warnings (all resolved).")

    # ===== END =====
    p.spacer(16)
    p.h2("End of document")
    p.small("Regenerate at any time:  py generate_docs_pdf.py")

    p.save()


if __name__ == "__main__":
    build()
