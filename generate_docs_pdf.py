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
                              "Mobile App  |  Complete Project Reference",
                              fontsize=16, color=WHITE, fontname="helv")
        self.page.insert_text((MARGIN_L, 360),
                              "React Native + Expo  /  ASP.NET Core 8  /  SQL Server",
                              fontsize=12, color=(0.7, 0.75, 0.85))
        self.page.insert_text((MARGIN_L, 460),
                              "Every screen. Every endpoint. Every table.",
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
                              "Generated: 2026-04-16",
                              fontsize=11, color=WHITE)
        self.page.insert_text((MARGIN_L, PAGE_H - 60),
                              "Document built by Claude Code (claude-opus-4-6)",
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
        "4.  Architecture (4 layers)",
        "5.  SQL Server Database",
        "       5.1  All tables",
        "       5.2  All stored procedures",
        "       5.3  AC-Ratio training-load algorithm",
        "6.  Backend - C# ASP.NET Core 8",
        "       6.1  Program.cs / appsettings",
        "       6.2  Controllers (12)",
        "       6.3  Business Logic (BL)",
        "       6.4  Data Access Layer (DAL)",
        "       6.5  Models",
        "7.  Frontend - React Native Expo",
        "       7.1  App bootstrap",
        "       7.2  AuthContext + session flow",
        "       7.3  Navigation tree",
        "       7.4  api.js / services/api.js (split)",
        "       7.5  Health Connect integration",
        "       7.6  Sync pipeline",
        "       7.7  Theme & components",
        "       7.8  Every screen",
        "8.  End-to-End Data Flows",
        "9.  Build & Run instructions",
        "10. Known Issues & Architectural Gaps",
        "11. File Index",
    ]
    for line in toc:
        p.body(line)
    p.spacer(10)

    # ============================================================================
    # 1. PROJECT OVERVIEW
    # ============================================================================
    p.h1("1.  Project Overview")
    p.body(
        "TrainWise is a mobile fitness application that helps amateur and "
        "semi-professional athletes monitor training load and prevent injuries. "
        "Users log workouts (manually or imported from Health Connect on "
        "Android), and the system calculates an Acute:Chronic workload ratio "
        "(AC ratio), classifies risk on a Green / Yellow / Red traffic-light "
        "scale, and surfaces personalized recommendations. Coaches can connect "
        "to their trainees through a QR-code based handshake and receive a "
        "summary of each trainee's current load."
    )
    p.spacer(6)
    p.h2("Primary user stories")
    p.bullet("As an athlete, I log a workout and immediately see whether my "
             "training load is in a safe zone or trending towards overload.")
    p.bullet("As an athlete, I get personalized recommendations after each "
             "session (rest, light activity, push harder).")
    p.bullet("As an athlete, I report an injury so the system tightens my "
             "load thresholds for the recovery window.")
    p.bullet("As a coach, I scan a trainee's QR code, see all my trainees on "
             "one screen with their current AC ratio and load level.")
    p.bullet("As a user, I import workouts from Google / Samsung Health "
             "(Android Health Connect) so I do not have to enter them manually.")

    p.spacer(6)
    p.h2("Project authors & branches")
    p.kv("Author:", "Liron Vaknin")
    p.kv("Repo:",   "TrainWise_GitHub  (single git repo at TrainWise_Project root)")
    p.kv("Backend branch:", "main / Lirone's-Branch (mirror of TrainWise_GitHub)")
    p.kv("Recent commits:", "793af4b 'Adding .sln File',  0626afb 'Server_Side'")

    # ============================================================================
    # 2. TECH STACK
    # ============================================================================
    p.h1("2.  Technology Stack")

    p.h2("Frontend")
    p.bullet("React Native 0.81.5 + React 19.1.0")
    p.bullet("Expo SDK 54 (managed workflow)")
    p.bullet("React Navigation v7  -  native stack + bottom tabs")
    p.bullet("axios 1.x for HTTP")
    p.bullet("@react-native-async-storage/async-storage  -  session persistence")
    p.bullet("react-native-chart-kit  -  weekly load bar charts")
    p.bullet("react-native-qrcode-svg  -  coach/trainee handshake")
    p.bullet("react-native-health-connect  -  Android Health Connect (real device only)")
    p.bullet("@expo/vector-icons (Ionicons)  -  tab bar icons")

    p.h2("Backend")
    p.bullet("ASP.NET Core 8.0 (net8.0) Web API")
    p.bullet("Microsoft.Data.SqlClient 6.1.3  -  SQL Server access")
    p.bullet("Swashbuckle.AspNetCore 6.6.2  -  Swagger / OpenAPI")
    p.bullet("Built-in Microsoft.Extensions.Configuration for appsettings.json")
    p.bullet("CORS: AllowAnyOrigin (development), no auth middleware")

    p.h2("Database")
    p.bullet("Microsoft SQL Server Express")
    p.bullet("Instance: Lirone\\SQLEXPRESS  -  database: TrainWise")
    p.bullet("Connection: Integrated Security (Windows auth), Encrypt=False")
    p.bullet("16 tables, 49 stored procedures (the entire DAL layer is sproc-based)")

    p.h2("Mobile testing path")
    p.bullet("Android phone -> Expo Go app -> connects to PC via USB")
    p.bullet("adb reverse tcp:5249 tcp:5249  -  exposes PC port 5249 on phone")
    p.bullet("Frontend uses base URL http://127.0.0.1:5249  -  resolved on PHONE")
    p.bullet("Backend runs HTTP only (HTTPS dev cert is not trusted by phone)")

    # ============================================================================
    # 3. REPO LAYOUT
    # ============================================================================
    p.h1("3.  Repository Layout")
    p.code_block(
        "TrainWise_Project/\n"
        "  TrainWise_GitHub/                <-- C# backend (active)\n"
        "    BL/                            -- Business logic (12 classes)\n"
        "      Models/                      -- POCOs (15 classes)\n"
        "    Controllers/                   -- ASP.NET controllers (12)\n"
        "    DAL/                           -- Data access (14 classes)\n"
        "      DBservice.cs                 -- Base: SqlConnection + sproc helper\n"
        "    Program.cs                     -- ASP.NET startup\n"
        "    appsettings.json               -- ConnectionString to SQL Express\n"
        "    TrainWise.csproj               -- Net8 project file\n"
        "    TrainWise.sln                  -- Solution file\n"
        "\n"
        "  TrainWiseExpo/                   <-- React Native frontend (active)\n"
        "    App.js                         -- Provider chain root\n"
        "    index.js                       -- registerRootComponent(App)\n"
        "    app.json                       -- Expo config\n"
        "    package.json                   -- RN 0.81 / React 19 / Expo 54\n"
        "    assets/images/wowowow.png      -- Brand logo (cover screen)\n"
        "    src/\n"
        "      api/                         -- AuthContext + axios + Health Connect\n"
        "        api.js                     -- Base axios + auth/login + ActivityLog\n"
        "        AuthContext.js             -- Global session (user, login, logout)\n"
        "        HealthConnectService.js    -- Real native module wrapper\n"
        "        HealthConnectService.mock.js  -- Expo Go fallback (no native)\n"
        "        SyncService.js             -- HC -> backend orchestration\n"
        "        useSyncWorkouts.js         -- Hook: triggerSync(), state\n"
        "        GoogleFitScreen.js         -- Health Connect UI screen\n"
        "      services/\n"
        "        api.js                     -- The other axios with all CRUD funcs\n"
        "      navigation/\n"
        "        NavigationStack.js         -- AuthStack / AppStack tabs\n"
        "      screens/                     -- 11 screens\n"
        "      components/                  -- Card, ScreenHeader, PrimaryButton\n"
        "      theme/colors.js              -- Color/Font/Spacing tokens\n"
        "      constants/google.js          -- GOOGLE_WEB_CLIENT_ID\n"
        "\n"
        "  github - server-side/            <-- Old duplicate (BL/Controllers/DAL\n"
        "                                       only, no .csproj). Candidate for\n"
        "                                       deletion - awaiting confirmation.\n"
        "\n"
        "  generate_docs_pdf.py             <-- This script\n"
        "  TrainWise_Project_Documentation.pdf\n"
        "\n"
        "  ../SQL/TrainWiseDB_Script.sql    <-- DB schema + seed (UTF-16LE!)\n"
    )

    # ============================================================================
    # 4. ARCHITECTURE
    # ============================================================================
    p.h1("4.  Architecture - 4 layers")
    p.body(
        "Every request flows through exactly four layers. Each layer talks "
        "only to the one directly below it. The DAL never instantiates a BL, "
        "BL never reads HttpContext, etc. This keeps the boundaries clean."
    )
    p.code_block(
        "  Mobile UI (React Native screens)\n"
        "        |  axios (HTTP/JSON)\n"
        "        v\n"
        "  Controller          -- thin: validate route, call BL, map exceptions\n"
        "        |\n"
        "        v\n"
        "  BL (Business Logic) -- input validation, cross-entity rules\n"
        "        |\n"
        "        v\n"
        "  DAL (Data Access)   -- inherits DBservice, calls stored procedure\n"
        "        |\n"
        "        v\n"
        "  SQL Server          -- stored procedures own the algorithm\n"
    )

    p.spacer(4)
    p.card("Why stored procedures?",
           "All business-critical reads (GetActivityLogsForLoad, "
           "GetUserLoadContext) and writes (SaveDailyLoad) live in T-SQL. The "
           "C# DAL is a thin marshaller: open connection, call sproc, map "
           "rows. The AC-Ratio formula itself is computed in the DailyLoadDAL "
           "(C# pulls the activity rows, runs the math, then calls "
           "sp_SaveDailyLoad to persist).")

    # ============================================================================
    # 5. DATABASE
    # ============================================================================
    p.h1("5.  SQL Server Database")
    p.h2("5.1  Tables (16)")

    tables = [
        ("Users",
         "UserID (PK identity), FullName, BirthYear, Gender, Height, Weight, "
         "ActivityLevel, CreatedAt, DeviceType, UserName, Email, "
         "Password char(8) (plain text!), ExperienceLevel (1=Beginner, "
         "2=Regular, 3=Advanced), BaseLineDailyLoad, BaseLineWeeklyLoad, "
         "HealthDeclaration bit, ConfirmTerms bit, TermConfirmationDate, "
         "ProfileImagePath, IsBaselineEstablished bit, "
         "BaselineEstablishedDate, IsCoach bit"),
        ("ActivityTypes",
         "ActivityTypeID (PK identity), TypeName, IntensityFactor decimal(5,2). "
         "Seeded with Running 1.30, Walking 0.80, Cycling 1.10, CrossFit 1.50, "
         "Swimming 1.20."),
        ("ActivityLogs",
         "ActivityID (PK), UserID, ActivityTypeID, StartTime, EndTime, "
         "DistanceKM, AvgHeartRate, MaxHeartRate, CaloriesBurned, "
         "SourceDevice, ExertionLevel tinyint (1-10), Duration smallint "
         "(minutes), CalculatedLoadForSession smallint (Duration x Exertion x "
         "IntensityFactor), IsConfirmed bit."),
        ("DailyLoad",
         "LoadID (PK), UserID, Date, AcuteLoad float (last 7 days), "
         "ChronicLoad float (last 28 days), AC_Ratio float (acute / chronic), "
         "StressScore int (0-100), LoadLevel nvarchar(20) ('Green' / 'Yellow' "
         "/ 'Red')."),
        ("LoadParameters",
         "Single-row config table. BeginnerDailyLoad / RegularDailyLoad / "
         "AdvanceDailyLoad (smallint), BeginnerAcuteLoad / RegularAcuteLoad / "
         "AdvanceAcuteLoad, LowLoadRatio (float), SafeZoneLowRange (float), "
         "SafeZoneHighRange (float), OverLoad (float). Reference values used "
         "until a personal baseline is established."),
        ("Recommendations",
         "RecID (PK), UserID, Date, LoadLevel, RecommendationText nvarchar(max), "
         "Type. System-generated suggestions per daily load calculation."),
        ("Coaches",
         "CoachID (PK), FullName, Email, UserID (nullable link to Users)."),
        ("CoachTrainees",
         "Composite PK (CoachID, UserID), ConnectionDate, AllowNotifications. "
         "Many-to-many: a coach can have many trainees."),
        ("CoachRecommendations",
         "RecID (PK), CoachID, UserID, Date, Title, Text. Coach-authored "
         "messages to a specific trainee."),
        ("InjuryTypes",
         "InjuryTypeID (PK), InjuryName. Catalog of injury labels (Knee Pain, "
         "Shin Splints, Ankle Sprain, ...)."),
        ("InjuryCategories",
         "Composite PK (InjuryTypeID, CategoryName). Many categories per "
         "injury type."),
        ("InjuriesReports",
         "InjuryID (PK), UserID, InjuryTypeID, Date, Severity (1-10 in UI but "
         "BL validates 1-5), Notes nvarchar(max), IsActiveInjury bit."),
        ("TrainingGoals",
         "GoalID (PK), GoalName. Catalog of goals user can pick from."),
        ("UserTrainingGoals",
         "Composite PK (UserID, GoalID). Many-to-many user <-> goal."),
        ("UserActivityPreferences",
         "Composite PK (UserID, ActivityTypeID). Activities the user marks as "
         "preferred."),
        ("UserDevices",
         "DeviceID (PK), UserID, DeviceName, LastSync datetime, "
         "PermissionsGranted bit. Used by SyncService.updateDeviceLastSync to "
         "track the last successful Health Connect pull."),
    ]
    for name, desc in tables:
        p.card(name, desc)

    # ----- Stored procedures -----
    p.h2("5.2  Stored Procedures (49)")
    p.body(
        "The DAL never builds dynamic SQL; every call goes through one of "
        "these. Naming convention: sp_VerbNoun."
    )

    sp_groups = [
        ("Users",
         ["sp_InsertUser", "sp_UpdateUser", "sp_DeleteUser", "sp_GetUserByID",
          "sp_GetAllUsers", "sp_GetUserSummary", "sp_GetUserLoadContext",
          "sp_UpdateUserBaseline", "sp_UpdateUserProfileImage",
          "sp_LoginUser  (email + 8-char plaintext password)"]),
        ("Activity",
         ["sp_InsertActivityLog", "sp_UpdateActivityLog",
          "sp_DeleteActivityLog", "sp_GetActivityLogsByUser",
          "sp_GetActivityLogsForLoad  (last 28 days, with IntensityFactor "
          "joined - feeds C# AC ratio calc)",
          "sp_GetAllActivityTypes", "sp_InsertActivityType"]),
        ("Daily load",
         ["sp_GetDailyLoadByUser",
          "sp_SaveDailyLoad  (upsert + optional baseline establishment)"]),
        ("Recommendations",
         ["sp_InsertRecommendation", "sp_GetRecommendationsByUser",
          "sp_InsertCoachRecommendation",
          "sp_GetCoachRecommendationsByUser"]),
        ("Coach",
         ["sp_InsertCoach", "sp_DeleteCoach", "sp_GetCoachByID",
          "sp_GetCoachByUserID", "sp_ConnectTraineeToCoach",
          "sp_DisconnectTrainee", "sp_GetTraineesWithLoadByCoach",
          "sp_GetTraineeDailyLoadForCoach"]),
        ("Injuries",
         ["sp_InsertInjuryReport", "sp_GetInjuriesByUser",
          "sp_GetActiveInjuriesByUser", "sp_GetAllInjuryTypes"]),
        ("Goals & Preferences",
         ["sp_AddUserTrainingGoal", "sp_RemoveUserTrainingGoal",
          "sp_AddUserActivityPreference",
          "sp_RemoveUserActivityPreference", "sp_GetAllTrainingGoals"]),
        ("Devices & config",
         ["sp_InsertUserDevice", "sp_UpdateUserDevice", "sp_GetUserDevices",
          "sp_GetLoadParameters"]),
    ]
    for group, items in sp_groups:
        p.h3(group)
        for sp in items:
            p.bullet(sp)

    # ----- AC ratio algorithm -----
    p.h2("5.3  AC-Ratio Training-Load Algorithm")
    p.body(
        "TrainWise classifies each day on a Green / Yellow / Red traffic "
        "light. The classification is based on the Acute:Chronic Workload "
        "Ratio (AC ratio), a published sports-medicine model."
    )
    p.h3("Per-session load")
    p.code_block(
        "sessionLoad = Duration (min)  x  Exertion (1-10)  x  IntensityFactor\n"
        "\n"
        "IntensityFactor comes from ActivityTypes:\n"
        "  Running 1.30   Walking 0.80   Cycling 1.10\n"
        "  CrossFit 1.50  Swimming 1.20\n"
    )
    p.h3("Acute & chronic load")
    p.code_block(
        "AcuteLoad   = sum of session loads in the last 7 days\n"
        "ChronicLoad = sum of session loads in the last 28 days, divided by 4\n"
        "AC_Ratio    = AcuteLoad / ChronicLoad   (NULL when ChronicLoad = 0)\n"
    )
    p.h3("Traffic-light classification")
    p.code_block(
        "Lookup thresholds from LoadParameters:\n"
        "  LowLoadRatio       (e.g. 0.8)\n"
        "  SafeZoneLowRange   (e.g. 0.8)\n"
        "  SafeZoneHighRange  (e.g. 1.3)\n"
        "  OverLoad           (e.g. 1.5)\n"
        "\n"
        "if AC_Ratio < LowLoadRatio              -> Yellow ('undertraining')\n"
        "elif SafeLow <= AC_Ratio <= SafeHigh    -> Green  (safe zone)\n"
        "elif SafeHigh < AC_Ratio < OverLoad     -> Yellow (caution)\n"
        "else                                    -> Red    (overload risk)\n"
    )
    p.h3("Bootstrap mode (no baseline yet)")
    p.body(
        "Until the user has 28 days of data, IsBaselineEstablished = 0 and "
        "the system uses LoadParameters absolute thresholds (Beginner / "
        "Regular / Advance daily/acute) keyed off ExperienceLevel. Once the "
        "baseline window closes, sp_SaveDailyLoad upgrades the user to "
        "personal baselines (BaseLineDailyLoad / BaseLineWeeklyLoad)."
    )
    p.h3("Active-injury modifier")
    p.body(
        "If sp_GetUserLoadContext returns HasActiveInjury=1, the C# layer "
        "tightens the Yellow/Red thresholds (currently a TODO marker in "
        "DailyLoadDAL - see Known Issues)."
    )

    # ============================================================================
    # 6. BACKEND
    # ============================================================================
    p.h1("6.  Backend - C# ASP.NET Core 8")

    p.h2("6.1  Program.cs / appsettings")
    p.body("Startup is intentionally minimal:")
    p.code_block(
        "var builder = WebApplication.CreateBuilder(args);\n"
        "builder.Services.AddControllers();\n"
        "builder.Services.AddEndpointsApiExplorer();\n"
        "builder.Services.AddSwaggerGen();\n"
        "builder.Services.AddCors(o => o.AddDefaultPolicy(p =>\n"
        "    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));\n"
        "var app = builder.Build();\n"
        "if (app.Environment.IsDevelopment()) {\n"
        "    app.UseSwagger();\n"
        "    app.UseSwaggerUI();\n"
        "}\n"
        "app.UseHttpsRedirection();   // <-- comment out for phone testing\n"
        "app.UseCors();\n"
        "app.UseAuthorization();      // present but no AddAuthentication()\n"
        "app.MapControllers();\n"
        "app.Run();\n"
    )
    p.h3("appsettings.json")
    p.code_block(
        '"ConnectionStrings": {\n'
        '  "myProjDB": "Data Source=Lirone\\\\SQLEXPRESS;'
        'Initial Catalog=TrainWise;Integrated Security=True;Encrypt=False"\n'
        '}\n'
    )
    p.h3("Listening URL")
    p.kv("HTTP:",  "http://localhost:5249  (the URL the phone reaches via adb reverse)")
    p.kv("HTTPS:", "https://localhost:7126 (dev cert, do NOT use from phone)")
    p.kv("Swagger:", "http://localhost:5249/swagger")

    # ----- Controllers -----
    p.h2("6.2  Controllers")
    p.body(
        "All controllers follow the same shape: instantiate the matching BL "
        "in the constructor, wrap each action in try / catch, return Ok / "
        "BadRequest / 500."
    )

    controllers = [
        ("UsersController",
         "[ApiController] [Route(\"api/users\")]",
         ["POST   /api/users                          - Create",
          "PUT    /api/users/{id}                      - Update",
          "DELETE /api/users/{id}                      - Delete",
          "GET    /api/users/{id}                      - GetById",
          "GET    /api/users                           - GetAll",
          "PUT    /api/users/{id}/profile-image        - SetProfileImagePath"]),
        ("ActivityLogController",
         "[ApiController] [Route(\"api/activitylog\")]",
         ["POST   /api/activitylog                     - Create",
          "PUT    /api/activitylog                     - Update",
          "DELETE /api/activitylog/{id}                - Delete",
          "GET    /api/activitylog/user/{userId}       - GetByUser"]),
        ("DailyLoadController",
         "[ApiController] [Route(\"api/dailyload\")]",
         ["POST   /api/dailyload/user/{userId}/calculate - "
          "Run AC-ratio calc for today, save, return tuple",
          "GET    /api/dailyload/user/{userId}         - GetByUser (history)"]),
        ("RecommendationController",
         "[ApiController] [Route(\"api/recommendation\")]",
         ["POST   /api/recommendation                  - Create",
          "GET    /api/recommendation/user/{userId}    - GetByUser"]),
        ("InjuryReportController",
         "[ApiController] [Route(\"api/injuryreport\")]",
         ["POST   /api/injuryreport                    - Create",
          "GET    /api/injuryreport/user/{userId}      - GetByUser",
          "GET    /api/injuryreport/user/{userId}/active - GetActive"]),
        ("InjuryTypesController",
         "[ApiController] [Route(\"api/injurytypes\")]",
         ["GET    /api/injurytypes                     - GetAll"]),
        ("CoachController",
         "[ApiController] [Route(\"api/coach\")]",
         ["GET    /api/coach/{id}                      - GetById",
          "GET    /api/coach/{id}/trainees             - GetTrainees"]),
        ("TrainingGoalsController",
         "[ApiController] [Route(\"api/traininggoals\")]",
         ["GET    /api/traininggoals                   - GetAll"]),
        ("UserGoalsController",
         "[ApiController] [Route(\"api/usertraininggoals\")]",
         ["POST   /api/usertraininggoals               - AddGoal",
          "DELETE /api/usertraininggoals/{userId}/{goalId} - RemoveGoal"]),
        ("UserActivityPreferencesController",
         "[ApiController] [Route(\"api/useractivitypreferences\")]",
         ["POST   /api/useractivitypreferences         - AddPreference",
          "DELETE /api/useractivitypreferences/{userId}/{actId} - RemovePref"]),
        ("CoachRecommendationsController",
         "(MISSING [ApiController] AND [Route] attributes!)",
         ["Effectively unreachable as written.",
          "Frontend tries /api/coachrecommendations/user/{id} - will 404."]),
        ("UserDevicesController",
         "(MISSING [ApiController] AND [Route] attributes!)",
         ["Effectively unreachable as written.",
          "Frontend tries /api/userdevice/user/{id} - will 404.",
          "Also: src/api/api.js calls /api/users/{id}/devices  -  inconsistent."]),
    ]
    for name, attrs, routes in controllers:
        p.h3(name)
        p.small(attrs)
        for r in routes:
            p.bullet(r)

    p.spacer(6)
    p.warning("No AuthController exists",
              "Frontend /api/auth/login points to a controller that does NOT "
              "exist in the codebase. The sp_LoginUser stored procedure IS "
              "present in the database, so the only missing piece is a thin "
              "AuthController + AuthBL + UserDAL.LoginByEmailPassword that "
              "wraps it. Until that lands, the LoginScreen will throw on "
              "every submit.")

    # ----- BL layer -----
    p.h2("6.3  Business Logic (BL)")
    bls = [
        ("UserBL",
         "Create / Update / Delete / GetById / GetAll / SetProfileImagePath. "
         "Validates: FullName non-empty, BirthYear in [1950..now], Height>0, "
         "Weight>0, ActivityLevel in [1..5], DeviceType non-empty."),
        ("ActivityLogBL",
         "Create / Update / Delete / GetByUser. Validates UserID, "
         "ActivityTypeID, StartTime<EndTime, DistanceKM>=0, and that the user "
         "actually exists (calls UserDAL.GetUserById)."),
        ("DailyLoadBL",
         "CalculateForDay(userId, date) -> tuple(acute, chronic, acRatio, "
         "stressScore, loadLevel). Validates user exists and date<=today. "
         "GetByUser(userId) -> List<DailyLoad>."),
        ("RecommendationBL",
         "Create (validates UserID, LoadLevel, RecommendationText, Type) and "
         "GetByUser."),
        ("InjuryReportBL",
         "Create (Severity must be 1..5, Date<=today, user must exist) and "
         "GetByUser. NOTE: frontend slider is 1..10 - mismatch."),
        ("CoachBL",
         "GetTrainees(coachId) -> List<TraineeSummary>. "
         "GetTraineeLoad(coachId, userId) -> List<DailyLoad>."),
        ("CoachRecommendationBL",
         "Create + GetByUser. Validates CoachID, UserID, Title, Text non-empty."),
        ("UserDeviceBL",
         "Create / Update / GetByUser. Validates UserID and DeviceName."),
        ("InjuryTypeBL",        "GetAll() catalog reader."),
        ("TrainingGoalCatalogBL", "GetAll() catalog reader."),
        ("UserActivityPreferenceBL",
         "AddPreference / RemovePreference. Both validate userId>0 and "
         "activityTypeId>0."),
        ("UserTrainingGoalBL",
         "AddGoal / RemoveGoal. Both validate userId>0 and goalId>0."),
    ]
    for name, desc in bls:
        p.card(name, desc)

    # ----- DAL -----
    p.h2("6.4  Data Access Layer (DAL)")
    p.body(
        "Every DAL inherits from DBservice. The base class supplies two "
        "methods:"
    )
    p.code_block(
        "protected SqlConnection Connect()\n"
        "    -> reads ConnectionStrings:myProjDB from appsettings, opens conn\n"
        "\n"
        "protected SqlCommand CreateCommandWithStoredProcedure(\n"
        "    string spName, SqlConnection con, Dictionary<string,object> params)\n"
        "    -> builds SqlCommand of type StoredProcedure, binds parameters\n"
    )
    p.body("Method-level summary (one bullet per method):")
    dals = [
        "ActivityLogDAL.Insert / Update / Delete / GetByUser",
        "ActivityTypeDAL.GetAll / Insert",
        "CoachDAL.GetCoachById / GetTraineesWithLoad / GetTraineeLoadHistory",
        "CoachRecommendationDAL.Insert / GetByUser",
        "DailyLoadDAL.CalculateDailyLoad (the algorithm) / GetDailyLoadByUser",
        "InjuryReportDAL.InsertInjuryReport / GetInjuriesByUser",
        "InjuryTypeDAL.GetAll",
        "RecommendationDAL.InsertRecommendation / GetByUser",
        "TrainingGoalDAL.GetAll",
        "UserActivityPreferenceDAL.AddPreference / RemovePreference",
        "UserDAL.InsertUser / UpdateUser / DeleteUser / GetUserById / GetAllUsers / "
        "UpdateUserProfileImage  (NO Login method yet)",
        "UserDeviceDAL.Insert / Update / GetByUser",
        "UserTrainingGoalDAL.AddGoal / RemoveGoal",
    ]
    for d in dals:
        p.bullet(d)

    p.spacer(4)
    p.h3("DailyLoadDAL.CalculateDailyLoad - the heart of the app")
    p.body(
        "The C# orchestrator: pulls activity rows via "
        "sp_GetActivityLogsForLoad (last 28 days, joined to ActivityTypes for "
        "IntensityFactor), pulls thresholds + baseline via "
        "sp_GetUserLoadContext, computes Acute / Chronic / AC ratio / stress / "
        "load level, persists via sp_SaveDailyLoad (which also upgrades the "
        "user from bootstrap-mode to personal-baseline mode when ready), and "
        "returns a tuple back up to the BL."
    )

    # ----- Models -----
    p.h2("6.5  Models (POCOs in BL/Models/)")
    models = [
        ("User",
         "UserID, FullName, BirthYear, Gender, Height, Weight, ActivityLevel, "
         "CreatedAt, DeviceType, ProfileImagePath?  -  MISSING Email, "
         "Password, IsCoach, ExperienceLevel, BaseLine* fields that exist in "
         "the SQL table. See Known Issues."),
        ("ActivityLog",
         "ActivityID, UserID, ActivityTypeID, StartTime, EndTime, DistanceKM, "
         "AvgHeartRate, MaxHeartRate, CaloriesBurned, SourceDevice  -  "
         "MISSING ExertionLevel, Duration, CalculatedLoadForSession, "
         "IsConfirmed (frontend sends them, backend silently drops)."),
        ("ActivityType",          "ActivityTypeID, TypeName  (no IntensityFactor!)"),
        ("DailyLoad",             "LoadID, UserID, Date, AcuteLoad, ChronicLoad, "
                                  "AC_Ratio?, StressScore, LoadLevel"),
        ("Recommendation",        "RecID, UserID, Date, LoadLevel, "
                                  "RecommendationText, Type"),
        ("Coach",                 "CoachID, FullName, Email"),
        ("CoachTrainee",          "CoachID, UserID  (just the relation)"),
        ("CoachRecommendation",   "RecID, CoachID, UserID, Date, Title, Text"),
        ("InjuryReport",          "InjuryID, UserID, InjuryTypeID, Date, Severity, "
                                  "Notes  -  no IsActiveInjury field"),
        ("InjuryType",            "InjuryTypeID, InjuryName"),
        ("TraineeSummary",        "UserID, FullName, BirthYear, Gender, "
                                  "DeviceType + LastDate, AcuteLoad, "
                                  "ChronicLoad, AC_Ratio, LoadLevel  (the row "
                                  "rendered on a coach's trainee list)"),
        ("TrainingGoal",          "GoalID, GoalName"),
        ("UserActivityPreference","UserID, ActivityTypeID"),
        ("UserDevice",            "DeviceID, UserID, DeviceName, LastSync, "
                                  "PermissionsGranted"),
        ("UserTrainingGoal",      "UserID, GoalID"),
    ]
    for n, d in models:
        p.kv(n + ":", d)

    # ============================================================================
    # 7. FRONTEND
    # ============================================================================
    p.h1("7.  Frontend - React Native Expo")

    p.h2("7.1  App bootstrap")
    p.code_block(
        "index.js\n"
        "  registerRootComponent(App)\n"
        "\n"
        "App.js\n"
        "  <AuthProvider>\n"
        "    <SafeAreaProvider>\n"
        "      <NavigationContainer>\n"
        "        <AppNavigator />\n"
        "      </NavigationContainer>\n"
        "    </SafeAreaProvider>\n"
        "  </AuthProvider>\n"
        "\n"
        "app.json\n"
        "  slug: TrainWiseExpo,  scheme: trainwiseexpo,\n"
        "  newArchEnabled: true, no plugins\n"
    )

    p.h2("7.2  AuthContext + session flow")
    p.body(
        "src/api/AuthContext.js owns the session. There are NO JWT tokens. "
        "After login the User object is normalized and persisted to "
        "AsyncStorage under '@trainwise_user'. On every app start, "
        "bootstrapAsync rehydrates from storage and flips isLoading=false."
    )
    p.h3("Hook surface")
    p.code_block(
        "const {\n"
        "  user,            // full User object or null\n"
        "  userId,          // shorthand: user?.userId\n"
        "  deviceId,        // user?.deviceId (set later by sync flow)\n"
        "  isLoggedIn,      // !!user\n"
        "  isLoading,       // true during bootstrap & login\n"
        "  error,           // last error string\n"
        "  login,           // (email, password) => Promise<User>\n"
        "  logout,          // () => clears AsyncStorage + state\n"
        "  updateUser,      // (partial) => merge + persist\n"
        "} = useAuth();\n"
    )
    p.warning("Hooks rule  -  call inside the component, never at module scope",
              "All five fixed screens (Add Workout, Connect QR, Injury "
              "Report, Settings, Warnings Dashboard) had `const { userId } = "
              "useAuth();` at the TOP of the file (module scope). React's "
              "useContext returned null, the app crashed with `useContext of "
              "null` on the very first render. Always put `useAuth()` INSIDE "
              "the component function body, after the function signature.")

    p.h2("7.3  Navigation tree")
    p.code_block(
        "AppNavigator (decides based on isLoggedIn)\n"
        "|\n"
        "+-- AuthStack  (when NOT logged in)\n"
        "|     +-- Welcome   (WelcomeScreen)\n"
        "|     +-- Login     (LoginScreen)\n"
        "|\n"
        "+-- AppStack  (BottomTabs, when logged in)\n"
        "      +-- HomeTab   -> HomeStack\n"
        "      |     +-- HomeMain         (HomeScreen)\n"
        "      |     +-- Stats            (StatsScreen)\n"
        "      |     +-- Warnings         (WarningsDashboardScreen)\n"
        "      |     +-- AddWorkout       (AddWorkoutScreen)\n"
        "      |     +-- InjuryReport     (InjuryReportScreen)\n"
        "      |     +-- WorkoutSummary   (WorkoutSummaryScreen)\n"
        "      |     +-- Settings         (SettingsScreen)\n"
        "      |     +-- ConnectQR        (ConnectQRScreen)\n"
        "      +-- HealthTab -> HealthStack\n"
        "      |     +-- HealthConnectMain (GoogleFitScreen)\n"
        "      +-- ProfileTab -> ProfileStack\n"
        "            +-- ProfileMain      (ProfileScreen)\n"
    )

    p.h2("7.4  api.js  (TWO files - know which is which!)")
    p.warning("Two parallel API surfaces",
              "src/api/api.js and src/services/api.js are both axios clients "
              "talking to the same backend, but with different baseURL "
              "conventions and different naming. Both are imported across "
              "the app. Don't merge them lightly - migrating consumers is "
              "non-trivial.")
    p.h3("src/api/api.js  (BASE_URL = http://127.0.0.1:5249)")
    p.body(
        "axios instance + login(email, password) which POSTs to "
        "/api/auth/login (THIS ENDPOINT DOES NOT EXIST yet). Plus: "
        "getActivityLogs(userId), postActivityLog, putActivityLog, "
        "deleteActivityLog, getUserDevices, postUserDevice, putUserDevice, "
        "setBaseURL, getBaseURL."
    )
    p.h3("src/services/api.js  (API_BASE_URL = http://127.0.0.1:5249/api)")
    p.body(
        "axios instance pre-rooted at /api. Exposes: getUserById, updateUser, "
        "updateProfileImage, getAllActivityTypes, createActivityLog, "
        "getActivityLogsByUser, getDailyLoadByUser, calculateDailyLoad, "
        "getRecommendationsByUser, getCoachRecommendationsByUser, "
        "getAllInjuryTypes, createInjuryReport, getInjuriesByUser, "
        "getActiveInjuriesByUser, getCoachById, getTraineesByCoach, "
        "getAllTrainingGoals, addUserTrainingGoal, removeUserTrainingGoal, "
        "addUserActivityPreference, removeUserActivityPreference, "
        "getUserDevices, registerDevice."
    )
    p.body(
        "Both files document the adb-reverse trick at the top: phone reaches "
        "PC localhost via USB-bridged 127.0.0.1:5249. WiFi-only setups "
        "require swapping the IP to the PC's LAN IPv4 (e.g. 192.168.1.117) "
        "and disabling AP isolation on the router."
    )

    p.h2("7.5  Health Connect integration")
    p.body(
        "src/api/HealthConnectService.js wraps the native "
        "react-native-health-connect module. It uses CommonJS require() "
        "instead of ES import so the load can be wrapped in a try/catch - in "
        "Expo Go the native module isn't registered and "
        "TurboModuleRegistry.getEnforcing throws. When that happens, the "
        "module falls back to HealthConnectService.mock.js which returns "
        "empty/zero values for every function. Result: app runs in Expo Go, "
        "Health Connect actually works on a real Android build."
    )
    p.h3("Exercise type mapping  (HC -> ActivityTypeID)")
    p.code_block(
        "56 RUNNING       -> 1\n"
        "79 WALKING       -> 2\n"
        " 8 BIKING        -> 3\n"
        "80 WEIGHTLIFTING -> 4\n"
        " * (other)       -> 5  (default)\n"
    )
    p.h3("Required permissions")
    p.bullet("READ_STEPS")
    p.bullet("READ_DISTANCE")
    p.bullet("READ_EXERCISE")
    p.bullet("READ_HEART_RATE")
    p.bullet("READ_TOTAL_CALORIES_BURNED")

    p.h2("7.6  Sync pipeline")
    p.body("src/api/SyncService.syncWorkoutsToBackend(userId, deviceId, "
           "lookbackDays=7) executes seven steps:")
    p.bullet("1. initializeHealthConnect()  -  abort if SDK status false")
    p.bullet("2. checkPermissions()  -  abort if any missing")
    p.bullet("3. getStructuredWorkouts(startDate, endDate) from Health Connect")
    p.bullet("4. getActivityLogs(userId) from backend  -  for dedup")
    p.bullet("5. Deduplicate: workouts whose StartTime is within 60s of an "
             "existing log are dropped")
    p.bullet("6. POST each new workout via postActivityLog")
    p.bullet("7. updateDeviceLastSync(userId, deviceId)  -  PUT new LastSync")
    p.body("Returns { success, synced, skipped, errors[], workouts[] }.")
    p.h3("useSyncWorkouts() hook")
    p.body(
        "Wraps SyncService for screens. Exposes triggerSync, "
        "requestHCPermissions, checkHCPermissions, plus state isSyncing, "
        "lastSyncTime, syncResult, error, permissionsGranted, syncAttempts."
    )

    p.h2("7.7  Theme & components")
    p.h3("theme/colors.js")
    p.code_block(
        "Colors:\n"
        "  background       #0A1628  (dark navy)\n"
        "  cardBackground   #132036\n"
        "  primary          #E91E63  (TrainWise pink)\n"
        "  primaryDark      darker pink\n"
        "  primaryLight     lighter pink\n"
        "  accent           #FF6090\n"
        "  textPrimary      #FFFFFF\n"
        "  textSecondary    light grey\n"
        "  textMuted        muted grey\n"
        "  inputBackground  / inputBorder / border\n"
        "  green / yellow / red / shadow\n"
        "\n"
        "Fonts: titleSize 28, subtitleSize 18, bodySize 15, captionSize 12,\n"
        "       bold '700', semiBold '600'\n"
        "\n"
        "Spacing: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48\n"
    )
    p.h3("Components")
    p.bullet("Card({children, style})  -  rounded card with shadow + horizontal margin")
    p.bullet("PrimaryButton({title, onPress, loading, disabled, style})  -  "
             "filled pink button, ActivityIndicator while loading")
    p.bullet("ScreenHeader({title, subtitle, onBack})  -  centered title + "
             "optional back-arrow at top-left")

    # ----- Screens -----
    p.h2("7.8  Screens (11)")

    screens = [
        ("WelcomeScreen.js  (Auth)",
         "Brand entry screen with the wowowow.png logo + CurvedText laying "
         "each character along an arc. Two CTAs: 'Sign Up' -> SignUp; "
         "'HERE!' (under SIGN IN prompt) -> Login."),
        ("LoginScreen.js  (Auth)",
         "Themed login form (pink/purple/mint border). Inputs: email + "
         "password. Calls useAuth().login(email, password) which POSTs to "
         "/api/auth/login (AuthController -> UserBL.Authenticate). 'NEW HERE? "
         "CREATE AN ACCOUNT' link -> SignUp."),
        ("SignUpScreen.js / SignUpFinal.js  (Auth)",
         "Two-step registration. SignUpScreen collects identity + body "
         "metrics; SignUpFinal collects credentials + activity preferences. "
         "Final POST -> /api/Users (registerUser(payload) -> UsersController "
         "-> UserBL.Create). Server hardcodes ProfileImagePath, baseline "
         "fields, CreatedAt -- those keys are ignored if sent by the client."),
        ("HomeScreen.js  (HomeTab)",
         "Greeting + settings gear + avatar. Weekly bar chart driven by "
         "buildWeeklyData(backendLogs) -- BACKEND ONLY (no Health Connect "
         "fallback so a deleted log stays empty). Bar colors come from "
         "session-load thresholds: <=150 green, <300 yellow, <500 orange, "
         "500+ red. Auto-refreshes via useFocusEffect when the user returns "
         "to the tab. Three big buttons: Add Workout, See Warnings, Report "
         "Injury."),
        ("StatsScreen.js  (HomeStack)",
         "Two view modes. Overview = weekly bar chart + 'X training sessions "
         "this week' summary. Detail = zoomed 3-day chart + edit form "
         "(duration / exertion / distance / pulse). Imports getBarColor from "
         "HomeScreen so the colors match. Selected bar keeps its load color "
         "(opacity + width changes mark selection -- NOT a fixed pink). "
         "Empty days show all zeros. Apply changes PUTs/POSTs to "
         "/api/ActivityLog and recalcs the edited day + today via "
         "calculateDailyLoad."),
        ("WarningsDashboardScreen.js  (HomeStack)",
         "Computes status, AC ratio, stress, and the weekly bar chart "
         "client-side from ActivityLogs (NOT from DailyLoad rows -- those "
         "are 7-day rolling snapshots and would leak prior-week sessions "
         "into this-week bars). For the displayed Sun-Sat: acute = sum of "
         "session loads in week, chronic = sum(prior 21 days)/3, "
         "ratio = acute/chronic. Color thresholds: ratio<0.8 Green, "
         "0.8<=ratio<=1.3 Yellow, ratio>1.3 Red. Refresh button recalcs all "
         "7 days (loop i=6..0) so stale DailyLoad rows are flushed."),
        ("AddWorkoutScreen.js  (HomeStack)",
         "Loads getAllActivityTypes() into chip selector (fallback list "
         "hard-coded if API fails). Inputs: duration (min), exertion "
         "(1-10 dot row), distance (km), avg + max heart rate. Computes "
         "sessionLoad = duration * exertion (intensityFactor was REMOVED "
         "across DB/backend/frontend), POSTs createActivityLog(...), then "
         "calls calculateDailyLoad(userId), navigates to WorkoutSummary "
         "with the result."),
        ("WorkoutSummaryScreen.js  (HomeStack)",
         "Read-only result page. Receives 'summary' via route.params: "
         "activityName, duration, exertion, sessionLoad, loadLevel, "
         "acuteLoad, chronicLoad, acRatio, stressScore, recommendation. "
         "Displays Session Details card, Load Assessment card with colored "
         "Green/Yellow/Red badge + 4 metrics grid (Acute Load 7-day, "
         "Chronic Load 28-day, AC Ratio, Stress 0-100), Recommendation card."),
        ("InjuryReportScreen.js  (HomeStack)",
         "Top-level screen now: loads getAllInjuryTypes(), reports a NEW "
         "injury (chip selector + severity 1-10 + notes), AND shows a "
         "drill-down card with active-injury count -> navigates to "
         "ActiveInjuriesScreen. Refreshes activeCount on focus. POSTs "
         "createInjuryReport({ userID, injuryTypeID, date, severity, "
         "notes, isActiveInjury: true })."),
        ("ActiveInjuriesScreen.js  (HomeStack)",
         "Lists every active injury for the user (hosted as a separate "
         "screen so the report form stays uncluttered). Each row has a "
         "Mark Recovered button -> markInjuryRecovered API call which "
         "flips isActiveInjury=false on the backend."),
        ("SettingsScreen.js  (HomeStack)",
         "Loads getUserById(userId) into form fields: fullName, email, "
         "birthYear, gender, height, weight. Save calls updateUser(userId, "
         "{...}). Has trainee/coach toggle (cosmetic only). Privacy + Terms "
         "buttons show static Alert text. Bottom 'Connect to Coach / "
         "Trainee' navigates to ConnectQR."),
        ("ConnectQRScreen.js  (HomeStack)",
         "Two modes: 'show' renders a QR code containing JSON {app: "
         "'TrainWise', type: 'coach-connect', userId, timestamp}; 'scan' "
         "shows a paste-text area + 'Open Camera' stub. handleConnect "
         "validates JSON has app=='TrainWise', shows confirm Alert. No "
         "backend call yet - the connect handshake is local-only."),
        ("ProfileScreen.js  (ProfileTab)",
         "Reads 'user' from useAuth and renders rows: Full Name, Email, "
         "Username, Activity Level, Experience Level, Height, Weight, Role "
         "(Coach/Trainee). Single Logout button calls useAuth().logout()."),
        ("GoogleFitScreen.js  (HealthTab, lives in src/api/)",
         "Health Connect UI + workout management. On mount: "
         "checkHCPermissions, loadWorkouts. Pull-to-refresh reloads activity "
         "logs. Buttons: Request Permissions, Sync Now (calls triggerSync), "
         "Manual Refresh. Each row has a per-row Delete button (Alert "
         "confirm then deleteActivityLog + recalc). Renders FlatList of "
         "synced workouts with last-sync timestamp + error banner when sync "
         "fails."),
    ]
    for n, d in screens:
        p.h3(n)
        p.body(d)
        p.spacer(2)

    # ============================================================================
    # 8. END-TO-END FLOWS
    # ============================================================================
    p.h1("8.  End-to-End Data Flows")

    p.h2("Login flow  (working)")
    p.code_block(
        "LoginScreen handleSubmit\n"
        "  -> useAuth().login(email, password)\n"
        "       AuthContext.login\n"
        "         -> apiLogin(email, password)\n"
        "              src/api/api.js POST /api/auth/login\n"
        "                AuthController.Login\n"
        "                  -> UserBL.Authenticate(email, password)\n"
        "                    -> UserDAL.LoginByEmailPassword\n"
        "                       (calls sp_LoginUser)\n"
        "                    <- returns full User row\n"
        "         persists user object to AsyncStorage,\n"
        "         exposes userId via useAuth.\n"
        "  -> isLoggedIn flips true,\n"
        "     AppNavigator swaps from AuthStack to AppStack.\n"
    )

    p.h2("Add workout flow  (working)")
    p.code_block(
        "User taps Apply on AddWorkoutScreen\n"
        "  -> services/api.createActivityLog(payload)\n"
        "       POST /api/activitylog\n"
        "         ActivityLogController.Create\n"
        "           -> ActivityLogBL.Create (validate)\n"
        "             -> ActivityLogDAL.Insert (sp_InsertActivityLog)\n"
        "  -> services/api.calculateDailyLoad(userId)\n"
        "       POST /api/dailyload/user/{id}/calculate\n"
        "         DailyLoadController.Calculate\n"
        "           -> DailyLoadBL.CalculateForDay\n"
        "             -> DailyLoadDAL.CalculateDailyLoad\n"
        "                -- pulls 28d activity (sp_GetActivityLogsForLoad)\n"
        "                -- pulls thresholds (sp_GetUserLoadContext)\n"
        "                -- computes acute/chronic/AC/stress/level in C#\n"
        "                -- persists (sp_SaveDailyLoad)\n"
        "                -- returns tuple\n"
        "  -> navigation.navigate('WorkoutSummary', { summary: {...} })\n"
    )

    p.h2("Sync from Health Connect  (Android real-build only)")
    p.code_block(
        "GoogleFitScreen 'Sync Now'\n"
        "  -> useSyncWorkouts.triggerSync\n"
        "       SyncService.syncWorkoutsToBackend(userId, deviceId, 7)\n"
        "         step 1: initializeHealthConnect\n"
        "         step 2: checkPermissions\n"
        "         step 3: getStructuredWorkouts(start, end) from native HC\n"
        "         step 4: getActivityLogs(userId)  [GET /api/ActivityLog/user/{id}]\n"
        "         step 5: dedup by 60s startTime tolerance\n"
        "         step 6: for each new workout: POST /api/ActivityLog\n"
        "         step 7: PUT /api/users/{userId}/devices/{deviceId} {LastSync}\n"
    )

    # ============================================================================
    # 9. BUILD & RUN
    # ============================================================================
    p.h1("9.  Build & Run instructions")

    p.h2("9.1  Database")
    p.bullet("Open SSMS connected to Lirone\\SQLEXPRESS (Windows auth)")
    p.bullet("Convert SQL/TrainWiseDB_Script.sql to UTF-8 if SSMS complains "
             "about UTF-16 BOM, or open with 'Open with Encoding' -> UTF-16 LE")
    p.bullet("Execute the script - creates 16 tables, 49 procs, seeds "
             "ActivityTypes / InjuryTypes / TrainingGoals / LoadParameters")
    p.bullet("Verify: SELECT * FROM sys.objects WHERE type='P' should "
             "return 49 rows")

    p.h2("9.2  Backend")
    p.code_block(
        "cd TrainWise_GitHub\n"
        "dotnet restore\n"
        "dotnet run\n"
        "\n"
        "# verify\n"
        "open http://localhost:5249/swagger\n"
    )
    p.warning("HTTPS redirect breaks phone testing",
              "Comment out app.UseHttpsRedirection() in Program.cs before "
              "pointing the phone at the backend. The phone won't trust the "
              "ASP.NET dev cert and the redirect will hang the request.")

    p.h2("9.3  Frontend  (Expo Go on Android via USB)")
    p.code_block(
        "# in TrainWiseExpo/\n"
        "npm install\n"
        "npx expo start --tunnel        # or --localhost when using adb\n"
        "\n"
        "# in another terminal (USB plugged in)\n"
        "adb reverse tcp:5249 tcp:5249  # phone localhost:5249 -> PC :5249\n"
        "\n"
        "# on phone: open Expo Go, scan QR\n"
    )
    p.h3("If using WiFi instead of USB")
    p.bullet("Phone and PC must be on the SAME WiFi (no AP isolation)")
    p.bullet("Open Windows Defender Firewall, allow inbound TCP 5249")
    p.bullet("Edit src/api/api.js AND src/services/api.js, replace 127.0.0.1 "
             "with PC's LAN IPv4 (e.g. 192.168.1.117)")

    # ============================================================================
    # 10. KNOWN ISSUES
    # ============================================================================
    p.h1("10. Known Issues & Architectural Gaps")

    p.warning("No AuthController exists (login is broken)",
              "Frontend POSTs to /api/auth/login. Database has sp_LoginUser. "
              "Backend has no AuthController, no AuthBL, no UserDAL.Login* "
              "method. Login throws every time. Fix: add AuthController + "
              "AuthBL + UserDAL.LoginByEmailPassword (wraps sp_LoginUser).")

    p.warning("User model is missing half of the SQL columns",
              "BL/Models/User.cs has 10 properties. The SQL Users table has "
              "22 columns including Email, Password, IsCoach, "
              "ExperienceLevel, BaseLineDailyLoad, BaseLineWeeklyLoad, "
              "HealthDeclaration, ConfirmTerms, IsBaselineEstablished, "
              "BaselineEstablishedDate. Anything UserDAL hands back through "
              "this model silently drops those columns.")

    p.warning("ActivityLog model missing 4 fields",
              "AddWorkoutScreen sends exertionLevel, duration, "
              "calculatedLoadForSession, isConfirmed. The C# ActivityLog.cs "
              "model has none of them. They reach SQL only because "
              "sp_InsertActivityLog accepts them as parameters - but the "
              "round-trip (Get / Update) cannot read them back into the "
              "model.")

    p.warning("CoachRecommendationsController and UserDevicesController "
              "missing [ApiController] / [Route] attributes",
              "Without [Route(\"api/...\")] ASP.NET cannot map HTTP requests "
              "to actions. Both controllers are effectively unreachable. "
              "Frontend calls to /api/coachrecommendations/user/{id} and "
              "/api/userdevice/user/{id} will 404.")

    p.warning("Two parallel api.js files",
              "src/api/api.js and src/services/api.js both export overlapping "
              "axios calls under different names (getActivityLogs vs "
              "getActivityLogsByUser, etc). Different baseURL conventions "
              "(/api included vs not). Hooks-rule fixes had to track "
              "imports carefully.")

    p.warning("Severity scale mismatch",
              "InjuryReportScreen renders a 1-10 picker (10 dots). "
              "InjuryReportBL.Create throws if Severity > 5. Today the "
              "picker silently submits invalid values. Fix one of: clip in "
              "BL, change UI to 1-5, or change validator to 1-10.")

    p.warning("Plain-text 8-char password",
              "Users.Password is char(8), stored as plain text. sp_LoginUser "
              "compares with COLLATE Latin1_General_CS_AS (case-sensitive). "
              "When auth is wired up, hash before storing.")

    p.warning("No auth middleware",
              "Program.cs calls UseAuthorization but never AddAuthentication. "
              "Every endpoint is public. Adding [Authorize] would have no "
              "effect.")

    p.warning("Hooks at module scope was the source of the red-screen crash",
              "The `useContext of null` red error on the phone was caused by "
              "5 screens calling `const { userId } = useAuth();` at the TOP "
              "of the file, outside the component function. React hooks MUST "
              "be inside a component body. All five are now fixed - keep "
              "the rule in mind for any new screen.")

    # ============================================================================
    # 11. FILE INDEX
    # ============================================================================
    p.h1("11. File Index")

    p.h2("Frontend (TrainWiseExpo/src/)")
    file_idx_fe = [
        "App.js                                  Provider chain root",
        "index.js                                registerRootComponent",
        "app.json                                Expo config",
        "assets/images/wowowow.png               Brand logo",
        "src/api/AuthContext.js                  Session context + useAuth()",
        "src/api/api.js                          axios + login + ActivityLog CRUD",
        "src/api/HealthConnectService.js         Real native HC wrapper",
        "src/api/HealthConnectService.mock.js    Expo Go fallback",
        "src/api/SyncService.js                  Health Connect -> backend pipeline",
        "src/api/useSyncWorkouts.js              Hook: triggerSync, state",
        "src/api/GoogleFitScreen.js              Health Connect UI",
        "src/services/api.js                     Full CRUD axios surface",
        "src/navigation/NavigationStack.js       AppNavigator + tabs",
        "src/screens/WelcomeScreen.js            Brand cover",
        "src/screens/LoginScreen.js              Email/password login",
        "src/screens/HomeScreen.js               Dashboard",
        "src/screens/StatsScreen.js              Charts + edit",
        "src/screens/WarningsDashboardScreen.js  Load level + AC ratio",
        "src/screens/AddWorkoutScreen.js         Manual workout entry",
        "src/screens/WorkoutSummaryScreen.js     Result card after add",
        "src/screens/InjuryReportScreen.js       Injury logging + drill-down",
        "src/screens/ActiveInjuriesScreen.js     Active list + Mark Recovered",
        "src/screens/SignUpScreen.js             Step 1 of registration",
        "src/screens/SignUpFinal.js              Step 2 of registration",
        "src/screens/SettingsScreen.js           Profile editor",
        "src/screens/ConnectQRScreen.js          Coach/trainee handshake",
        "src/screens/ProfileScreen.js            Profile + logout",
        "src/components/Card.js                  Rounded card wrapper",
        "src/components/PrimaryButton.js         Pink CTA button",
        "src/components/ScreenHeader.js          Title + back arrow",
        "src/theme/colors.js                     Color/Font/Spacing tokens",
        "src/constants/google.js                 GOOGLE_WEB_CLIENT_ID",
    ]
    for f in file_idx_fe:
        p.body(f)

    p.h2("Backend (TrainWise/TrainWise/)")
    file_idx_be = [
        "Program.cs                              ASP.NET startup",
        "appsettings.json                        ConnectionString",
        "TrainWise.csproj                        Net8 project",
        "TrainWise.sln                           Solution",
        "Controllers/UsersController.cs",
        "Controllers/ActivityLogController.cs",
        "Controllers/DailyLoadController.cs",
        "Controllers/RecommendationController.cs",
        "Controllers/InjuryReportController.cs",
        "Controllers/InjuryTypesController.cs",
        "Controllers/CoachController.cs",
        "Controllers/CoachRecommendationsController.cs    (broken attrs)",
        "Controllers/TrainingGoalsController.cs",
        "Controllers/UserGoalsController.cs",
        "Controllers/UserActivityPreferencesController.cs",
        "Controllers/UserDevicesController.cs             (broken attrs)",
        "BL/UserBL.cs / DailyLoadBL.cs / ActivityLogBL.cs / etc (12)",
        "BL/Models/*.cs                          15 POCO models",
        "DAL/DBservice.cs                        Connect + sproc helper",
        "DAL/UserDAL.cs / ActivityLogDAL.cs / DailyLoadDAL.cs / etc (14)",
    ]
    for f in file_idx_be:
        p.body(f)

    p.h2("Database")
    p.body("../SQL/TrainWiseDB_Script.sql      UTF-16LE encoded - convert "
           "to UTF-8 before reading with most tools")

    p.h2("Documentation")
    p.body("generate_docs_pdf.py                THIS script (PyMuPDF)")
    p.body("TrainWise_Project_Documentation.pdf Output of this script")

    # ===== END =====
    p.spacer(20)
    p.h2("End of document")
    p.small("Regenerate at any time:  py generate_docs_pdf.py")

    p.save()


if __name__ == "__main__":
    build()
