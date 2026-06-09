with open('main.py', encoding='utf-8') as f:
    content = f.read()

# Find exact broken pattern and replace
broken_start = 'system_prompt = f\\"\\"\\"You are a caring personal AI nurse'
fixed_start  = 'system_prompt = f"""You are a caring personal AI nurse'

broken_end = 'Do NOT prescribe new medications.\\"\\"\\"'
fixed_end  = 'Do NOT prescribe new medications."""'

content = content.replace(broken_start, fixed_start)
content = content.replace(broken_end, fixed_end)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
lines = content.split('\n')
for i in [654, 666]:
    print(f'Line {i+1}: {repr(lines[i][:90])}')
print('Done!')
