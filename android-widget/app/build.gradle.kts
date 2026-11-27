plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.gamingpig.widget"
    compileSdk = 34

    defaultConfig {
        applicationId = "de.gamingpig.widget"
        minSdk = 26
        targetSdk = 34
        versionCode = 13
        versionName = "2.2.3"
    }

    signingConfigs {
        create("release") {
            storeFile = file("gamingpig-widget.keystore")
            storePassword = System.getenv("GP_KEYSTORE_PASS") ?: "gamingpig2026"
            keyAlias = "gamingpig"
            keyPassword = System.getenv("GP_KEY_PASS") ?: "gamingpig2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
}
