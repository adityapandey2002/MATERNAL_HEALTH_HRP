# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Keep Capacitor's bridge and plugin entry points, which are reached by
# reflection from the web side.
-keep class com.getcapacitor.** { *; }
-keep class in.gov.araria.matrusuraksha.** { *; }
-dontwarn com.getcapacitor.**

# Keep the line number information for debugging stack traces from the field.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile