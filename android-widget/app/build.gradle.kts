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
        versionCode = 6
        versionName = "2.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
