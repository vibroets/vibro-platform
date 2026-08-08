import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from form.models import Form
from form.serializers import FormSerializer

f = Form.objects.get(id=5)
serialized = FormSerializer(f, many=False).data
print("Top-level keys:", list(serialized.keys()))
print()
for key in serialized.keys():
    val = serialized[key]
    if isinstance(val, list):
        print(f"  {key}: list with {len(val)} items")
        if val and isinstance(val[0], dict):
            print(f"    first item keys: {list(val[0].keys())}")
            if 'name' in val[0]:
                print(f"    first item name: {val[0]['name']}")
            if 'is_audit_info' in val[0]:
                print(f"    first item is_audit_info: {val[0]['is_audit_info']}")
            if 'questions' in val[0]:
                print(f"    first item questions count: {len(val[0]['questions'])}")
    elif isinstance(val, dict):
        print(f"  {key}: dict with keys {list(val.keys())}")
        if 'questions' in val:
            print(f"    questions count: {len(val['questions'])}")
            for q in val['questions']:
                print(f"      Q: {q.get('question')}")
    else:
        print(f"  {key}: {val}")
