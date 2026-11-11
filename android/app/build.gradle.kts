import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing: the keystore the COMMUNARR_KEYSTORE* variables name (GitHub Actions), or the one
// ~/.config/communarr-android/keystore.properties names, on a computer that holds the key. Without
// either, release builds are signed with the debug key.
val keyFile = File(System.getProperty("user.home"), ".config/communarr-android/keystore.properties")
val keyProps = Properties().apply { if (keyFile.exists()) keyFile.inputStream().use { load(it) } }
fun signing(env: String, prop: String): String? = System.getenv(env)?.takeIf { it.isNotEmpty() } ?: keyProps.getProperty(prop)
val keystore = signing("COMMUNARR_KEYSTORE", "storeFile")

// a server's own copy of the app: a name (and id, so it installs beside Communarr) of its own, the
// rest the same: ./gradlew assembleRelease -PappName=Friends -PappId=com.example.friends
val appName = providers.gradleProperty("appName").getOrElse("Communarr")
val appId = providers.gradleProperty("appId").getOrElse("io.github.svennefenne.communarr")

// every commit is a newer version to Android: the version code counts them
val commits = providers.exec {
    commandLine("git", "rev-list", "--count", "HEAD")
    isIgnoreExitValue = true
}.standardOutput.asText.map { it.trim().toIntOrNull() ?: 1 }

android {
    namespace = "io.github.svennefenne.communarr"
    compileSdk {
        version = release(36) { minorApiLevel = 1 }
    }

    defaultConfig {
        applicationId = appId
        resValue("string", "app_name", appName)
        minSdk = 29
        targetSdk = 35
        versionCode = commits.get()
        versionName = "0.1.2"
    }

    buildFeatures {
        buildConfig = true
        resValues = true      // the app's name (appName above)
    }

    signingConfigs {
        if (keystore != null) {
            create("release") {
                storeFile = file(keystore)
                storePassword = signing("COMMUNARR_KEYSTORE_PASSWORD", "storePassword")
                keyAlias = signing("COMMUNARR_KEY_ALIAS", "keyAlias")
                keyPassword = signing("COMMUNARR_KEY_PASSWORD", "keyPassword") ?: storePassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.12.4")
    implementation("androidx.webkit:webkit:1.17.1")
    // notifications (Push.kt): started with the server's own Firebase settings, no google-services.json
    implementation("com.google.firebase:firebase-messaging:26.0.1")
    // (Firebase brings an older one, which registerForActivityResult can't use)
    implementation("androidx.fragment:fragment-ktx:1.8.9")
}
