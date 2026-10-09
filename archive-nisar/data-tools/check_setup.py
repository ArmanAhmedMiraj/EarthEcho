# check_setup.py
# Confirms every data library installed correctly and can be imported.
import sys

packages = ["numpy", "h5py", "pyproj", "PIL", "matplotlib", "earthaccess", "asf_search"]

print("Python:", sys.version.split()[0])
all_ok = True

for name in packages:
    try:
        module = __import__(name)
        version = getattr(module, "__version__", "installed")
        print(f"OK    {name} {version}")
    except Exception as error:
        all_ok = False
        print(f"FAIL  {name}: {error}")

print()
if all_ok:
    print("Everything is ready.")
else:
    print("Some libraries failed. Send me the FAIL lines above.")