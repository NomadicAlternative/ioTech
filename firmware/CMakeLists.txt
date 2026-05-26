cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(iotech_firmware)

# Strip -Werror flags added by ESP-IDF (pre-existing driver code warnings)
idf_build_get_property(build_compile_options COMPILE_OPTIONS)
string(REGEX REPLACE "-Werror[^ ]*" "" build_compile_options "${build_compile_options}")
idf_build_set_property(COMPILE_OPTIONS "${build_compile_options}")
