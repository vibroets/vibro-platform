import pandas as pd

df = pd.read_excel(r'C:\Users\lenovo\Desktop\Old NC import.xlsx', sheet_name='Import Data')
print("Columns:", list(df.columns))
print("Shape:", df.shape)
print()
print(df[['Response ID','Submission Date','Initiated By','Audited Location','Source Type','Source ID']].to_string())
print()
print("dtypes:")
print(df[['Submission Date','Audited Location','Source ID']].dtypes)
print()

# Simulate grouping logic
if 'Response ID' in df.columns and df['Response ID'].astype(str).str.strip().any():
    df['_group_key'] = df['Response ID'].astype(str).str.strip()
    print("Grouping by Response ID")
else:
    print("Response ID is empty, grouping by date+user+location+source")
    group_parts = df['Submission Date'].astype(str) + '||' + df['Initiated By'].astype(str)
    if 'Audited Location' in df.columns:
        group_parts = group_parts + '||' + df['Audited Location'].astype(str).str.strip()
    if 'Source ID' in df.columns:
        group_parts = group_parts + '||' + df['Source ID'].astype(str).str.strip()
    df['_group_key'] = group_parts

print()
print("Group keys:")
for i, k in enumerate(df['_group_key']):
    print(f"  Row {i}: '{k}'")

print()
print("Unique group keys:", df['_group_key'].nunique())
for gk, gdf in df.groupby('_group_key', sort=False):
    print(f"  Group '{gk}': {len(gdf)} rows")
