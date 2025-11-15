zip:
  mkdir -p build
  rm build/tabunloader.zip || true
  zip -r -FS build/tabunloader.zip * --exclude build --exclude .git --exclude tabunloader.zip --exclude Makefile
