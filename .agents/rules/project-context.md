---
description: Project Context and Architectural Memory for FORM::IskakFatoni
globs: *
---

# FORM::IskakFatoni Project Context & Memory

## Overview
This repository (`form-IskakFatoni`) is a full-featured, zero-dependency modern Google Forms alternative built with pure Vanilla HTML5, Vanilla CSS3 (Glassmorphism design system), and Vanilla JavaScript (ES6+). It uses Firebase Cloud Firestore and Firebase Storage for cloud persistence with automatic LocalStorage / compressed Base64 fallback.

## Key Files & Structure
- `index.html` + `js/app.js`: Main landing page, dashboard list, form search/filter, and authentication modals.
- `form.html`: The multi-purpose SPA shell for the Form Builder, Responder/Viewer, and Response Analytics.
- `js/builder.js`: Form building engine (handles text, choices, ratings, linear scale, signature pad, camera upload, GPS location, conditional section branching, and form settings).
- `js/form-view.js`: Form rendering & submission engine for responders (supports multi-step sections, signature pad drawing, camera/file capture, GPS coordinates, timeout-guarded uploads, receipt printing, and QR/WhatsApp sharing).
- `js/responses.js`: Analytics tab, responses summary charts, and interactive data table.
- `js/export-excel.js`: Spreadsheet exporter generating `.xlsx` (via SheetJS) and `.csv`.
- `js/image-uploader.js`: Client-side image compressor & storage fallback.
- `js/storage.js`: Persistence layer bridging Firestore and LocalStorage.
- `firestore.rules`: Security rules for Firestore collections.

## Rules & Coding Guidelines
1. **Preserve Pure Vanilla Stack**: Do not introduce heavy front-end frameworks (React/Vue/Angular) unless explicitly requested.
2. **Glassmorphism & Aesthetics**: Maintain the modern dark/light glassmorphic UI tokens in `css/main.css`.
3. **Safety & Fallbacks**: Form submissions must never fail due to network timeouts on Firebase Storage; keep the compressed dataUrl fallback mechanism intact.
4. **Refer to Memory**: Refer to [PROJECT_MEMORY.md](file:///c:/Users/iskak/Antigravity-Projetcs/form-IskakFatoni/PROJECT_MEMORY.md) for detailed feature specs and changelog.
