import os
import subprocess

os.chdir('/Users/tiziano/Desktop/proggetti /navicatore/navicatore-main/frontend')
try:
    with open('build.log', 'w') as f:
        subprocess.Popen(['npx', 'eas-cli', 'build', '-p', 'android', '--profile', 'preview', '--non-interactive'], stdout=f, stderr=subprocess.STDOUT)
    print("Build started in background")
except Exception as e:
    print(e)
