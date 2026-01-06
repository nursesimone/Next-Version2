# 🔐 PERMANENT LOGIN CREDENTIALS

**⚠️ CRITICAL: READ THIS FIRST WHEN TAKING OVER FROM ANOTHER AGENT!**

These credentials are stored in MongoDB database: `test_database`
They will persist across all agent handoffs and system restarts.

---

## Admin Account (Full Access)
```
Email:    demo@nursemed.com
Password: demo123
```
- Can access all features
- Can manage staff
- Can view all patients across all organizations

---

## Test Nurse Accounts

### Sarah Johnson (RN)
```
Email:    sarah.johnson@nursemed.com
Password: nurse123
```
- Organization: POSH Host Homes
- Can create: Nurse Visits, Vitals, Daily Notes

### Michael Chen (LPN)
```
Email:    michael.chen@nursemed.com
Password: nurse123
```
- Organization: Ebenezer Private HomeCare
- Can create: Vitals, Daily Notes

---

## Test Patients in Database

1. **Margaret Williams** (POSH Host Homes)
   - DOB: 1945-03-15
   - Conditions: Hypertension, Type 2 Diabetes, Osteoarthritis

2. **Robert Johnson** (Ebenezer Private HomeCare)
   - DOB: 1938-07-22
   - Conditions: CHF, COPD, Depression

3. **Dorothy Martinez** (Jericho)
   - DOB: 1952-11-08
   - Conditions: Alzheimer's Disease, Hypertension

---

## If Login Doesn't Work OR "Failed to load patients" Error

Run this command to recreate all users and patients with correct structure:
```bash
python3 /tmp/setup_database.py
```

This script:
- Clears existing data
- Creates users with correct password hashes
- Creates patients with proper data structure (lists for allergies, medications, diagnoses)
- Ensures all required fields (nurse_id, assigned_nurses) are present

Or manually verify database:
```bash
mongosh mongodb://localhost:27017/test_database --eval "db.nurses.find({email: 'demo@nursemed.com'})"
mongosh mongodb://localhost:27017/test_database --eval "db.patients.countDocuments()"
```

---

## Database Info
- **MongoDB URL:** mongodb://localhost:27017
- **Database Name:** test_database (specified in /app/backend/.env)
- **Collections:** nurses, patients, visits, interventions, incident_reports

---

**Last Updated:** January 6, 2026
**Status:** ✅ Verified Working
