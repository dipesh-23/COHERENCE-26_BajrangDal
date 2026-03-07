"""
create_users.py — Creates doctor + admin users in Supabase Auth.
Run once: python scripts/create_users.py
"""
import os, sys
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

USERS = [
    {
        "email":    "doctor@trialmatch.ai",
        "password": "TrialMatch2024!",
        "role":     "doctor",
        "name":     "Dr. Sarah Chen",
        "hospital": "Mount Sinai Medical Center",
        "department": "Oncology Research"
    },
    {
        "email":    "crc@trialmatch.ai",
        "password": "TrialMatch2024!",
        "role":     "crc",
        "name":     "Coordinator Jane Smith",
        "hospital": "Mount Sinai Medical Center",
        "department": "Clinical Trials Office"
    },
    {
        "email":    "admin@trialmatch.ai",
        "password": "Admin2024!",
        "role":     "admin",
        "name":     "Admin User",
        "hospital": "TrialMatch HQ",
        "department": "Platform Administration"
    },
]

for u in USERS:
    try:
        # Create user via Supabase Admin Auth API
        resp = db.auth.admin.create_user({
            "email":           u["email"],
            "password":        u["password"],
            "email_confirm":   True,   # skip email confirmation
            "user_metadata": {
                "name":       u["name"],
                "role":       u["role"],
                "hospital":   u["hospital"],
                "department": u["department"],
            }
        })
        print(f"  [OK] Created: {u['email']}  (role={u['role']})")
    except Exception as e:
        err = str(e)
        if "already been registered" in err or "already exists" in err or "duplicate" in err.lower():
            print(f"  [SKIP] {u['email']} already exists")
        else:
            print(f"  [FAIL] {u['email']}: {e}")

print()
print("Credentials:")
for u in USERS:
    print(f"  {u['role']:8s}  {u['email']:35s}  {u['password']}")
