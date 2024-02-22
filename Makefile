.PHONY: zip

zip:
	mkdir -p build
	zip -r -FS build/tabunloader.zip * --exclude build --exclude .git --exclude tabunloader.zip --exclude Makefile
