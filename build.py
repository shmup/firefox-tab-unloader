#!/usr/bin/env python3
import zipfile
import os
from pathlib import Path

# Create build directory
build_dir = Path("build")
build_dir.mkdir(exist_ok=True)

# Remove old zip if exists
zip_path = build_dir / "tabunloader.zip"
if zip_path.exists():
    zip_path.unlink()
    print(f"Removed old {zip_path}")

# Files and directories to include
items = [
    "manifest.json",
    "background.js",
    "LICENSE",
    "README",
]

# Create new zip
print(f"Creating {zip_path}...")
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # Add individual files
    for item in items:
        if Path(item).exists():
            zipf.write(item)
            print(f"  Added {item}")

    # Add all icons
    icons_dir = Path("icons")
    if icons_dir.exists():
        for icon in icons_dir.glob("*.png"):
            zipf.write(icon)
            print(f"  Added {icon}")

print(f"Successfully created {zip_path}")
