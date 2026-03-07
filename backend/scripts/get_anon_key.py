"""get_anon_key.py - shows the anon key hint from the service_role JWT structure"""
import os, base64, json
from dotenv import load_dotenv
load_dotenv()

sk = os.getenv("SUPABASE_SERVICE_KEY","")
# JWT has 3 parts - decode the payload
try:
    parts = sk.split(".")
    payload = parts[1] + "=="  # add padding
    decoded = json.loads(base64.b64decode(payload))
    print("Service role JWT payload:", json.dumps(decoded, indent=2))
    print()
    print("The anon key has the SAME structure but with role='anon'")
    print("You must get it from: Supabase Dashboard -> Settings -> API -> anon key")
except Exception as e:
    print(f"Error: {e}")
