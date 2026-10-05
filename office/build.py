# Live Office pages are built with node build.mjs. Never overwrite them with demo templates.
import subprocess
from pathlib import Path
subprocess.run(['node',str(Path(__file__).parent/'build.mjs')],check=True)
